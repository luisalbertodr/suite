
import React from 'react';
import { format } from 'date-fns';
import { CheckCircle, Clock, XCircle, Receipt, Banknote, FileText, Copy, Scissors, ClipboardPaste } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { AppointmentAttachmentIcons } from '@/components/AppointmentAttachmentIcons';
import { hasAttachmentHints } from '@/lib/appointmentAttachmentHints';
import { Employee, Appointment, TimeSlot } from '@/types/agenda';
import { slotOverlapsOccupiedTime } from '@/lib/agendaAppointmentItems';
import { segmentAppearance, segmentStyleFromHex } from '@/lib/agendaResourceColors';
import {
  anchorTimeFromScrollTop,
  loadAgendaViewPersisted,
  mergePersistedScroll,
  saveAgendaViewPersisted,
} from '@/lib/agendaViewPersistence';
import {
  DEFAULT_AGENDA_CENTER_HOURS,
  generateAgendaSlots,
  getAgendaGridEnvelopeMinutes,
  hhmmToMinutes,
  slotBookableForAgenda,
  type AgendaDayHoursMap,
  type AgendaUnavailabilityEntry,
} from '@/lib/agendaHours';

export type AgendaSlotClickOptions = { forceNew?: boolean };

interface AgendaGridProps {
  employees: Employee[];
  appointments: Appointment[];
  onSlotClick: (employeeId: string, time: string, opts?: AgendaSlotClickOptions) => void;
  onAppointmentClick?: (appointment: Appointment) => void;
  onAppointmentMove?: (appointmentId: string, newEmployeeId: string, newTime: string) => void;
  appointmentClipboard?: { mode: 'copy' | 'cut' } | null;
  onAppointmentCopy?: (appointment: Appointment) => void;
  onAppointmentCut?: (appointment: Appointment) => void;
  onSlotPaste?: (employeeId: string, time: string) => void;
  /** Usuario autenticado: restaura/guarda scroll y día en localStorage */
  persistUserId?: string | null;
  /** yyyy-MM-dd: clave del scroll guardado por día */
  viewDateYmd?: string;
  /** Incrementar al pulsar «Hoy» en la agenda: scroll a la hora actual */
  goToTodayRequestId?: number;
  /** Solicitud de scroll a hora específica (por ejemplo, deep-link de notificación) */
  scrollToTimeRequest?: { requestId: number; time: string } | null;
  centerHours?: AgendaDayHoursMap;
  employeeAgendaById?: Record<
    string,
    { weekly: AgendaDayHoursMap | null; blocks: AgendaUnavailabilityEntry[] }
  >;
  slotMinutes?: 15 | 30;
  cellHeight?: number;
  visibleFields?: {
    clientName: boolean;
    service: boolean;
    description: boolean;
    timeRange: boolean;
    status: boolean;
    legacyCodes: boolean;
  };
}

/** Ancho de la columna «Hora» (px); debe coincidir con gridTemplateColumns. */
const TIME_GUTTER_PX = 96;

/** Ancho mínimo de la zona de empleadas (sin columna hora). */
const GRID_MIN_EMPLOYEES_PX = 900 - TIME_GUTTER_PX;

/** Mitad aproximada de la pastilla de etiqueta horaria (px). */
const HOUR_LABEL_HALF_PX = 8;

/** Franjas fuera de horario en columna hora (fondo transparente para no tapar etiquetas). */
const UNAVAILABLE_TIME_GUTTER_TRANSPARENT =
  'text-neutral-700 dark:text-neutral-300 [background-image:repeating-linear-gradient(-45deg,transparent,transparent_5px,rgba(0,0,0,0.07)_5px,rgba(0,0,0,0.07)_10px)] dark:[background-image:repeating-linear-gradient(-45deg,transparent,transparent_5px,rgba(255,255,255,0.04)_5px,rgba(255,255,255,0.04)_10px)]';
const UNAVAILABLE_CELL =
  'bg-neutral-200/95 dark:bg-neutral-900/90 [background-image:repeating-linear-gradient(-45deg,transparent,transparent_5px,rgba(0,0,0,0.055)_5px,rgba(0,0,0,0.055)_10px)] dark:[background-image:repeating-linear-gradient(-45deg,transparent,transparent_5px,rgba(255,255,255,0.04)_5px,rgba(255,255,255,0.04)_10px)]';
const UNAVAILABLE_CELL_BLOCKED = `${UNAVAILABLE_CELL} cursor-not-allowed`;

/** Descripción legacy tipo `[16:00] 214 - SERVICIO` (ya parseada en servicio/hora). */
const LEGACY_DESCRIPTION_RE = /^\[\d{1,2}:\d{2}\]\s*[^\s-]+\s*-\s*.+$/;

const timeToMinutes = (hhmm: string): number => hhmmToMinutes(hhmm);

const formatSlotTimeRange = (appointment: Appointment): string => {
  const end =
    appointment.timeSegments?.length
      ? appointment.timeSegments[appointment.timeSegments.length - 1]!.endTime
      : appointment.occupiedEndTime || appointment.endTime;
  return `${appointment.startTime} - ${end}`;
};

/** Comentarios/notas del slot omitiendo texto ya mostrado en horario o servicios. */
const slotDescriptionText = (appointment: Appointment): string | null => {
  const raw = (appointment.description || '').trim();
  if (!raw) return null;
  if (LEGACY_DESCRIPTION_RE.test(raw)) return null;

  const serviceLine = [appointment.serviceCode, appointment.serviceName].filter(Boolean).join(' - ');
  if (serviceLine && raw === serviceLine) return null;
  if (appointment.serviceName && raw === appointment.serviceName.trim()) return null;

  const segmentText = (appointment.timeSegments ?? [])
    .map((s) => (s.recursoName ? `${s.label} [${s.recursoName}]` : s.label))
    .join(' · ');
  if (segmentText && raw === segmentText) return null;

  const timeLine = formatSlotTimeRange(appointment);
  if (raw === timeLine || raw === `${appointment.startTime} - ${appointment.endTime}`) return null;

  return raw;
};

const SHORT_NAME_PREFIXES = new Set(['dr', 'dr.', 'dra', 'dra.', 'doctor', 'doctora']);

const agendaEmployeeShortName = (name: string): string => {
  const words = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length <= 1) return String(name || '').trim();
  const first = words[0].toLowerCase();
  if (SHORT_NAME_PREFIXES.has(first)) {
    return words.slice(0, 2).join(' ');
  }
  return words[0];
};

type AgendaVisibleFields = NonNullable<AgendaGridProps['visibleFields']>;

function buildOccupiedSlotKeySet(
  appointments: Appointment[],
  timeSlots: TimeSlot[],
  slotMinutes: number,
): Set<string> {
  const occupied = new Set<string>();
  if (!timeSlots.length) return occupied;

  for (const apt of appointments) {
    for (const slot of timeSlots) {
      const slotStart = timeToMinutes(slot.time);
      const slotEnd = slotStart + slotMinutes;
      if (
        slotOverlapsOccupiedTime(
          slotStart,
          slotEnd,
          apt.startTime,
          apt.timeSegments,
          apt.occupiedEndTime || apt.endTime,
        )
      ) {
        occupied.add(`${apt.employeeId}|${slot.time}`);
      }
    }
  }
  return occupied;
}

function visibleFieldsEqual(a?: AgendaVisibleFields, b?: AgendaVisibleFields): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.clientName === b.clientName &&
    a.service === b.service &&
    a.description === b.description &&
    a.timeRange === b.timeRange &&
    a.status === b.status &&
    a.legacyCodes === b.legacyCodes
  );
}

function appointmentsSignature(appointments: Appointment[]): string {
  return appointments
    .map((a) => {
      const segments = (a.timeSegments ?? [])
        .map((s) => `${s.startTime}-${s.endTime}-${s.label}-${s.recursoColor ?? ''}-${s.recursoName ?? ''}`)
        .join(',');
      const attachments = a.attachments
        ? `${a.attachments.photos ? 1 : 0}-${a.attachments.documents ? 1 : 0}-${a.attachments.signedConsents ? 1 : 0}`
        : '';
      return [
        a.id,
        a.employeeId,
        a.startTime,
        a.endTime,
        a.occupiedEndTime ?? '',
        a.status,
        a.paymentStatus ?? '',
        a.clientName,
        a.serviceName ?? '',
        a.serviceCode ?? '',
        a.description ?? '',
        a.totalAmount ?? '',
        (a.paymentOnlyLabels ?? []).join(','),
        segments,
        attachments,
      ].join('\x00');
    })
    .join('\x1e');
}

function agendaGridPropsAreEqual(prev: AgendaGridProps, next: AgendaGridProps): boolean {
  if (prev.employees.length !== next.employees.length) return false;
  for (let i = 0; i < prev.employees.length; i++) {
    const prevEmp = prev.employees[i]!;
    const nextEmp = next.employees[i]!;
    if (prevEmp.id !== nextEmp.id || prevEmp.name !== nextEmp.name || prevEmp.color !== nextEmp.color) {
      return false;
    }
  }

  if (appointmentsSignature(prev.appointments) !== appointmentsSignature(next.appointments)) {
    return false;
  }

  if (prev.appointmentClipboard?.mode !== next.appointmentClipboard?.mode) return false;
  if (prev.persistUserId !== next.persistUserId) return false;
  if (prev.viewDateYmd !== next.viewDateYmd) return false;
  if (prev.goToTodayRequestId !== next.goToTodayRequestId) return false;
  if (prev.scrollToTimeRequest?.requestId !== next.scrollToTimeRequest?.requestId) return false;
  if (prev.scrollToTimeRequest?.time !== next.scrollToTimeRequest?.time) return false;
  if (prev.centerHours !== next.centerHours) return false;
  if (prev.employeeAgendaById !== next.employeeAgendaById) return false;
  if (prev.slotMinutes !== next.slotMinutes) return false;
  if (prev.cellHeight !== next.cellHeight) return false;
  if (!visibleFieldsEqual(prev.visibleFields, next.visibleFields)) return false;

  return true;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'confirmed':
      return <CheckCircle className="w-4 h-4 text-green-600" />;
    case 'pending':
      return <Clock className="w-4 h-4 text-yellow-600" />;
    case 'cancelled':
      return <XCircle className="w-4 h-4 text-red-600" />;
    default:
      return <CheckCircle className="w-4 h-4 text-green-600" />;
  }
};

const getPaymentIcon = (paymentStatus?: Appointment['paymentStatus']) => {
  switch (paymentStatus) {
    case 'invoiced':
      return (
        <span title="Cobrada y facturada">
          <FileText className="w-3.5 h-3.5 text-sky-600 shrink-0" />
        </span>
      );
    case 'paid':
      return (
        <span title="Cobrada (TPV)">
          <Banknote className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        </span>
      );
    case 'pending_charge':
      return (
        <span title="Pendiente de cobro">
          <Receipt className="w-3.5 h-3.5 text-amber-600 shrink-0" />
        </span>
      );
    default:
      return null;
  }
};

type AgendaAppointmentBlockProps = {
  appointment: Appointment;
  employeeColor: string;
  visibleFields: AgendaVisibleFields;
  startMin: number;
  endMin: number;
  occupiedEndMin: number;
  displaySpan: number;
  lockedByPayment: boolean;
  slotDesc: string | null;
  outerRecursoStyle: ReturnType<typeof segmentStyleFromHex>;
  onDragStart: (e: React.DragEvent, appointment: Appointment) => void;
  onDragEnd: (e: React.DragEvent) => void;
};

const AgendaAppointmentBlock = React.memo(function AgendaAppointmentBlock({
  appointment,
  employeeColor,
  visibleFields,
  startMin,
  endMin,
  occupiedEndMin,
  displaySpan,
  lockedByPayment,
  slotDesc,
  outerRecursoStyle,
  onDragStart,
  onDragEnd,
}: AgendaAppointmentBlockProps) {
  const segments = appointment.timeSegments ?? [];

  return (
    <div
      className={`relative h-full p-0.5 text-[11px] overflow-hidden rounded border-2 ${lockedByPayment ? 'cursor-default' : 'cursor-move'} ${
        outerRecursoStyle ? 'border-border dark:border-border' : employeeColor
      }`}
      style={
        outerRecursoStyle
          ? {
              backgroundColor: outerRecursoStyle.backgroundColor,
              borderColor: outerRecursoStyle.borderColor,
            }
          : undefined
      }
      draggable={!lockedByPayment}
      onDragStart={(e) => onDragStart(e, appointment)}
      onDragEnd={onDragEnd}
    >
      {segments.map((seg) => {
        const segStart = timeToMinutes(seg.startTime);
        const segEnd = timeToMinutes(seg.endTime);
        const topPct = ((segStart - startMin) / displaySpan) * 100;
        const heightPct = Math.max(4, ((segEnd - segStart) / displaySpan) * 100);
        const { className: barClass, style } = segmentAppearance(seg.recursoColor, seg.kind);
        const title = [`${seg.startTime}–${seg.endTime}`, seg.label, seg.recursoName ? `→ ${seg.recursoName}` : '']
          .filter(Boolean)
          .join(' · ');
        return (
          <div
            key={seg.clientKey}
            className={`absolute left-0.5 right-0.5 pointer-events-none ${barClass}`}
            style={{ top: `${topPct}%`, height: `${heightPct}%`, ...style }}
            title={title}
          />
        );
      })}
      {segments.length > 0 && endMin > occupiedEndMin && (
        <div
          className="absolute left-0.5 right-0.5 rounded-sm border border-dashed border-muted-foreground/25 bg-background/30 pointer-events-none"
          style={{
            top: `${((occupiedEndMin - startMin) / displaySpan) * 100}%`,
            height: `${((endMin - occupiedEndMin) / displaySpan) * 100}%`,
          }}
          title="Tramo sin reserva de tiempo (solo cobros u holgura)"
        />
      )}
      <div className="relative z-[1] bg-card/95 dark:bg-card/90 rounded px-1.5 py-1 text-foreground font-medium h-full leading-tight overflow-hidden">
        <div className="flex items-center justify-between mb-0.5 gap-1">
          {visibleFields.clientName && (
            <div className="font-semibold truncate flex-1">{appointment.clientName}</div>
          )}
          <div className="flex items-center gap-0.5 shrink-0">
            {appointment.attachments && hasAttachmentHints(appointment.attachments) ? (
              <AppointmentAttachmentIcons attachments={appointment.attachments} iconClassName="h-3 w-3" />
            ) : null}
            {getPaymentIcon(appointment.paymentStatus)}
            {visibleFields.status && getStatusIcon(appointment.status)}
          </div>
        </div>
        {visibleFields.timeRange && (
          <div className="text-xs text-muted-foreground dark:text-foreground/80 truncate tabular-nums">
            {formatSlotTimeRange(appointment)}
          </div>
        )}
        {segments.length > 0 && visibleFields.service && (
          <div className="text-[10px] text-muted-foreground dark:text-foreground/85 truncate mt-0.5">
            {segments.map((s) => (s.recursoName ? `${s.label} [${s.recursoName}]` : s.label)).join(' · ')}
          </div>
        )}
        {visibleFields.service && !segments.length && appointment.serviceName && (
          <div className="text-xs text-muted-foreground dark:text-foreground/85 truncate mt-0.5 font-medium">
            {appointment.serviceCode ? `${appointment.serviceCode} - ` : ''}
            {appointment.serviceName}
          </div>
        )}
        {(appointment.paymentOnlyLabels?.length ?? 0) > 0 && (
          <div
            className="text-[10px] text-amber-800 dark:text-amber-200 truncate mt-0.5"
            title="Solo cobro, no reservan slot"
          >
            + {appointment.paymentOnlyLabels!.join(' · ')}
          </div>
        )}
        {slotDesc && (
          <div className="text-xs text-muted-foreground dark:text-foreground/80 truncate mt-0.5">{slotDesc}</div>
        )}
        {typeof appointment.totalAmount === 'number' && (
          <div className="text-xs text-foreground font-semibold truncate mt-0.5 tabular-nums">
            {appointment.totalAmount.toFixed(2)} EUR
          </div>
        )}
      </div>
    </div>
  );
});

type AgendaAppointmentItemProps = {
  appointment: Appointment;
  employeeIndex: number;
  employeeCount: number;
  employeeColor: string;
  overlap: { index: number; total: number };
  gridStartMin: number;
  gridEndMin: number;
  slotMinutes: number;
  cellHeight: number;
  visibleFields: AgendaVisibleFields;
  onAppointmentClick?: (appointment: Appointment) => void;
  onAppointmentCopy?: (appointment: Appointment) => void;
  onAppointmentCut?: (appointment: Appointment) => void;
  onDragStart: (e: React.DragEvent, appointment: Appointment) => void;
  onDragEnd: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent, employeeId: string, time: string) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, employeeId: string, time: string) => void;
};

const AgendaAppointmentItem = React.memo(function AgendaAppointmentItem({
  appointment,
  employeeIndex,
  employeeCount,
  employeeColor,
  overlap,
  gridStartMin,
  gridEndMin,
  slotMinutes,
  cellHeight,
  visibleFields,
  onAppointmentClick,
  onAppointmentCopy,
  onAppointmentCut,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: AgendaAppointmentItemProps) {
  const segments = appointment.timeSegments ?? [];
  let startMin = timeToMinutes(appointment.startTime);
  const storedEndMin = timeToMinutes(appointment.endTime);
  const occupiedEndMin = segments.length
    ? timeToMinutes(segments[segments.length - 1]!.endTime)
    : timeToMinutes(appointment.occupiedEndTime || appointment.endTime);
  let endMin = Math.max(storedEndMin, occupiedEndMin);
  if (endMin <= startMin && segments.length) {
    endMin = occupiedEndMin;
  }
  if (endMin <= startMin) return null;
  if (endMin <= gridStartMin || startMin >= gridEndMin) return null;
  if (startMin < gridStartMin) startMin = gridStartMin;
  if (endMin > gridEndMin) endMin = gridEndMin;

  const displaySpan = Math.max(1, endMin - startMin);
  const topPosition = ((startMin - gridStartMin) / slotMinutes) * cellHeight;
  const height = Math.max(((endMin - startMin) / slotMinutes) * cellHeight, cellHeight * 0.5);

  const colFrac = overlap.total > 0 ? overlap.index / overlap.total : 0;
  const left = `calc(${TIME_GUTTER_PX}px + (100% - ${TIME_GUTTER_PX}px) * ${employeeIndex / employeeCount} + (100% - ${TIME_GUTTER_PX}px) / ${employeeCount} * ${colFrac})`;
  const width = `calc((100% - ${TIME_GUTTER_PX}px) / ${employeeCount} / ${overlap.total})`;
  const slotDesc = visibleFields.description ? slotDescriptionText(appointment) : null;
  const lockedByPayment = appointment.paymentStatus === 'paid' || appointment.paymentStatus === 'invoiced';
  const singleSegmentColor = segments.length === 1 ? segments[0]?.recursoColor ?? null : null;
  const outerRecursoStyle = segmentStyleFromHex(singleSegmentColor);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild disabled={lockedByPayment}>
        <div
          className={`absolute z-20 hover:opacity-80 ${lockedByPayment ? 'cursor-default' : 'cursor-move'}`}
          style={{
            top: `${topPosition}px`,
            left,
            width,
            height: `${height}px`,
            paddingRight: '1px',
          }}
          onClick={() => onAppointmentClick?.(appointment)}
          onDragOver={(e) => onDragOver(e, appointment.employeeId, appointment.startTime)}
          onDragLeave={onDragLeave}
          onDrop={(e) => onDrop(e, appointment.employeeId, appointment.startTime)}
        >
          <AgendaAppointmentBlock
            appointment={appointment}
            employeeColor={employeeColor}
            visibleFields={visibleFields}
            startMin={startMin}
            endMin={endMin}
            occupiedEndMin={occupiedEndMin}
            displaySpan={displaySpan}
            lockedByPayment={lockedByPayment}
            slotDesc={slotDesc}
            outerRecursoStyle={outerRecursoStyle}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        </div>
      </ContextMenuTrigger>
      {!lockedByPayment && (onAppointmentCopy || onAppointmentCut) ? (
        <ContextMenuContent className="z-[130]">
          {onAppointmentCopy ? (
            <ContextMenuItem onClick={() => onAppointmentCopy(appointment)} className="gap-2">
              <Copy className="h-3.5 w-3.5" />
              Copiar
            </ContextMenuItem>
          ) : null}
          {onAppointmentCut ? (
            <ContextMenuItem onClick={() => onAppointmentCut(appointment)} className="gap-2">
              <Scissors className="h-3.5 w-3.5" />
              Cortar
            </ContextMenuItem>
          ) : null}
        </ContextMenuContent>
      ) : null}
    </ContextMenu>
  );
});

/** Altura mínima de la fila de nombres (compacta pero con texto xs legible). */
const EMPLOYEE_NAMES_ROW_MIN_H = '2rem';

function EmployeeNamesRow({
  employees,
  edge,
  variant = 'full',
}: {
  employees: Employee[];
  edge: 'top' | 'bottom';
  variant?: 'full' | 'names-only';
}) {
  if (employees.length === 0) return null;

  const namesCells = employees.map((employee) => (
    <div
      key={`${edge}-${employee.id}`}
      className={`flex items-center justify-center border-r border-border px-2 py-1 text-center text-xs font-semibold leading-tight text-foreground ${employee.color}`}
    >
      <span className="line-clamp-2" title={employee.name}>
        {agendaEmployeeShortName(employee.name)}
      </span>
    </div>
  ));

  if (variant === 'names-only') {
    return (
      <div
        className="grid gap-0"
        style={{
          gridTemplateColumns: `repeat(${employees.length}, minmax(0, 1fr))`,
          minHeight: EMPLOYEE_NAMES_ROW_MIN_H,
        }}
      >
        {namesCells}
      </div>
    );
  }

  return (
    <div
      className="grid gap-0"
      style={{
        gridTemplateColumns: `${TIME_GUTTER_PX}px repeat(${employees.length}, minmax(0, 1fr))`,
        minHeight: EMPLOYEE_NAMES_ROW_MIN_H,
      }}
    >
      <div className="sticky left-0 z-40 flex items-center justify-center border-r border-border bg-transparent px-3 py-1 text-center text-xs font-semibold leading-tight text-foreground">
        {edge === 'top' ? 'Hora' : '\u00a0'}
      </div>
      {namesCells}
    </div>
  );
}

export const AgendaGrid: React.FC<AgendaGridProps> = React.memo(function AgendaGridInner({
  employees,
  appointments,
  onSlotClick,
  onAppointmentClick,
  onAppointmentMove,
  appointmentClipboard = null,
  onAppointmentCopy,
  onAppointmentCut,
  onSlotPaste,
  persistUserId = null,
  viewDateYmd,
  goToTodayRequestId = 0,
  scrollToTimeRequest = null,
  centerHours: centerHoursProp,
  employeeAgendaById = {},
  slotMinutes = 15,
  cellHeight = 32,
  visibleFields = {
    clientName: true,
    service: true,
    description: true,
    timeRange: true,
    status: true,
    legacyCodes: false,
  },
}) {
  const scrollRootRef = React.useRef<HTMLDivElement>(null);
  const headerScrollRef = React.useRef<HTMLDivElement>(null);
  const footerScrollRef = React.useRef<HTMLDivElement>(null);
  const [scrollbarWidth, setScrollbarWidth] = React.useState(0);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewportHeight, setViewportHeight] = React.useState(0);
  const lastScrollTopRef = React.useRef(0);
  const lastHandledGoTodayRef = React.useRef(0);
  const lastHandledScrollToTimeRef = React.useRef(0);
  const lastHandledPersistedAnchorRef = React.useRef<string | null>(null);
  const scrollSaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [nowLineTick, setNowLineTick] = React.useState(0);

  const [draggedAppointment, setDraggedAppointment] = React.useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = React.useState<{ employeeId: string; time: string } | null>(null);

  const centerHours = centerHoursProp ?? DEFAULT_AGENDA_CENTER_HOURS;
  const { startMin: envStart, endMin: envEnd } = React.useMemo(
    () => getAgendaGridEnvelopeMinutes(centerHours),
    [centerHours],
  );
  const timeSlots = React.useMemo(
    () => generateAgendaSlots(envStart, envEnd, slotMinutes) as TimeSlot[],
    [envStart, envEnd, slotMinutes],
  );
  const hourMarkPositions = React.useMemo(
    () =>
      timeSlots
        .map((slot, idx) => ({ slot, y: idx * cellHeight }))
        .filter(({ slot }) => slot.minute === 0),
    [timeSlots, cellHeight],
  );
  const gridStartMin = timeSlots.length ? timeToMinutes(timeSlots[0].time) : envStart;
  const gridEndMin = timeSlots.length ? timeToMinutes(timeSlots[timeSlots.length - 1].time) + slotMinutes : envEnd;

  const isTodayView = viewDateYmd === format(new Date(), 'yyyy-MM-dd');

  React.useEffect(() => {
    if (!isTodayView) return;
    const bump = () => setNowLineTick((t) => t + 1);
    const id = setInterval(bump, 30_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') bump();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [isTodayView]);

  const occupiedSlotKeys = React.useMemo(
    () => buildOccupiedSlotKeySet(appointments, timeSlots, slotMinutes),
    [appointments, timeSlots, slotMinutes],
  );

  const isSlotOccupiedByAppointment = React.useCallback(
    (employeeId: string, time: string): boolean => occupiedSlotKeys.has(`${employeeId}|${time}`),
    [occupiedSlotKeys],
  );

  const employeeIndexById = React.useMemo(() => {
    const map = new Map<string, number>();
    employees.forEach((employee, index) => map.set(employee.id, index));
    return map;
  }, [employees]);

  // Funciones para drag & drop
  const handleDragStart = React.useCallback((e: React.DragEvent, appointment: Appointment) => {
    if (appointment.paymentStatus === 'paid' || appointment.paymentStatus === 'invoiced') {
      e.preventDefault();
      return;
    }
    setDraggedAppointment(appointment.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', appointment.id);
    
    // Agregar una clase visual al elemento que se está arrastrando
    const target = e.target as HTMLElement;
    target.style.opacity = '0.5';
  }, []);

  const handleDragEnd = React.useCallback((e: React.DragEvent) => {
    setDraggedAppointment(null);
    setDragOverSlot(null);
    
    // Restaurar la opacidad
    const target = e.target as HTMLElement;
    target.style.opacity = '1';
  }, []);

  const handleDragOver = React.useCallback((e: React.DragEvent, employeeId: string, time: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Solo permitir soltar en slots vacíos
    const isOccupied = isSlotOccupiedByAppointment(employeeId, time);
    if (!isOccupied) {
      setDragOverSlot({ employeeId, time });
    }
  }, [isSlotOccupiedByAppointment]);

  const handleDragLeave = React.useCallback((e: React.DragEvent) => {
    // Solo limpiar si realmente salimos del elemento
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const isInside = e.clientX >= rect.left && e.clientX <= rect.right && 
                     e.clientY >= rect.top && e.clientY <= rect.bottom;
    
    if (!isInside) {
      setDragOverSlot(null);
    }
  }, []);

  const handleDrop = React.useCallback((e: React.DragEvent, employeeId: string, time: string) => {
    e.preventDefault();
    
    const appointmentId = e.dataTransfer.getData('text/plain');
    if (appointmentId && draggedAppointment && onAppointmentMove) {
      // Verificar que el slot esté disponible
      const isOccupied = isSlotOccupiedByAppointment(employeeId, time);
      if (!isOccupied) {
        onAppointmentMove(appointmentId, employeeId, time);
      }
    }
    
    setDraggedAppointment(null);
    setDragOverSlot(null);
  }, [draggedAppointment, isSlotOccupiedByAppointment, onAppointmentMove]);

  const isSlotHighlighted = React.useCallback((employeeId: string, time: string): boolean => {
    return dragOverSlot?.employeeId === employeeId && dragOverSlot?.time === time;
  }, [dragOverSlot]);

  const overlapMap = React.useMemo(() => {
    const byKey: Record<string, Appointment[]> = {};
    for (const apt of appointments) {
      const key = `${apt.employeeId}|${apt.startTime}`;
      if (!byKey[key]) byKey[key] = [];
      byKey[key].push(apt);
    }
    const out: Record<string, { index: number; total: number }> = {};
    for (const key of Object.keys(byKey)) {
      const items = byKey[key].slice().sort((a, b) => a.id.localeCompare(b.id));
      const total = items.length;
      items.forEach((apt, idx) => {
        out[apt.id] = { index: idx, total };
      });
    }
    return out;
  }, [appointments]);

  const scrollToAnchorTime = React.useCallback(
    (timeHhmm: string) => {
      const scrollEl = scrollRootRef.current;
      if (!scrollEl) return;
      const [hStr, mStr] = String(timeHhmm || '').split(':');
      const h = Number(hStr);
      const m = Number(mStr);
      if (!Number.isFinite(h) || !Number.isFinite(m)) return;

      const targetMin = h * 60 + m;
      const clamped = Math.max(gridStartMin, Math.min(gridEndMin, targetMin));
      const lineTopInGrid = ((clamped - gridStartMin) / slotMinutes) * cellHeight;
      const anchor = lineTopInGrid - scrollEl.clientHeight * 0.35;
      const maxScroll = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
      const top = Math.max(0, Math.min(anchor, maxScroll));
      scrollEl.scrollTop = top;
      lastScrollTopRef.current = top;
    },
    [gridStartMin, gridEndMin, slotMinutes, cellHeight],
  );

  const flushScrollToStorage = React.useCallback(() => {
    if (!persistUserId || !viewDateYmd) return;
    const el = scrollRootRef.current;
    let scrollTop: number;
    if (el) {
      scrollTop = el.scrollTop;
      lastScrollTopRef.current = scrollTop;
    } else {
      scrollTop = lastScrollTopRef.current;
      // Desmontaje sin DOM: no guardar 0 y borrar la posición previa.
      if (scrollTop <= 0) return;
    }
    const anchorTime =
      el && scrollTop > 0
        ? anchorTimeFromScrollTop(scrollTop, {
            headerHeight: 0,
            gridStartMin,
            gridEndMin,
            slotMinutes,
            cellHeight,
            viewportHeight: el.clientHeight,
          })
        : null;
    const prev = loadAgendaViewPersisted(persistUserId);
    saveAgendaViewPersisted(
      persistUserId,
      mergePersistedScroll(prev, viewDateYmd, scrollTop, anchorTime),
    );
  }, [persistUserId, viewDateYmd, gridStartMin, gridEndMin, slotMinutes, cellHeight]);

  React.useLayoutEffect(() => {
    if (!persistUserId || !viewDateYmd) return;
    const el = scrollRootRef.current;
    if (!el) return;

    const anchorKey = `${viewDateYmd}|${employees.length}|${slotMinutes}|${cellHeight}`;
    if (lastHandledPersistedAnchorRef.current === anchorKey) return;

    const p = loadAgendaViewPersisted(persistUserId);
    const savedTime = p?.timeByYmd?.[viewDateYmd];
    const run = () => {
      if (!scrollRootRef.current) return;
      if (savedTime) {
        scrollToAnchorTime(savedTime);
        return;
      }
      const top = p?.scrollByYmd[viewDateYmd] ?? 0;
      lastScrollTopRef.current = top;
      scrollRootRef.current.scrollTop = top;
    };

    run();
    const id = requestAnimationFrame(() => requestAnimationFrame(run));
    lastHandledPersistedAnchorRef.current = anchorKey;
    return () => cancelAnimationFrame(id);
  }, [
    persistUserId,
    viewDateYmd,
    employees.length,
    slotMinutes,
    cellHeight,
    appointments.length,
    scrollToAnchorTime,
  ]);

  /** Tras restaurar scroll guardado: «Hoy» vuelve a posicionar en la hora actual. */
  React.useLayoutEffect(() => {
    if (!goToTodayRequestId || goToTodayRequestId === lastHandledGoTodayRef.current) return;
    if (!viewDateYmd || viewDateYmd !== format(new Date(), 'yyyy-MM-dd')) return;
    const scrollEl = scrollRootRef.current;
    if (!scrollEl) return;
    lastHandledGoTodayRef.current = goToTodayRequestId;

    const d = new Date();
    const nowDec = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
    const clamped = Math.max(gridStartMin, Math.min(gridEndMin, nowDec));
    const lineTopInGrid = ((clamped - gridStartMin) / slotMinutes) * cellHeight;
    const anchor = lineTopInGrid - scrollEl.clientHeight * 0.35;
    const maxScroll = Math.max(0, scrollEl.scrollHeight - scrollEl.clientHeight);
    const run = () => {
      if (!scrollRootRef.current) return;
      scrollRootRef.current.scrollTop = Math.max(0, Math.min(anchor, maxScroll));
    };
    run();
    requestAnimationFrame(() => requestAnimationFrame(run));
  }, [goToTodayRequestId, viewDateYmd, gridStartMin, gridEndMin, slotMinutes, cellHeight]);

  React.useLayoutEffect(() => {
    if (!scrollToTimeRequest?.requestId) return;
    if (scrollToTimeRequest.requestId === lastHandledScrollToTimeRef.current) return;
    if (!scrollRootRef.current) return;
    if (!Number.isFinite(Number(String(scrollToTimeRequest.time || '').split(':')[0]))) return;

    lastHandledScrollToTimeRef.current = scrollToTimeRequest.requestId;
    const run = () => scrollToAnchorTime(scrollToTimeRequest.time);
    run();
    requestAnimationFrame(() => requestAnimationFrame(run));
  }, [scrollToTimeRequest, scrollToAnchorTime]);

  React.useEffect(() => {
    const el = scrollRootRef.current;
    if (!el) return;
    const syncViewport = () => {
      setScrollTop(el.scrollTop);
      setViewportHeight(el.clientHeight);
    };
    syncViewport();
    const ro = new ResizeObserver(syncViewport);
    ro.observe(el);

    const onScroll = () => {
      if (!scrollRootRef.current) return;
      lastScrollTopRef.current = scrollRootRef.current.scrollTop;
      setScrollTop(scrollRootRef.current.scrollTop);
      if (persistUserId && viewDateYmd) {
        if (scrollSaveTimerRef.current) clearTimeout(scrollSaveTimerRef.current);
        scrollSaveTimerRef.current = setTimeout(() => flushScrollToStorage(), 220);
      }
    };
    el.addEventListener('scroll', onScroll, { passive: true });

    const onHide = () => {
      if (document.visibilityState === 'hidden' && persistUserId && viewDateYmd) {
        flushScrollToStorage();
      }
    };
    const onPageHide = () => {
      if (persistUserId && viewDateYmd) flushScrollToStorage();
    };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onHide);

    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onHide);
      if (scrollSaveTimerRef.current) clearTimeout(scrollSaveTimerRef.current);
      if (persistUserId && viewDateYmd) flushScrollToStorage();
    };
  }, [employees.length, timeSlots.length, persistUserId, viewDateYmd, flushScrollToStorage]);

  /** Reserva el ancho de la barra vertical para alinear encabezado/pie con la cuadrícula. */
  React.useLayoutEffect(() => {
    const el = scrollRootRef.current;
    if (!el) return;
    const measure = () => {
      setScrollbarWidth(Math.max(0, el.offsetWidth - el.clientWidth));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [employees.length, timeSlots.length]);

  /** Sincroniza scroll horizontal entre encabezado, cuadrícula y pie. */
  React.useEffect(() => {
    const body = scrollRootRef.current;
    const header = headerScrollRef.current;
    const footer = footerScrollRef.current;
    if (!body) return;
    const syncFromBody = () => {
      const left = body.scrollLeft;
      if (header && header.scrollLeft !== left) header.scrollLeft = left;
      if (footer && footer.scrollLeft !== left) footer.scrollLeft = left;
    };
    body.addEventListener('scroll', syncFromBody, { passive: true });
    syncFromBody();
    return () => body.removeEventListener('scroll', syncFromBody);
  }, [employees.length]);

  const edgeRowPad = { paddingRight: scrollbarWidth };

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] bg-card">
      <div className="relative shrink-0 border-b border-border shadow-sm">
        <div
          className="pointer-events-none absolute left-0 top-0 z-[55] flex items-center justify-center border-r border-border bg-transparent px-3 py-1 text-center text-xs font-semibold leading-tight text-foreground"
          style={{ width: TIME_GUTTER_PX, minHeight: EMPLOYEE_NAMES_ROW_MIN_H }}
        >
          Hora
        </div>
        <div
          ref={headerScrollRef}
          className="overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ marginLeft: TIME_GUTTER_PX, ...edgeRowPad }}
        >
          <div style={{ minWidth: GRID_MIN_EMPLOYEES_PX }}>
            <EmployeeNamesRow employees={employees} edge="top" variant="names-only" />
          </div>
        </div>
      </div>

      <div className="relative min-h-0 h-full overflow-hidden">
      <div
        ref={scrollRootRef}
        className="h-full min-h-0 overflow-x-auto overflow-y-scroll"
      >
        <div className="min-w-[900px] relative">
        <div
          className="grid relative gap-0"
          style={{ gridTemplateColumns: `${TIME_GUTTER_PX}px repeat(${employees.length}, minmax(0, 1fr))` }}
        >
          {/* Renderizar las citas como elementos posicionados absolutamente */}
          {appointments.map((appointment) => {
            const employeeIndex = employeeIndexById.get(appointment.employeeId);
            if (employeeIndex === undefined) return null;

            return (
              <AgendaAppointmentItem
                key={appointment.id}
                appointment={appointment}
                employeeIndex={employeeIndex}
                employeeCount={employees.length}
                employeeColor={employees[employeeIndex]?.color ?? ''}
                overlap={overlapMap[appointment.id] || { index: 0, total: 1 }}
                gridStartMin={gridStartMin}
                gridEndMin={gridEndMin}
                slotMinutes={slotMinutes}
                cellHeight={cellHeight}
                visibleFields={visibleFields}
                onAppointmentClick={onAppointmentClick}
                onAppointmentCopy={onAppointmentCopy}
                onAppointmentCut={onAppointmentCut}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              />
            );
          })}

          {isTodayView && (() => {
            const d = new Date();
            const nowDec = d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
            const clamped = Math.max(gridStartMin, Math.min(gridEndMin, nowDec));
            const topPx = ((clamped - gridStartMin) / slotMinutes) * cellHeight;
            return (
              <div
                key={`agenda-now-line-${nowLineTick}`}
                className="pointer-events-none absolute left-0 right-0 z-[25]"
                style={{
                  top: `${topPx}px`,
                  height: 0,
                  borderTop: '2px solid rgb(220 38 38)',
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.6)',
                }}
                aria-hidden
              />
            );
          })()}

          {/* Renderizar todas las celdas del grid */}
          {timeSlots.map((slot) => {
            const isHourMark = slot.minute === 0;
            const dateKey = viewDateYmd ?? format(new Date(), 'yyyy-MM-dd');
            const slotS = timeToMinutes(slot.time);
            const slotE = slotS + slotMinutes;
            const { centerOpen } = slotBookableForAgenda(dateKey, slotS, slotE, centerHours, null, []);
            const timeShade = !centerOpen;

            return (
              <div key={slot.time} className="contents">
                {/* Columna de tiempo — etiqueta sobre la línea del slot */}
                <div
                  className={`sticky left-0 z-[26] relative overflow-visible border-r border-border ${
                    isHourMark ? 'border-t-2 border-border bg-transparent' : 'border-t border-border bg-transparent'
                  } ${timeShade ? UNAVAILABLE_TIME_GUTTER_TRANSPARENT : ''}`}
                  style={{ height: `${cellHeight}px`, minHeight: `${cellHeight}px` }}
                >
                  {!isHourMark ? (
                    <span
                      className={`absolute left-0 right-0 top-0 z-[1] -translate-y-1/2 text-center leading-none px-2.5 text-xs font-medium text-muted-foreground dark:text-foreground/75 tabular-nums ${
                        timeShade ? '!text-neutral-700 dark:!text-neutral-300' : ''
                      }`}
                    >
                      <span
                        className={`inline-block rounded-sm px-1.5 bg-card/80 ring-1 ring-border/30 ${
                          timeShade ? 'bg-card/90 dark:bg-card/85' : ''
                        }`}
                      >
                        {slot.time}
                      </span>
                    </span>
                  ) : null}
                </div>

                {/* Columnas de empleados - siempre renderizar todas las celdas */}
                {employees.map((employee) => {
                  const isOccupied = isSlotOccupiedByAppointment(employee.id, slot.time);
                  const isHighlighted = isSlotHighlighted(employee.id, slot.time);
                  const meta = employeeAgendaById[employee.id] ?? { weekly: null, blocks: [] };
                  const { bookable, blocked, schedulingAllowed } = slotBookableForAgenda(
                    dateKey,
                    slotS,
                    slotE,
                    centerHours,
                    meta.weekly,
                    meta.blocks,
                  );
                  const shade = !bookable && !isOccupied;
                  const canSchedule = !isOccupied && schedulingAllowed;
                  const canPaste = canSchedule && !!appointmentClipboard && !!onSlotPaste;
                  const pasteHint = canPaste
                    ? appointmentClipboard!.mode === 'cut'
                      ? 'Clic para mover la cita aquí (Mayús+clic = nueva cita)'
                      : 'Clic para pegar la cita (Mayús+clic = nueva cita)'
                    : undefined;

                  const slotCell = (
                    <div
                      className={`relative border-r border-border transition-colors ${
                        isHourMark ? 'border-t-2 border-border' : 'border-t border-border'
                      } ${
                        isOccupied
                          ? 'bg-muted/50'
                          : shade
                            ? blocked
                              ? UNAVAILABLE_CELL_BLOCKED
                              : `${UNAVAILABLE_CELL} cursor-pointer hover:bg-accent/50`
                            : 'bg-card cursor-pointer hover:bg-accent/40'
                      } ${isHighlighted ? 'bg-blue-100 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700' : ''} ${
                        canPaste ? 'ring-1 ring-inset ring-emerald-400/50 dark:ring-emerald-600/40' : ''
                      }`}
                      style={{ height: `${cellHeight}px` }}
                      title={
                        pasteHint ??
                        (shade && canSchedule
                          ? 'Fuera del horario habitual — clic para cita excepcional'
                          : blocked
                            ? 'No disponible (bloqueo de agenda)'
                            : undefined)
                      }
                      onClick={(e) => {
                        if (!canSchedule) return;
                        onSlotClick(employee.id, slot.time, { forceNew: e.shiftKey });
                      }}
                      onDragOver={(e) => canSchedule && handleDragOver(e, employee.id, slot.time)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => canSchedule && handleDrop(e, employee.id, slot.time)}
                    />
                  );

                  if (!canPaste) {
                    return <React.Fragment key={`${employee.id}-${slot.time}`}>{slotCell}</React.Fragment>;
                  }

                  return (
                    <ContextMenu key={`${employee.id}-${slot.time}`}>
                      <ContextMenuTrigger asChild>{slotCell}</ContextMenuTrigger>
                      <ContextMenuContent className="z-[130]">
                        <ContextMenuItem
                          className="gap-2"
                          onClick={() => onSlotPaste!(employee.id, slot.time)}
                        >
                          <ClipboardPaste className="h-3.5 w-3.5" />
                          {appointmentClipboard!.mode === 'cut' ? 'Pegar (mover)' : 'Pegar'}
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem onClick={() => onSlotClick(employee.id, slot.time, { forceNew: true })}>
                          Nueva cita vacía
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  );
                })}
              </div>
            );
          })}
        </div>
        </div>
      </div>

      <div
        className="pointer-events-none absolute left-0 top-0 z-[55] overflow-hidden"
        style={{ width: TIME_GUTTER_PX, height: viewportHeight || undefined }}
        aria-hidden
      >
        {hourMarkPositions.map(({ slot, y }) => {
          const yViewport = y - scrollTop;
          if (yViewport < -HOUR_LABEL_HALF_PX || yViewport > viewportHeight + HOUR_LABEL_HALF_PX) {
            return null;
          }
          const top = Math.max(2, yViewport - HOUR_LABEL_HALF_PX);
          const dateKey = viewDateYmd ?? format(new Date(), 'yyyy-MM-dd');
          const slotS = timeToMinutes(slot.time);
          const slotE = slotS + slotMinutes;
          const { centerOpen } = slotBookableForAgenda(dateKey, slotS, slotE, centerHours, null, []);
          const timeShade = !centerOpen;
          return (
            <div
              key={`hour-label-${slot.time}`}
              className="absolute left-0 right-0 flex justify-center"
              style={{ top }}
            >
              <span
                className={`inline-block rounded-sm px-1.5 text-sm font-semibold text-foreground tabular-nums leading-none bg-card shadow-sm ring-1 ring-border/50 ${
                  timeShade ? 'text-neutral-700 dark:text-neutral-300' : ''
                }`}
              >
                {slot.time}
              </span>
            </div>
          );
        })}
      </div>
      </div>

      <div className="relative shrink-0 border-t border-border shadow-[0_-2px_4px_rgba(0,0,0,0.04)]">
        <div
          className="pointer-events-none absolute left-0 top-0 z-[55] flex items-center justify-center border-r border-border bg-transparent"
          style={{ width: TIME_GUTTER_PX, minHeight: EMPLOYEE_NAMES_ROW_MIN_H }}
          aria-hidden
        >
          {'\u00a0'}
        </div>
        <div
          ref={footerScrollRef}
          className="overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          style={{ marginLeft: TIME_GUTTER_PX, ...edgeRowPad }}
        >
          <div style={{ minWidth: GRID_MIN_EMPLOYEES_PX }}>
            <EmployeeNamesRow employees={employees} edge="bottom" variant="names-only" />
          </div>
        </div>
      </div>
    </div>
  );
}, agendaGridPropsAreEqual);
