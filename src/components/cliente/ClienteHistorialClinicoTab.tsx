import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { Pencil, Plus, Stethoscope, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { ClinicalHistoryRecordDialog } from '@/components/clinical/ClinicalHistoryRecordDialog';
import { ClinicalHistoryVisitTimeline } from '@/components/clinical/ClinicalHistoryVisitTimeline';
import {
  buildAntecedentesHistory,
  clinicalHistoryToPrefillValues,
  deleteClinicalHistory,
  fetchClinicalHistoryList,
  fetchCustomerBirthDate,
  type ClinicalHistoryRecord,
} from '@/lib/clinicalHistory';
import { formatAgeLabel } from '@/lib/patientAge';
import { useToast } from '@/hooks/use-toast';
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<ClinicalHistoryRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClinicalHistoryRecord | null>(null);

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

  const apHistory = useMemo(() => buildAntecedentesHistory(records), [records]);
  const age = formatAgeLabel(birthDate);

  const previousForDialog = useMemo(() => {
    if (!editRecord?.id) return records;
    return records.filter((r) => r.id !== editRecord.id);
  }, [records, editRecord?.id]);

  const deleteMutation = useMutation({
    mutationFn: async (recordId: string) => deleteClinicalHistory(recordId),
    onSuccess: (_data, recordId) => {
      queryClient.invalidateQueries({ queryKey: ['clinical_history_list', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer_detail', customerId] });
      if (deleteTarget?.appointment_id) {
        queryClient.invalidateQueries({
          queryKey: ['clinical_history_appointment', deleteTarget.appointment_id],
        });
      }
      if (editRecord?.id === recordId) {
        setEditorOpen(false);
        setEditRecord(null);
      }
      setDeleteTarget(null);
      toast({ title: 'Consulta eliminada' });
    },
    onError: (err: Error) => {
      toast({
        title: 'No se pudo eliminar',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const openNew = () => {
    setEditRecord(null);
    setEditorOpen(true);
  };

  const openEdit = (record: ClinicalHistoryRecord) => {
    setEditRecord(record);
    setEditorOpen(true);
  };

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
          Cada visita se guarda como consulta independiente. En visitas sucesivas verás el historial
          completo y solo rellenarás lo de ese día (los antecedentes se precargan para ampliarlos si
          hace falta).
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
        <div className="space-y-4">
          <div
            className={cn(
              'rounded-xl border bg-card/40 p-4 space-y-3',
              compact && 'p-3 space-y-2',
            )}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Perfil clínico
            </p>
            {(birthDate || age) && (
              <p className="text-sm text-muted-foreground">
                {birthDate ? `Nacimiento: ${formatDateYmd(birthDate)}` : null}
                {birthDate && age ? ' · ' : null}
                {age ? `Edad: ${age}` : null}
              </p>
            )}
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Antecedentes personales
              </p>
              {apHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin antecedentes registrados</p>
              ) : (
                <ul className="space-y-2">
                  {apHistory.map((entry, index) => {
                    const isVigente = index === apHistory.length - 1;
                    return (
                      <li
                        key={entry.recordId}
                        className={cn(
                          'rounded-lg border px-3 py-2 text-sm',
                          isVigente
                            ? 'border-sky-200 bg-sky-50/50 dark:border-sky-900/50 dark:bg-sky-950/20'
                            : 'bg-muted/30',
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-[11px] font-medium text-sky-700 dark:text-sky-300 tabular-nums">
                            {formatDateYmd(entry.fecha)}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {entry.isInitial ? 'Registro inicial' : 'Añadido (solo novedades)'}
                          </span>
                          {isVigente && (
                            <span className="text-[10px] font-medium uppercase tracking-wide text-sky-700 dark:text-sky-300">
                              Vigente
                            </span>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap text-sm">{entry.text}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <ClinicalHistoryVisitTimeline
            records={records}
            order="asc"
            compact={compact}
            omitAntecedentes
            title="Consultas"
            renderActions={(diff) => (
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => openEdit(diff.record)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Eliminar consulta"
                  title="Eliminar consulta"
                  onClick={() => setDeleteTarget(diff.record)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
          />
        </div>
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
        previousRecords={previousForDialog}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent className="z-[120]">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta consulta?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Se borrará la consulta del ${formatDateYmd(deleteTarget.fecha)}. Esta acción no se puede deshacer.`
                : 'Esta acción no se puede deshacer.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending || !deleteTarget}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
            >
              {deleteMutation.isPending ? 'Eliminando…' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
