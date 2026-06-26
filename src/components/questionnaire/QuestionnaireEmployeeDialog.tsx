import React, { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { QuestionnaireFieldInput } from '@/components/questionnaire/QuestionnaireFieldInput';
import { FACIAL_CORPORAL_EMPLOYEE_SECTIONS, FACIAL_CORPORAL_PATIENT_SECTIONS } from '@/lib/questionnaires/facialCorporal2026Schema';
import {
  completeQuestionnaire,
  fetchQuestionnaire,
  fetchQuestionnaireCustomer,
  getVisitModeFromAnswers,
  returnQuestionnaireToPatient,
  saveTechnicalData,
  startTechnicalPhase,
  validateTechnicalSections,
  VISIT_MODE_LABELS,
} from '@/lib/questionnaireApi';
import { QUESTIONNAIRE_STATUS_LABELS, type CustomerQuestionnaire } from '@/lib/questionnaireTypes';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { consentDocumentPublicUrl } from '@/lib/consentimientoStorage';
import { Loader2, ExternalLink, PencilLine } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { QuestionnaireAmendmentDialog } from '@/components/questionnaire/QuestionnaireAmendmentDialog';
import { PersonalDataChangesAlert } from '@/components/questionnaire/PersonalDataChangesAlert';
import { getClinicalProfileAmendments } from '@/lib/questionnaireApi';
import { getPersonalDataChangesFromAnswers } from '@/lib/questionnairePersonalData';

/** Por encima del DockBar (z-[120]) y margen inferior para no tapar la barra. */
const QUESTIONNAIRE_DIALOG_LAYER = 'z-[125]';
const QUESTIONNAIRE_DIALOG_MAX_H = 'max-h-[min(85vh,calc(100dvh-7.5rem))]';

type Props = {
  questionnaireId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId?: string | null;
};

export function QuestionnaireEmployeeDialog({ questionnaireId, open, onOpenChange, employeeId }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [returnNote, setReturnNote] = useState('');
  const [technical, setTechnical] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [amendmentOpen, setAmendmentOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: questionnaire, refetch } = useQuery({
    queryKey: ['questionnaire-employee', questionnaireId],
    enabled: open && !!questionnaireId,
    queryFn: () => fetchQuestionnaire(questionnaireId!),
  });

  const { data: customer } = useQuery({
    queryKey: ['questionnaire-employee-customer', questionnaire?.customer_id],
    enabled: open && !!questionnaire?.customer_id,
    queryFn: () => fetchQuestionnaireCustomer(questionnaire!.customer_id),
  });

  const { data: company } = useQuery({
    queryKey: ['questionnaire-company', questionnaire?.company_id],
    enabled: open && !!questionnaire?.company_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('name')
        .eq('id', questionnaire!.company_id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!questionnaire) return;
    const td = (questionnaire.technical_data ?? {}) as Record<string, unknown>;
    const fromCustomer = customer?.first_session_date?.slice(0, 10);
    setTechnical({
      ...td,
      first_session_date: (td.first_session_date as string) || fromCustomer || '',
    });
  }, [questionnaire?.id, questionnaire?.technical_data, customer?.first_session_date]);

  useEffect(() => {
    if (!questionnaire || questionnaire.status !== 'technical_editing') return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void saveTechnicalData(questionnaire.id, technical).catch(() => undefined);
    }, 1200);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [technical, questionnaire]);

  if (!questionnaire) return null;

  const answers = (questionnaire.answers ?? {}) as Record<string, unknown>;
  const visitMode = getVisitModeFromAnswers(answers);
  const personalDataChanges = getPersonalDataChangesFromAnswers(answers);
  const pdfUrl = consentDocumentPublicUrl(questionnaire.documento_pdf_url);
  const amendments = getClinicalProfileAmendments(customer?.clinical_profile ?? null);
  const canAmend =
    questionnaire.status === 'completed' ||
    Boolean(customer?.clinical_profile && Object.keys(customer.clinical_profile).length > 0);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['customer-questionnaires', questionnaire.customer_id] });
    queryClient.invalidateQueries({ queryKey: ['customer_day_timeline', questionnaire.customer_id] });
    queryClient.invalidateQueries({ queryKey: ['questionnaire-kiosk', questionnaire.id] });
    queryClient.invalidateQueries({ queryKey: ['questionnaire-pending-notifications'] });
  };

  const handleReturn = async () => {
    setBusy(true);
    try {
      await returnQuestionnaireToPatient(questionnaire.id, returnNote);
      toast({ title: 'Devuelto al cliente para corrección' });
      invalidate();
      await refetch();
      setReturnNote('');
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleStartTechnical = async () => {
    setBusy(true);
    try {
      await startTechnicalPhase(questionnaire.id, employeeId);
      toast({ title: 'Puede rellenar los datos técnicos' });
      invalidate();
      await refetch();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = async () => {
    const err = validateTechnicalSections(technical);
    if (err) {
      toast({ title: err, variant: 'destructive' });
      return;
    }
    if (!customer || !company) return;
    setBusy(true);
    try {
      await completeQuestionnaire({
        questionnaire,
        customer,
        companyName: company.name,
        technicalData: technical,
        employeeId,
      });
      toast({ title: 'Cuestionario completado y PDF guardado' });
      invalidate();
      await refetch();
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'Error', variant: 'destructive' });
    } finally {
      setBusy(false);
    }
  };

  const showPersonalDataBanner =
    personalDataChanges.length > 0 &&
    (questionnaire.status === 'patient_submitted' || questionnaire.status === 'technical_editing');

  return (
    <>
      {showPersonalDataBanner ? (
        <PersonalDataChangesAlert changes={personalDataChanges} />
      ) : null}
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName={QUESTIONNAIRE_DIALOG_LAYER}
        className={cn(
          QUESTIONNAIRE_DIALOG_LAYER,
          QUESTIONNAIRE_DIALOG_MAX_H,
          'max-w-3xl !flex flex-col overflow-hidden p-0 gap-0 !top-[calc(50%-0.75rem)]',
        )}
      >
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="pr-8">
            Cuestionario facial-corporal
            {customer ? ` — ${customer.name}` : ''}
          </DialogTitle>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="outline">{QUESTIONNAIRE_STATUS_LABELS[questionnaire.status]}</Badge>
            <Badge variant="secondary">{VISIT_MODE_LABELS[visitMode]}</Badge>
            {questionnaire.patient_submitted_at ? (
              <span className="text-xs text-muted-foreground">
                Enviado {format(new Date(questionnaire.patient_submitted_at), 'dd/MM/yyyy HH:mm', { locale: es })}
              </span>
            ) : null}
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6">
          {questionnaire.status === 'patient_editing' && (
            <p className="text-sm text-muted-foreground py-4">
              El cliente está rellenando el cuestionario en la tablet.
            </p>
          )}

          {(questionnaire.status === 'patient_submitted' || questionnaire.status === 'technical_editing' || questionnaire.status === 'completed') && (
            <div className="space-y-4 py-2">
              <h3 className="font-medium text-sm">Respuestas del cliente</h3>
              {FACIAL_CORPORAL_PATIENT_SECTIONS.map((section) => (
                <div key={section.id}>
                  <p className="text-xs font-semibold text-sky-700 mb-1">{section.title}</p>
                  <dl className="grid grid-cols-1 gap-1 text-sm">
                    {section.fields.map((f) => {
                      const v = answers[f.key];
                      if (v == null || v === '' || (f.type === 'boolean' && v === false)) return null;
                      const display =
                        f.type === 'boolean'
                          ? v === true
                            ? 'Sí'
                            : 'No'
                          : Array.isArray(v)
                            ? v.join(', ')
                            : String(v);
                      return (
                        <div key={f.key} className="border-b border-border/40 py-1">
                          <dt className="text-xs text-muted-foreground">{f.label}</dt>
                          <dd className="whitespace-pre-wrap">{display}</dd>
                        </div>
                      );
                    })}
                  </dl>
                </div>
              ))}
              {questionnaire.firma_url ? (
                <p className="text-xs text-green-700">✓ Firma capturada</p>
              ) : null}
            </div>
          )}

          {questionnaire.status === 'technical_editing' && (
            <div className="space-y-4 border-t pt-4 pb-4">
              <h3 className="font-medium">Datos técnicos (empleado/a)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FACIAL_CORPORAL_EMPLOYEE_SECTIONS.flatMap((s) => s.fields).map((field) => (
                  <QuestionnaireFieldInput
                    key={field.key}
                    field={field}
                    value={technical[field.key]}
                    onChange={(v) => setTechnical((prev) => ({ ...prev, [field.key]: v }))}
                  />
                ))}
              </div>
            </div>
          )}

          {questionnaire.status === 'completed' && pdfUrl ? (
            <div className="py-4 flex flex-wrap gap-2 items-center">
              <Button variant="outline" size="sm" asChild>
                <a href={pdfUrl} target="_blank" rel="noreferrer">
                  <ExternalLink className="w-4 h-4 mr-1" /> Ver PDF
                </a>
              </Button>
              {amendments.length > 0 ? (
                <span className="text-xs text-muted-foreground">
                  {amendments.length} modificación(es) registrada(s)
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0 flex-wrap gap-2">
          {canAmend ? (
            <Button variant="outline" onClick={() => setAmendmentOpen(true)} disabled={busy}>
              <PencilLine className="w-4 h-4 mr-1" />
              Añadir modificación
            </Button>
          ) : null}
          {questionnaire.status === 'patient_submitted' && (
            <>
              <div className="w-full sm:w-auto flex-1 min-w-[200px] space-y-1">
                <Label className="text-xs">Nota si devuelve al cliente (opcional)</Label>
                <Textarea value={returnNote} onChange={(e) => setReturnNote(e.target.value)} rows={2} />
              </div>
              <Button variant="outline" onClick={() => void handleReturn()} disabled={busy}>
                Devolver al cliente
              </Button>
              <Button onClick={() => void handleStartTechnical()} disabled={busy}>
                Confirmar y pasar a datos técnicos
              </Button>
            </>
          )}
          {questionnaire.status === 'technical_editing' && (
            <Button onClick={() => void handleComplete()} disabled={busy}>
              {busy ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Guardando…</> : 'Completar y generar PDF'}
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>

      <QuestionnaireAmendmentDialog
        customerId={questionnaire.customer_id}
        customerName={customer?.name}
        open={amendmentOpen}
        onOpenChange={setAmendmentOpen}
        employeeId={employeeId}
      />
    </Dialog>
    </>
  );
}
