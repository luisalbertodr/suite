import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronRight, Plus, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ClinicalHistoryRecordDialog } from '@/components/clinical/ClinicalHistoryRecordDialog';
import {
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

function ClinicalHistoryDetailDialog({
  record,
  birthDate,
  open,
  onOpenChange,
  onEdit,
}: {
  record: ClinicalHistoryRecord | null;
  birthDate: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: () => void;
}) {
  if (!record) return null;
  const age = formatAgeLabel(birthDate);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto" overlayClassName="z-[110]">
        <DialogHeader>
          <DialogTitle className="text-base">
            {formatDateYmd(record.fecha)}
            {record.motivo_consulta ? ` · ${record.motivo_consulta}` : ''}
          </DialogTitle>
        </DialogHeader>
        <dl className="space-y-3 text-sm">
          {birthDate && (
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Fecha de nacimiento</dt>
              <dd>
                {formatDateYmd(birthDate)}
                {age ? ` (${age})` : ''}
              </dd>
            </div>
          )}
          {(record.antecedentes_personales || record.descripcion) && (
            <div>
              <dt className="text-xs font-medium text-muted-foreground">AP</dt>
              <dd className="whitespace-pre-wrap">
                {record.antecedentes_personales || record.descripcion}
              </dd>
            </div>
          )}
          {record.motivo_consulta && (
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Motivo de consulta</dt>
              <dd className="whitespace-pre-wrap">{record.motivo_consulta}</dd>
            </div>
          )}
          {record.tratamiento && (
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Tratamiento</dt>
              <dd className="whitespace-pre-wrap">{record.tratamiento}</dd>
            </div>
          )}
          {(record.proxima_revision_fecha || record.proxima_revision_descripcion) && (
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Próxima revisión</dt>
              <dd>
                {record.proxima_revision_fecha
                  ? formatDateYmd(record.proxima_revision_fecha)
                  : '—'}
                {record.proxima_revision_descripcion
                  ? ` — ${record.proxima_revision_descripcion}`
                  : ''}
              </dd>
            </div>
          )}
          {record.aviso_text && (
            <div>
              <dt className="text-xs font-medium text-muted-foreground">Aviso</dt>
              <dd className="whitespace-pre-wrap">{record.aviso_text}</dd>
            </div>
          )}
        </dl>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            Editar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export const ClienteHistorialClinicoTab: React.FC<Props> = ({
  customerId,
  companyId,
  customerName,
  compact,
}) => {
  const [selected, setSelected] = useState<ClinicalHistoryRecord | null>(null);
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

  const openNew = () => {
    setEditRecord(null);
    setEditorOpen(true);
  };

  const openEdit = (record: ClinicalHistoryRecord) => {
    setSelected(null);
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
          Registros de consulta. También puedes rellenarlos desde la cita en Agenda.
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
        <ul className={cn('divide-y rounded-lg border', compact && 'text-xs')}>
          {records.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                onClick={() => setSelected(r)}
              >
                <Stethoscope className="w-3.5 h-3.5 shrink-0 text-sky-600" />
                <span className="shrink-0 tabular-nums text-muted-foreground w-[4.5rem]">
                  {formatDateYmd(r.fecha)}
                </span>
                <span className="flex-1 min-w-0 truncate text-sm">
                  {clinicalHistoryOneLineSummary(r)}
                </span>
                <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ClinicalHistoryDetailDialog
        record={selected}
        birthDate={birthDate}
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
        onEdit={() => selected && openEdit(selected)}
      />

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
      />
    </>
  );
};
