import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarDays, Pencil, Plus, Siren, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ClinicalHistoryRecordDialog } from '@/components/clinical/ClinicalHistoryRecordDialog';
import {
  clinicalHistoryToPrefillValues,
  clinicalHistoryOneLineSummary,
  fetchClinicalHistoryList,
  fetchCustomerBirthDate,
  type ClinicalHistoryRecord,
} from '@/lib/clinicalHistory';
import { formatAgeLabel } from '@/lib/patientAge';
import { cn } from '@/lib/utils';

interface Props {
  customerId: string;
  companyId?: string | null;
  customerName?: string | null;
  compact?: boolean;
}

function formatDateYmd(ymd: string): string {
  try {
    return format(parseISO(`${ymd}T12:00:00`), 'dd/MM/yyyy', { locale: es });
  } catch {
    return ymd;
  }
}

export const ClienteHistorialClinicoTab: React.FC<Props> = ({
  customerId,
  companyId,
  customerName,
  compact,
}) => {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<ClinicalHistoryRecord | null>(null);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['clinical_history_list', customerId],
    queryFn: () => fetchClinicalHistoryList(customerId),
  });

  const { data: birthDate = null } = useQuery({
    queryKey: ['customer_birth_date', customerId],
    queryFn: () => fetchCustomerBirthDate(customerId),
  });

  const newRecordInitialValues = useMemo(
    () => clinicalHistoryToPrefillValues(records[0] ?? null, birthDate),
    [records, birthDate],
  );

  const openNew = () => {
    setEditRecord(null);
    setEditorOpen(true);
  };

  const openEdit = (record: ClinicalHistoryRecord) => {
    setEditRecord(record);
    setEditorOpen(true);
  };

  const age = formatAgeLabel(birthDate);

  if (!companyId) {
    return (
      <p className={cn('text-center text-muted-foreground py-6 text-sm', compact && 'text-xs')}>
        No se puede guardar historial sin empresa del cliente.
      </p>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className={cn('text-xs text-muted-foreground', compact && 'text-[10px]')}>
          Cada visita se guarda como una consulta independiente. Al crear una nueva se precargan
          los datos de la última sesión para revisarlos o modificarlos.
        </p>
        <Button type="button" size="sm" className="h-8 shrink-0 gap-1" onClick={openNew}>
          <Plus className="w-3.5 h-3.5" />
          Nuevo
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : !records.length ? (
        <div
          className={cn(
            'rounded-lg border border-dashed text-center py-8 px-4 space-y-3',
            compact && 'py-6 text-xs',
          )}
        >
          <p className="text-muted-foreground">Aún no hay registros clínicos.</p>
          <Button type="button" size="sm" variant="secondary" className="gap-1" onClick={openNew}>
            <Stethoscope className="w-3.5 h-3.5" />
            Añadir primer registro
          </Button>
        </div>
      ) : (
        <ul className={cn('space-y-3', compact && 'text-xs')}>
          {records.map((r) => (
            <li
              key={r.id}
              className="overflow-hidden rounded-xl border bg-card shadow-sm transition-colors hover:border-sky-200"
            >
              <div className="flex flex-col gap-3 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-200">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDateYmd(r.fecha)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
                        <Stethoscope className="h-3.5 w-3.5" />
                        Consulta
                      </span>
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {clinicalHistoryOneLineSummary(r)}
                      </h3>
                      {birthDate && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          Fecha de nacimiento: {formatDateYmd(birthDate)}
                          {age ? ` (${age})` : ''}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1"
                      onClick={() => openEdit(r)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      AP
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {r.antecedentes_personales || r.descripcion || 'Sin datos'}
                    </p>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Motivo de consulta
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {r.motivo_consulta || 'Sin datos'}
                    </p>
                  </div>

                  <div className="rounded-lg border bg-muted/30 p-3">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      Tratamiento
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {r.tratamiento || 'Sin datos'}
                    </p>
                  </div>
                </div>

                {r.aviso_text && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900/70 dark:bg-amber-950/20">
                    <div className="flex items-start gap-2">
                      <Siren className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
                      <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-amber-800 dark:text-amber-200">
                          Aviso a recepción
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-amber-950 dark:text-amber-50">
                          {r.aviso_text}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {r.revisiones.length > 0 && (
                  <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                    Este registro contiene revisiones antiguas guardadas dentro de la consulta.
                    A partir de ahora las nuevas revisiones se registran creando una consulta nueva
                    con el botón <span className="font-medium text-foreground">Nuevo</span>.
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <ClinicalHistoryRecordDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        customerId={customerId}
        companyId={companyId}
        customerName={customerName?.trim() || 'Cliente'}
        birthDate={birthDate}
        record={editRecord}
        appointmentId={editRecord?.appointment_id ?? null}
        defaultFecha={editRecord?.fecha}
        overlayClassName="z-[115]"
        initialValues={editRecord ? null : newRecordInitialValues}
      />
    </>
  );
};
