import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AppointmentAttachmentIcons } from '@/components/AppointmentAttachmentIcons';
import { ConsentimientoViewerDialog } from '@/components/consentimiento/ConsentimientoViewerDialog';
import { supabase } from '@/lib/supabase';
import type { Consentimiento } from '@/lib/consentimientoTypes';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useCustomerDayTimeline,
  type AppointmentAttachmentHints,
  type AppointmentTimelineDetails,
  type DayGroup,
  type DayTimelineItem,
} from '@/hooks/useCustomerDayTimeline';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useStyleSyncAgentStatus } from '@/hooks/useStyleSyncAgentStatus';
import { CUSTOMER_APPOINTMENTS_TIMELINE_LIMIT } from '@/lib/agendaCustomerAppointments';
import { cn } from '@/lib/utils';

type HistoryTableRow = {
  id: string;
  dateLabel: string;
  time: string;
  employee: string;
  details: string;
  price: string;
  muted?: boolean;
  appointmentId?: string;
  appointmentDate?: string;
  appointmentStatusLabel?: string;
  isFutureAppointment?: boolean;
  attachments?: AppointmentAttachmentHints;
  consentId?: string;
};

function formatDateLabel(ymd: string): string {
  try {
    return format(parseISO(ymd + 'T12:00:00'), 'dd/MM/yyyy', { locale: es });
  } catch {
    return ymd;
  }
}

function appointmentDetailsText(d: AppointmentTimelineDetails, title: string): string {
  const serviceLabels =
    d.services.length > 0
      ? d.services
      : d.items.map((i) => {
          const mins = i.duration_minutes ? ` (${i.duration_minutes}m)` : '';
          return `${i.label}${mins}`;
        });

  const parts: string[] = [title];

  const extraServices = serviceLabels.filter(
    (s) => s !== title && !title.includes(s.slice(0, Math.min(24, s.length))),
  );
  if (extraServices.length) parts.push(extraServices.join(' · '));
  else if (serviceLabels.length > 1) parts.push(serviceLabels.join(' · '));

  const obs = d.description?.replace(/\r?\n/g, ' · ').trim();
  if (obs && obs !== title && !serviceLabels.some((s) => obs.includes(s))) {
    parts.push(obs);
  }
  if (d.statusLabel && d.statusLabel !== 'Confirmada') {
    parts.push(d.statusLabel);
  }

  return parts.join(' · ');
}

function appointmentTime(d: AppointmentTimelineDetails, fallback?: string): string {
  return d.timeRange || fallback || '';
}

function formatPrice(amount: number | null | undefined, amountLabel?: string): string {
  if (amountLabel) return amountLabel;
  if (amount != null && amount > 0) return `${amount.toFixed(2)} €`;
  return '';
}

function buildAppointmentInstant(dateYmd: string, timeRange?: string): number | null {
  const time = (timeRange || '').split('–')[0]?.trim() || '12:00';
  const iso = `${dateYmd}T${time.length === 5 ? time : '12:00'}:00`;
  const ts = Date.parse(iso);
  return Number.isFinite(ts) ? ts : null;
}

function isFutureAppointment(dateYmd: string, timeRange?: string): boolean {
  const instant = buildAppointmentInstant(dateYmd, timeRange);
  if (instant == null) return false;
  return instant > Date.now();
}

function itemToRow(dayDate: string, it: DayTimelineItem): HistoryTableRow {
  if (it.kind === 'appointment' && it.appointmentDetails) {
    const d = it.appointmentDetails;
    const future = isFutureAppointment(dayDate, d.timeRange);
    const futureLabel =
      future && d.statusLabel !== 'Cancelada'
        ? `Pendiente${d.statusLabel && d.statusLabel !== 'Confirmada' ? ` · ${d.statusLabel}` : ''}`
        : undefined;
    return {
      id: it.id,
      dateLabel: formatDateLabel(dayDate),
      time: appointmentTime(d, it.timeLabel),
      employee: d.employeeName || '',
      details: futureLabel
        ? `${appointmentDetailsText(d, it.title)} · ${futureLabel}`
        : appointmentDetailsText(d, it.title),
      price: formatPrice(d.chargedAmount, it.amountLabel),
      appointmentId: d.appointmentId,
      appointmentDate: dayDate,
      appointmentStatusLabel: futureLabel ?? (d.statusLabel && d.statusLabel !== 'Confirmada' ? d.statusLabel : undefined),
      isFutureAppointment: future && d.statusLabel !== 'Cancelada',
      attachments: d.attachments,
    };
  }

  const details = [it.title, it.subtitle].filter(Boolean).join(' · ');
  return {
    id: it.id,
    dateLabel: formatDateLabel(dayDate),
    time: it.timeLabel || '',
    employee: '',
    details,
    price: it.amountLabel || '',
    consentId:
      it.kind === 'consent' && it.refTable === 'consentimientos' && it.refId ? it.refId : undefined,
  };
}

const GENERIC_APPOINTMENT_DETAILS = new Set([
  'appointment',
  'appointments',
  'cita',
  'citas',
  'evento',
  'evento estético',
]);

function isGhostDetails(details: string): boolean {
  const normalized = details.trim().toLowerCase();
  return GENERIC_APPOINTMENT_DETAILS.has(normalized);
}

function buildTableRows(days: DayGroup[]): HistoryTableRow[] {
  const rows: HistoryTableRow[] = [];
  for (const day of days) {
    if (day.daySummary) {
      rows.push({
        id: `summary:${day.date}`,
        dateLabel: formatDateLabel(day.date),
        time: '',
        employee: '',
        details: day.daySummary,
        price: '',
        muted: true,
      });
    }
    for (const it of day.items) {
      const row = itemToRow(day.date, it);
      if (
        !row.appointmentId &&
        !row.time &&
        !row.employee &&
        !row.price &&
        isGhostDetails(row.details)
      ) {
        continue;
      }
      rows.push(row);
    }
  }
  return rows;
}

interface Props {
  customerId: string;
  className?: string;
  onAppointmentClick?: (appointmentId: string, dateYmd: string) => void;
}

export const ClienteDailyScrollView: React.FC<Props> = ({ customerId, className, onAppointmentClick }) => {
  const [appointmentLimit, setAppointmentLimit] = useState(CUSTOMER_APPOINTMENTS_TIMELINE_LIMIT);
  const [viewConsent, setViewConsent] = useState<Consentimiento | null>(null);
  const [loadingConsent, setLoadingConsent] = useState(false);
  const { companyId } = useCompanyFilter();
  const { data: styleSync } = useStyleSyncAgentStatus(companyId, 4_000);
  const lastSyncRef = useRef<string | null>(null);
  const { data, isLoading, isFetching, isError, error, refetch } = useCustomerDayTimeline(customerId, {
    appointmentLimit,
  });
  const rows = useMemo(() => buildTableRows(data?.days || []), [data?.days]);
  const hasMoreAppointments = data?.hasMoreAppointments ?? false;

  useEffect(() => {
    const ts = styleSync?.last_outbound_ok_at;
    if (!ts) return;
    if (lastSyncRef.current === null) {
      lastSyncRef.current = ts;
      return;
    }
    if (ts !== lastSyncRef.current) {
      lastSyncRef.current = ts;
      void refetch();
    }
  }, [refetch, styleSync?.last_outbound_ok_at]);

  const openConsent = async (consentId: string) => {
    setLoadingConsent(true);
    try {
      const { data: row, error } = await supabase
        .from('consentimientos')
        .select('*')
        .eq('id', consentId)
        .single();
      if (error) throw error;
      setViewConsent(row as Consentimiento);
    } catch {
      /* ignore */
    } finally {
      setLoadingConsent(false);
    }
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <Skeleton className="h-8 w-full rounded-md" />
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-7 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error instanceof Error ? error.message : 'No se pudo cargar el historial.'}
      </p>
    );
  }

  if (!rows.length) {
    return (
      <div
        className={cn(
          'rounded-xl border border-dashed border-sky-200/80 bg-sky-50/40 dark:border-sky-800/50 dark:bg-sky-950/20 px-4 py-8 text-center',
          className,
        )}
      >
        <p className="text-sm text-muted-foreground">Sin actividad registrada aún en esta compañía.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Citas, facturas, bonos y registros clínicos aparecerán aquí en orden cronológico.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('rounded-lg border border-sky-100/80 dark:border-sky-900/40 overflow-hidden', className)}>
      <Table className="text-xs table-fixed">
        <TableHeader>
          <TableRow className="hover:bg-transparent bg-sky-50/60 dark:bg-sky-950/30">
            <TableHead className="h-8 px-2 py-1.5 w-[88px] whitespace-nowrap font-semibold text-foreground">
              Fecha
            </TableHead>
            <TableHead className="h-8 px-2 py-1.5 w-[96px] whitespace-nowrap font-semibold text-foreground">
              Horario
            </TableHead>
            <TableHead className="h-8 px-2 py-1.5 w-[120px] whitespace-nowrap font-semibold text-foreground">
              Empleado
            </TableHead>
            <TableHead className="h-8 px-2 py-1.5 w-[72px] text-right whitespace-nowrap font-semibold text-foreground">
              Importe
            </TableHead>
            <TableHead className="h-8 px-2 py-1.5 font-semibold text-foreground">Detalles</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const isAppointment = Boolean(row.appointmentId && row.appointmentDate && onAppointmentClick);
            const isConsent = Boolean(row.consentId);
            return (
            <TableRow
              key={row.id}
              className={cn(
                'hover:bg-muted/30',
                row.muted && 'bg-muted/20',
                isAppointment && 'cursor-pointer hover:bg-sky-50/80 dark:hover:bg-sky-950/30',
                row.isFutureAppointment && 'bg-emerald-50/55 dark:bg-emerald-950/20',
                isConsent && 'cursor-pointer hover:bg-sky-50/80 dark:hover:bg-sky-950/30',
              )}
              onClick={() => {
                if (isAppointment) onAppointmentClick!(row.appointmentId!, row.appointmentDate!);
                else if (isConsent && row.consentId) void openConsent(row.consentId);
              }}
              title={
                isAppointment ? 'Abrir cita en la agenda' : isConsent ? 'Ver consentimiento' : undefined
              }
            >
              <TableCell className="px-2 py-1.5 align-middle whitespace-nowrap text-muted-foreground tabular-nums">
                {row.dateLabel}
              </TableCell>
              <TableCell className="px-2 py-1.5 align-middle whitespace-nowrap text-muted-foreground tabular-nums">
                {row.time || '—'}
              </TableCell>
              <TableCell
                className="px-2 py-1.5 align-middle truncate text-foreground"
                title={row.employee}
              >
                {row.employee || '—'}
              </TableCell>
              <TableCell className="px-2 py-1.5 align-middle text-right whitespace-nowrap tabular-nums font-medium text-foreground">
                {row.price || '—'}
              </TableCell>
              <TableCell
                className={cn(
                  'px-2 py-1.5 align-middle min-w-0 max-w-0 w-full',
                  row.muted ? 'text-muted-foreground italic' : 'text-foreground',
                )}
                title={row.details}
              >
                <div className="flex items-center min-w-0 gap-1">
                  <span className="truncate flex-1 min-w-0">{row.details}</span>
                  {row.appointmentStatusLabel ? (
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                        row.isFutureAppointment
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {row.appointmentStatusLabel}
                    </span>
                  ) : null}
                  {row.attachments ? (
                    <AppointmentAttachmentIcons
                      attachments={row.attachments}
                      className="ml-1"
                      iconClassName="h-3.5 w-3.5"
                    />
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {hasMoreAppointments && (
        <div className="flex justify-center border-t border-sky-100/80 dark:border-sky-900/40 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs"
            disabled={isFetching}
            onClick={() =>
              setAppointmentLimit((n) => n + CUSTOMER_APPOINTMENTS_TIMELINE_LIMIT)
            }
          >
            {isFetching ? 'Cargando…' : 'Cargar citas anteriores'}
          </Button>
        </div>
      )}
      <ConsentimientoViewerDialog
        consent={viewConsent}
        open={!!viewConsent}
        onOpenChange={(o) => !o && setViewConsent(null)}
      />
      {loadingConsent ? (
        <p className="sr-only" aria-live="polite">
          Cargando consentimiento…
        </p>
      ) : null}
    </div>
  );
};
