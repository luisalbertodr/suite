import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useQueryClient } from '@tanstack/react-query';
import { SignaturePad, type SignaturePadHandle } from '@/components/consentimiento/SignaturePad';
import { QuestionnaireFieldInput } from '@/components/questionnaire/QuestionnaireFieldInput';
import {
  FACIAL_CORPORAL_PATIENT_PERSONAL_FIELDS,
  patientSectionsForVisitMode,
} from '@/lib/questionnaires/facialCorporal2026Schema';
import {
  getVisitModeFromAnswers,
  savePatientAnswers,
  submitPatientQuestionnaire,
  validatePatientSections,
  VISIT_MODE_LABELS,
} from '@/lib/questionnaireApi';
import { LOPD_DECLARATION_TEXT, type QuestionnaireCustomerRow, type QuestionnaireVisitMode } from '@/lib/questionnaireTypes';
import { Loader2 } from 'lucide-react';
import { SuiteTopBannerText } from '@/contexts/SuiteTopBannerContext';

type Props = {
  questionnaireId: string;
  companyId: string;
  customer: QuestionnaireCustomerRow;
  initialAnswers: Record<string, unknown>;
  returnNote?: string | null;
  onSubmitted: () => void;
};

type Step = 'form' | 'declaration';

function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  if (!value.trim()) return null;
  return (
    <div className="text-sm">
      <span className="text-muted-foreground">{label}: </span>
      <span>{value}</span>
    </div>
  );
}

export function QuestionnairePatientForm({
  questionnaireId,
  companyId,
  customer,
  initialAnswers,
  returnNote,
  onSubmitted,
}: Props) {
  const signatureRef = useRef<SignaturePadHandle>(null);
  const queryClient = useQueryClient();
  const visitMode: QuestionnaireVisitMode = getVisitModeFromAnswers(initialAnswers);
  const isFollowUp = visitMode === 'follow_up';

  const [step, setStep] = useState<Step>('form');
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers);
  const [editBaseline, setEditBaseline] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    name: customer.name,
    tax_id: customer.tax_id ?? '',
    email: customer.email ?? '',
    phone: customer.phone_mobile || customer.phone || '',
    address_street: customer.address_street ?? '',
    address_city: customer.address_city ?? '',
    address_postal_code: customer.address_postal_code ?? '',
    birth_date: customer.birth_date?.slice(0, 10) ?? '',
    occupation: customer.occupation ?? '',
  });
  const [heightCm, setHeightCm] = useState<string>(
    initialAnswers.height_cm != null ? String(initialAnswers.height_cm) : customer.height_cm != null ? String(customer.height_cm) : '',
  );
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sections = useMemo(() => patientSectionsForVisitMode(visitMode), [visitMode]);

  const baselineSections = useMemo(
    () => patientSectionsForVisitMode('initial').filter((s) => s.readOnlyInFollowUp),
    [],
  );

  const showBaselineFields = !isFollowUp || editBaseline || !answers.confirma_datos_vigentes;

  const setAnswer = (key: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const persistDraft = useCallback(async () => {
    setSaving(true);
    try {
      const merged = {
        ...answers,
        height_cm: heightCm ? Number(heightCm) : null,
        occupation: customerForm.occupation,
        situacion_personal: answers.situacion_personal,
      };
      await savePatientAnswers(questionnaireId, merged, customer.id, {
        name: customerForm.name,
        tax_id: customerForm.tax_id || null,
        email: customerForm.email || null,
        phone_mobile: customerForm.phone || null,
        address_street: customerForm.address_street || null,
        address_city: customerForm.address_city || null,
        address_postal_code: customerForm.address_postal_code || null,
        birth_date: customerForm.birth_date || null,
        occupation: customerForm.occupation || null,
      });
    } finally {
      setSaving(false);
    }
  }, [answers, heightCm, customerForm, questionnaireId, customer.id]);

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void persistDraft(), 1500);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [answers, customerForm, heightCm, persistDraft]);

  const goToDeclaration = async () => {
    const merged = { ...answers, occupation: customerForm.occupation };
    const err = validatePatientSections(merged, visitMode);
    if (err) {
      alert(err);
      return;
    }
    if (!customerForm.name.trim()) {
      alert('Indique su nombre');
      return;
    }
    await persistDraft();
    setStep('declaration');
  };

  const handleSubmit = async () => {
    if (!accepted) {
      alert('Debe aceptar la declaración');
      return;
    }
    const sig = signatureRef.current?.toDataUrl();
    if (!sig) {
      alert('Dibuje su firma en el recuadro');
      return;
    }
    setSubmitting(true);
    try {
      const mergedAnswers = {
        ...answers,
        height_cm: heightCm ? Number(heightCm) : null,
        occupation: customerForm.occupation,
      };
      await submitPatientQuestionnaire({
        questionnaireId,
        customerId: customer.id,
        companyId,
        answers: mergedAnswers,
        signatureDataUrl: sig,
        customerPatch: {
          name: customerForm.name.trim(),
          tax_id: customerForm.tax_id || null,
          email: customerForm.email || null,
          phone_mobile: customerForm.phone || null,
          address_street: customerForm.address_street || null,
          address_city: customerForm.address_city || null,
          address_postal_code: customerForm.address_postal_code || null,
          birth_date: customerForm.birth_date || null,
          occupation: customerForm.occupation || null,
          height_cm: heightCm ? Number(heightCm) : null,
        },
      });
      queryClient.invalidateQueries({ queryKey: ['questionnaire-pending-notifications'] });
      onSubmitted();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Error al enviar');
    } finally {
      setSubmitting(false);
    }
  };

  const personalReadOnly = isFollowUp;

  const returnNoteBanner = (
    <SuiteTopBannerText id="questionnaire-return-note">
      {returnNote ? (
        <>
          <p className="font-medium">Correcciones solicitadas por la profesional</p>
          <p className="text-xs mt-1 opacity-90">{returnNote}</p>
        </>
      ) : null}
    </SuiteTopBannerText>
  );

  if (step === 'declaration') {
    return (
      <>
        {returnNoteBanner}
        <div className="space-y-6">
        <Button variant="outline" size="sm" onClick={() => setStep('form')}>
          Volver al cuestionario
        </Button>
        <ScrollArea className="h-48 rounded-md border p-4 text-sm leading-relaxed bg-muted/30">
          {LOPD_DECLARATION_TEXT}
        </ScrollArea>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} />
          <span>He leído y acepto la declaración y la información sobre protección de datos.</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Altura (cm)</Label>
            <Input type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
          </div>
        </div>
        <div>
          <Label className="mb-2 block">Firma</Label>
          <SignaturePad ref={signatureRef} height={180} />
        </div>
        <Button className="w-full" size="lg" onClick={() => void handleSubmit()} disabled={submitting}>
          {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando…</> : 'Enviar cuestionario'}
        </Button>
        </div>
      </>
    );
  }

  return (
    <>
      {returnNoteBanner}
      <div className="space-y-6">
      <div className="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
        <p className="font-medium">{VISIT_MODE_LABELS[visitMode]}</p>
        {isFollowUp ? (
          <p className="mt-1 text-sky-800/90 dark:text-sky-200/90">
            Sus datos del cuestionario inicial se muestran a continuación. Solo debe indicar el motivo de hoy y
            confirmar si algo ha cambiado en su salud.
          </p>
        ) : (
          <p className="mt-1 text-sky-800/90 dark:text-sky-200/90">
            Complete este cuestionario una sola vez. Será válido para cualquier tratamiento posterior en el centro.
          </p>
        )}
      </div>

      {saving ? <p className="text-xs text-muted-foreground text-right">Guardando…</p> : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-sky-800">Datos personales</h2>
        {personalReadOnly ? (
          <div className="rounded-md border bg-muted/30 p-4 space-y-1.5">
            <ReadOnlyValue label="Nombre" value={customerForm.name} />
            <ReadOnlyValue label="DNI" value={customerForm.tax_id} />
            <ReadOnlyValue label="Dirección" value={customerForm.address_street} />
            <ReadOnlyValue label="Teléfono" value={customerForm.phone} />
            <ReadOnlyValue label="Email" value={customerForm.email} />
            <ReadOnlyValue label="Fecha nacimiento" value={customerForm.birth_date} />
            <ReadOnlyValue label="Ocupación" value={customerForm.occupation} />
            <ReadOnlyValue label="Situación personal" value={String(answers.situacion_personal ?? '')} />
            <div className="pt-2">
              <Label>Teléfono (actualizar si ha cambiado)</Label>
              <Input value={customerForm.phone} onChange={(e) => setCustomerForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <Label>Nombre y apellidos *</Label>
              <Input value={customerForm.name} onChange={(e) => setCustomerForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label>Dirección</Label>
              <Input value={customerForm.address_street} onChange={(e) => setCustomerForm((f) => ({ ...f, address_street: e.target.value }))} />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input value={customerForm.phone} onChange={(e) => setCustomerForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={customerForm.email} onChange={(e) => setCustomerForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label>Fecha de nacimiento</Label>
              <Input type="date" value={customerForm.birth_date} onChange={(e) => setCustomerForm((f) => ({ ...f, birth_date: e.target.value }))} />
            </div>
            <div>
              <Label>Ocupación actual</Label>
              <Input value={customerForm.occupation} onChange={(e) => setCustomerForm((f) => ({ ...f, occupation: e.target.value }))} />
            </div>
            <div>
              <Label>DNI</Label>
              <Input value={customerForm.tax_id} onChange={(e) => setCustomerForm((f) => ({ ...f, tax_id: e.target.value }))} />
            </div>
            {FACIAL_CORPORAL_PATIENT_PERSONAL_FIELDS.map((field) => (
              <QuestionnaireFieldInput
                key={field.key}
                field={field}
                value={answers[field.key]}
                onChange={(v) => setAnswer(field.key, v)}
              />
            ))}
          </div>
        )}
      </section>

      {sections.map((section) => {
        const isBaselineReadOnly =
          isFollowUp && section.readOnlyInFollowUp && !showBaselineFields;

        if (isBaselineReadOnly) {
          const filled = section.fields.filter((f) => {
            const v = answers[f.key];
            return v != null && v !== '' && !(f.type === 'boolean' && v === false);
          });
          if (!filled.length) return null;
          return (
            <section key={section.id} className="space-y-2 border-t pt-4">
              <h2 className="text-base font-semibold text-muted-foreground">{section.title}</h2>
              <div className="rounded-md border bg-muted/20 p-3 space-y-1 text-sm">
                {filled.map((f) => (
                  <ReadOnlyValue key={f.key} label={f.label} value={String(answers[f.key] ?? '')} />
                ))}
              </div>
            </section>
          );
        }

        return (
          <section key={section.id} className="space-y-3 border-t pt-4">
            <div>
              <h2 className="text-lg font-semibold text-sky-800">{section.title}</h2>
              {section.description ? (
                <p className="text-sm text-muted-foreground mt-0.5">{section.description}</p>
              ) : null}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {section.fields.map((field) => (
                <QuestionnaireFieldInput
                  key={field.key}
                  field={field}
                  value={answers[field.key]}
                  onChange={(v) => setAnswer(field.key, v)}
                  disabled={isFollowUp && section.readOnlyInFollowUp && !showBaselineFields}
                />
              ))}
            </div>
          </section>
        );
      })}

      {isFollowUp && baselineSections.length > 0 ? (
        <div className="rounded-md border border-dashed p-3">
          <label className="flex items-start gap-2 text-sm cursor-pointer">
            <Checkbox checked={editBaseline} onCheckedChange={(v) => setEditBaseline(v === true)} />
            <span>Necesito actualizar mis datos de salud, hábitos o contraindicaciones</span>
          </label>
        </div>
      ) : null}

      <Button className="w-full" size="lg" onClick={() => void goToDeclaration()}>
        Continuar a declaración y firma
      </Button>
      </div>
    </>
  );
}
