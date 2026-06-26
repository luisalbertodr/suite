import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { QuestionnaireFieldInput } from '@/components/questionnaire/QuestionnaireFieldInput';
import {
  FACIAL_CORPORAL_PATIENT_PERSONAL_FIELDS,
  FACIAL_CORPORAL_PATIENT_SECTIONS,
} from '@/lib/questionnaires/facialCorporal2026Schema';
import {
  fetchQuestionnaireCustomer,
  flattenClinicalProfileToAnswers,
  getClinicalProfileAmendments,
  saveClinicalProfileAmendment,
} from '@/lib/questionnaireApi';
import type { ClinicalProfileAmendment } from '@/lib/questionnaireTypes';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { History, Loader2, PencilLine } from 'lucide-react';
import { cn } from '@/lib/utils';

const AMENDMENT_SECTIONS = FACIAL_CORPORAL_PATIENT_SECTIONS.filter(
  (s) => s.role === 'patient' && s.id !== 'visita_actual' && (!s.visitModes || s.visitModes.includes('initial')),
);

const DIALOG_LAYER = 'z-[130]';

type Props = {
  customerId: string | null;
  customerName?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId?: string | null;
};

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function AmendmentHistoryItem({ item }: { item: ClinicalProfileAmendment }) {
  const fieldKeys = item.fields ? Object.keys(item.fields) : [];
  return (
    <li className="rounded-md border bg-muted/20 px-3 py-2 text-sm space-y-1">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="font-medium tabular-nums">
          {format(new Date(item.amended_at), 'dd/MM/yyyy', { locale: es })}
        </span>
        <span className="text-[10px] text-muted-foreground">
          registrado {format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
        </span>
      </div>
      <p className="whitespace-pre-wrap">{item.note}</p>
      {fieldKeys.length > 0 ? (
        <p className="text-[10px] text-muted-foreground">
          Campos actualizados: {fieldKeys.length}
        </p>
      ) : null}
    </li>
  );
}

export function QuestionnaireAmendmentDialog({
  customerId,
  customerName,
  open,
  onOpenChange,
  employeeId,
}: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [amendedAt, setAmendedAt] = useState(todayYmd);
  const [note, setNote] = useState('');
  const [fields, setFields] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [showFields, setShowFields] = useState(false);

  const { data: customer, isLoading } = useQuery({
    queryKey: ['questionnaire-amendment-customer', customerId],
    enabled: open && !!customerId,
    queryFn: () => fetchQuestionnaireCustomer(customerId!),
  });

  const amendments = useMemo(
    () => getClinicalProfileAmendments(customer?.clinical_profile ?? null),
    [customer?.clinical_profile],
  );

  useEffect(() => {
    if (!open) return;
    setAmendedAt(todayYmd());
    setNote('');
    setShowFields(false);
    if (customer) {
      setFields(flattenClinicalProfileToAnswers(customer.clinical_profile));
    }
  }, [open, customer?.id, customer?.clinical_profile]);

  const setField = (key: string, value: unknown) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!customerId) return;
    setBusy(true);
    try {
      await saveClinicalProfileAmendment({
        customerId,
        amendedAt: amendedAt,
        note,
        fields,
        employeeId,
      });
      await queryClient.invalidateQueries({ queryKey: ['questionnaire-amendment-customer', customerId] });
      await queryClient.invalidateQueries({ queryKey: ['customer-questionnaire-baseline', customerId] });
      await queryClient.invalidateQueries({ queryKey: ['customer-questionnaires', customerId] });
      toast({ title: 'Modificación registrada', description: `Fecha: ${format(new Date(amendedAt), 'dd/MM/yyyy', { locale: es })}` });
      setNote('');
      setAmendedAt(todayYmd());
      if (customer) {
        setFields(flattenClinicalProfileToAnswers(customer.clinical_profile));
      }
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Error al guardar', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName={DIALOG_LAYER}
        className={cn(DIALOG_LAYER, 'max-w-3xl max-h-[min(90vh,calc(100dvh-4rem))] flex flex-col overflow-hidden p-0 gap-0')}
      >
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2 pr-8">
            <PencilLine className="h-5 w-5 text-sky-700" />
            Modificaciones del cuestionario
            {customerName ? ` — ${customerName}` : ''}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Registre cambios en salud, hábitos o contraindicaciones con la fecha en que se aplican.
          </p>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-2 space-y-5">
          {amendments.length > 0 ? (
            <section className="space-y-2">
              <h3 className="text-sm font-medium flex items-center gap-1.5">
                <History className="h-4 w-4" />
                Historial ({amendments.length})
              </h3>
              <ul className="space-y-2 max-h-40 overflow-y-auto">
                {[...amendments].reverse().map((item) => (
                  <AmendmentHistoryItem key={item.id} item={item} />
                ))}
              </ul>
            </section>
          ) : null}

          {isLoading ? (
            <p className="text-sm text-muted-foreground py-4">Cargando perfil clínico…</p>
          ) : (
            <section className="space-y-3 border-t pt-4">
              <h3 className="text-sm font-medium">Nueva modificación</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Fecha de la modificación *</Label>
                  <Input
                    type="date"
                    value={amendedAt}
                    onChange={(e) => setAmendedAt(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div>
                <Label>Motivo / descripción del cambio *</Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={3}
                  placeholder="Ej.: Nueva medicación, cambio de embarazo, alergia detectada…"
                  className="mt-1"
                />
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowFields((v) => !v)}
              >
                {showFields ? 'Ocultar campos del cuestionario' : 'Editar campos del cuestionario'}
              </Button>

              {showFields ? (
                <div className="space-y-4 rounded-md border p-3 bg-muted/10">
                  <div className="grid sm:grid-cols-2 gap-3">
                    {FACIAL_CORPORAL_PATIENT_PERSONAL_FIELDS.map((field) => (
                      <QuestionnaireFieldInput
                        key={field.key}
                        field={field}
                        value={fields[field.key]}
                        onChange={(v) => setField(field.key, v)}
                      />
                    ))}
                  </div>
                  {AMENDMENT_SECTIONS.map((section) => (
                    <div key={section.id} className="space-y-2">
                      <p className="text-xs font-semibold text-sky-800">{section.title}</p>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {section.fields.map((field) => (
                          <QuestionnaireFieldInput
                            key={field.key}
                            field={field}
                            value={fields[field.key]}
                            onChange={(v) => setField(field.key, v)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0 gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          <Button onClick={() => void handleSave()} disabled={busy || !note.trim() || isLoading}>
            {busy ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                Guardando…
              </>
            ) : (
              'Guardar modificación'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
