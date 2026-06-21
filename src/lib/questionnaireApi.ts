import { supabase } from '@/lib/supabase';
import { uploadConsentPdf, uploadConsentSignaturePng } from '@/lib/consentimientoStorage';
import { buildQuestionnairePdfHtml, generateQuestionnairePdfBlob } from '@/lib/questionnairePdf';
import {
  FACIAL_CORPORAL_EMPLOYEE_SECTIONS,
  FACIAL_CORPORAL_PATIENT_PERSONAL_FIELDS,
  FACIAL_CORPORAL_PATIENT_SECTIONS,
  patientSectionsForVisitMode,
  profileBucketForSection,
} from '@/lib/questionnaires/facialCorporal2026Schema';
import {
  FACIAL_CORPORAL_FORM_KEY,
  VISIT_MODE_ANSWER_KEY,
  type ClinicalProfile,
  type CustomerQuestionnaire,
  type QuestionnaireCustomerRow,
  type QuestionnaireVisitMode,
} from '@/lib/questionnaireTypes';
import { ageFromBirthDate } from '@/lib/patientAge';

const SELECT_Q = '*';

function mapQuestionnaire(row: Record<string, unknown>): CustomerQuestionnaire {
  return row as unknown as CustomerQuestionnaire;
}

export function getVisitModeFromAnswers(answers: Record<string, unknown>): QuestionnaireVisitMode {
  return answers[VISIT_MODE_ANSWER_KEY] === 'follow_up' ? 'follow_up' : 'initial';
}

export function kioskPatientPath(questionnaireId: string): string {
  return `/cuestionario/${questionnaireId}/paciente`;
}

export function openQuestionnaireKiosk(questionnaireId: string): void {
  window.open(kioskPatientPath(questionnaireId), '_blank', 'noopener,noreferrer');
}

export async function fetchQuestionnaire(id: string): Promise<CustomerQuestionnaire | null> {
  const { data, error } = await supabase
    .from('customer_questionnaires')
    .select(SELECT_Q)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapQuestionnaire(data as Record<string, unknown>) : null;
}

export async function fetchCustomerQuestionnaires(
  customerId: string,
): Promise<CustomerQuestionnaire[]> {
  const { data, error } = await supabase
    .from('customer_questionnaires')
    .select(SELECT_Q)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => mapQuestionnaire(r as Record<string, unknown>));
}

export async function fetchPendingQuestionnaires(
  companyId: string,
): Promise<CustomerQuestionnaire[]> {
  const { data, error } = await supabase
    .from('customer_questionnaires')
    .select(SELECT_Q)
    .eq('company_id', companyId)
    .in('status', ['patient_submitted', 'technical_editing'])
    .order('patient_submitted_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => mapQuestionnaire(r as Record<string, unknown>));
}

export async function fetchQuestionnaireCustomer(
  customerId: string,
): Promise<QuestionnaireCustomerRow | null> {
  const { data, error } = await supabase
    .from('customers')
    .select(
      'id,name,tax_id,email,phone,phone_mobile,birth_date,address_street,address_city,address_postal_code,occupation,height_cm,first_session_date,clinical_profile',
    )
    .eq('id', customerId)
    .maybeSingle();
  if (error) throw error;
  return (data as QuestionnaireCustomerRow | null) ?? null;
}

export async function customerHasBaselineQuestionnaire(customerId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('customer_questionnaires')
    .select('id')
    .eq('customer_id', customerId)
    .eq('form_key', FACIAL_CORPORAL_FORM_KEY)
    .eq('status', 'completed')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (data) return true;

  const customer = await fetchQuestionnaireCustomer(customerId);
  const profile = (customer?.clinical_profile ?? {}) as ClinicalProfile;
  const habitos = profile.habitos as Record<string, unknown> | undefined;
  const contraindicaciones = profile.contraindicaciones as Record<string, unknown> | undefined;
  return Boolean(
    profile.updated_at &&
      (profile.motivo_consulta ||
        (habitos && Object.keys(habitos).length > 0) ||
        (contraindicaciones && Object.keys(contraindicaciones).length > 0)),
  );
}

function profileKeysFromAnswers(answers: Record<string, unknown>): ClinicalProfile {
  const habitos: Record<string, unknown> = {};
  const contraindicaciones: Record<string, unknown> = {};
  const depilacion: Record<string, unknown> = {};

  for (const section of FACIAL_CORPORAL_PATIENT_SECTIONS) {
    if (section.id === 'visita_actual') continue;
    const bucket = profileBucketForSection(section.id);
    for (const field of section.fields) {
      const v = answers[field.key];
      if (v == null || v === '' || (field.type === 'boolean' && v === false)) continue;
      if (bucket === 'habitos') habitos[field.key] = v;
      else if (bucket === 'contraindicaciones') contraindicaciones[field.key] = v;
      else if (bucket === 'depilacion') depilacion[field.key] = v;
    }
  }

  for (const field of FACIAL_CORPORAL_PATIENT_PERSONAL_FIELDS) {
    const v = answers[field.key];
    if (v != null && v !== '') {
      // situacion_personal se guarda a nivel raíz
    }
  }

  return {
    motivo_consulta: answers.motivo_consulta ?? null,
    tratamientos_previos: answers.tratamientos_previos ?? null,
    situacion_personal: answers.situacion_personal ?? null,
    habitos,
    contraindicaciones,
    depilacion,
    updated_at: new Date().toISOString(),
  };
}

export function buildInitialAnswersFromCustomer(
  customer: QuestionnaireCustomerRow,
): Record<string, unknown> {
  const profile = (customer.clinical_profile ?? {}) as ClinicalProfile;
  const habitos = (profile.habitos ?? {}) as Record<string, unknown>;
  const contraindicaciones = (profile.contraindicaciones ?? {}) as Record<string, unknown>;
  const depilacion = (profile.depilacion ?? {}) as Record<string, unknown>;
  const answers: Record<string, unknown> = {
    motivo_consulta: profile.motivo_consulta ?? '',
    tratamientos_previos: profile.tratamientos_previos ?? '',
    situacion_personal: profile.situacion_personal ?? '',
    ...habitos,
    ...contraindicaciones,
    ...depilacion,
  };
  if (customer.height_cm != null) answers.height_cm = customer.height_cm;
  return answers;
}

export async function findOpenQuestionnaire(
  customerId: string,
  formKey = FACIAL_CORPORAL_FORM_KEY,
): Promise<CustomerQuestionnaire | null> {
  const { data, error } = await supabase
    .from('customer_questionnaires')
    .select(SELECT_Q)
    .eq('customer_id', customerId)
    .eq('form_key', formKey)
    .neq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapQuestionnaire(data as Record<string, unknown>) : null;
}

export async function createQuestionnaire(params: {
  customerId: string;
  companyId: string;
  appointmentId?: string | null;
}): Promise<CustomerQuestionnaire> {
  const existing = await findOpenQuestionnaire(params.customerId);
  if (existing) return existing;

  const customer = await fetchQuestionnaireCustomer(params.customerId);
  const hasBaseline = await customerHasBaselineQuestionnaire(params.customerId);
  const visitMode: QuestionnaireVisitMode = hasBaseline ? 'follow_up' : 'initial';
  const answers = {
    [VISIT_MODE_ANSWER_KEY]: visitMode,
    ...(customer ? buildInitialAnswersFromCustomer(customer) : {}),
    ...(visitMode === 'follow_up' ? { confirma_datos_vigentes: true } : {}),
  };

  const { data, error } = await supabase
    .from('customer_questionnaires')
    .insert({
      customer_id: params.customerId,
      company_id: params.companyId,
      appointment_id: params.appointmentId ?? null,
      form_key: FACIAL_CORPORAL_FORM_KEY,
      form_version: 2,
      answers,
      profile_snapshot: customer?.clinical_profile ?? {},
    })
    .select(SELECT_Q)
    .single();
  if (error) throw error;
  return mapQuestionnaire(data as Record<string, unknown>);
}

export async function savePatientAnswers(
  questionnaireId: string,
  answers: Record<string, unknown>,
  customerId: string,
  customerPatch?: Record<string, unknown>,
): Promise<void> {
  const { error: qErr } = await supabase
    .from('customer_questionnaires')
    .update({ answers, updated_at: new Date().toISOString() })
    .eq('id', questionnaireId)
    .eq('status', 'patient_editing');
  if (qErr) throw qErr;

  if (customerPatch && Object.keys(customerPatch).length) {
    const { error: cErr } = await supabase.from('customers').update(customerPatch).eq('id', customerId);
    if (cErr) throw cErr;
  }
}

export async function submitPatientQuestionnaire(params: {
  questionnaireId: string;
  customerId: string;
  companyId: string;
  answers: Record<string, unknown>;
  signatureDataUrl: string;
  customerPatch: Record<string, unknown>;
}): Promise<void> {
  const firmaPath = await uploadConsentSignaturePng(
    params.companyId,
    params.customerId,
    params.questionnaireId,
    params.signatureDataUrl,
  );

  const { error: cErr } = await supabase
    .from('customers')
    .update(params.customerPatch)
    .eq('id', params.customerId);
  if (cErr) throw cErr;

  const { error } = await supabase
    .from('customer_questionnaires')
    .update({
      answers: params.answers,
      status: 'patient_submitted',
      firma_url: firmaPath,
      patient_submitted_at: new Date().toISOString(),
      return_note: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.questionnaireId)
    .eq('status', 'patient_editing');
  if (error) throw error;
}

export async function returnQuestionnaireToPatient(
  questionnaireId: string,
  note?: string,
): Promise<void> {
  const { error } = await supabase
    .from('customer_questionnaires')
    .update({
      status: 'patient_editing',
      return_note: note?.trim() || null,
      firma_url: null,
      patient_submitted_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', questionnaireId)
    .eq('status', 'patient_submitted');
  if (error) throw error;
}

export async function startTechnicalPhase(
  questionnaireId: string,
  employeeId?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from('customer_questionnaires')
    .update({
      status: 'technical_editing',
      technical_started_at: new Date().toISOString(),
      technical_started_by: employeeId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', questionnaireId)
    .eq('status', 'patient_submitted');
  if (error) throw error;
}

export async function saveTechnicalData(
  questionnaireId: string,
  technicalData: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase
    .from('customer_questionnaires')
    .update({
      technical_data: technicalData,
      updated_at: new Date().toISOString(),
    })
    .eq('id', questionnaireId)
    .eq('status', 'technical_editing');
  if (error) throw error;
}

export async function completeQuestionnaire(params: {
  questionnaire: CustomerQuestionnaire;
  customer: QuestionnaireCustomerRow;
  companyName: string;
  technicalData: Record<string, unknown>;
  employeeId?: string | null;
}): Promise<void> {
  const { questionnaire, customer, companyName, technicalData } = params;
  const signatureDataUrl = questionnaire.firma_url
    ? await loadSignatureAsDataUrl(questionnaire.firma_url)
    : null;

  const visitMode = getVisitModeFromAnswers(questionnaire.answers as Record<string, unknown>);

  const html = buildQuestionnairePdfHtml({
    customer,
    companyName,
    answers: questionnaire.answers as Record<string, unknown>,
    technicalData,
    signatureDataUrl,
    signedAt: questionnaire.patient_submitted_at
      ? new Date(questionnaire.patient_submitted_at)
      : new Date(),
    visitMode,
  });

  const pdfBlob = await generateQuestionnairePdfBlob(html);
  const pdfPath = await uploadConsentPdf(
    questionnaire.company_id,
    questionnaire.customer_id,
    questionnaire.id,
    pdfBlob,
  );

  const answers = questionnaire.answers as Record<string, unknown>;
  let profile = profileKeysFromAnswers(answers);

  if (visitMode === 'follow_up') {
    const existing = (customer.clinical_profile ?? {}) as ClinicalProfile;
    const hasChanges =
      !answers.confirma_datos_vigentes ||
      Boolean(String(answers.cambios_salud_desde_ultimo ?? '').trim());
    if (!hasChanges && existing.updated_at) {
      profile = { ...existing, updated_at: new Date().toISOString() };
    } else {
      profile = {
        ...profileKeysFromAnswers({ ...buildInitialAnswersFromCustomer(customer), ...answers }),
        motivo_consulta: existing.motivo_consulta ?? profile.motivo_consulta,
      };
    }
  }

  const customerUpdate: Record<string, unknown> = {
    clinical_profile: profile,
    occupation: answers.occupation ?? customer.occupation,
    height_cm: answers.height_cm ?? customer.height_cm,
  };
  if (!customer.first_session_date) {
    customerUpdate.first_session_date = new Date().toISOString().slice(0, 10);
  }

  const { error: profErr } = await supabase
    .from('customers')
    .update(customerUpdate)
    .eq('id', questionnaire.customer_id);
  if (profErr) throw profErr;

  const { error } = await supabase
    .from('customer_questionnaires')
    .update({
      technical_data: technicalData,
      status: 'completed',
      documento_pdf_url: pdfPath,
      profile_snapshot: profile,
      completed_at: new Date().toISOString(),
      completed_by: params.employeeId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', questionnaire.id)
    .eq('status', 'technical_editing');
  if (error) throw error;
}

async function loadSignatureAsDataUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('documents').download(storagePath);
  if (error || !data) return null;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(data);
  });
}

export function validatePatientSections(
  answers: Record<string, unknown>,
  visitMode: QuestionnaireVisitMode = getVisitModeFromAnswers(answers),
): string | null {
  const wantsHealthUpdate =
    visitMode === 'follow_up' &&
    (!answers.confirma_datos_vigentes || Boolean(String(answers.cambios_salud_desde_ultimo ?? '').trim()));

  const sections = patientSectionsForVisitMode(visitMode);
  for (const section of sections) {
    if (visitMode === 'follow_up' && section.readOnlyInFollowUp && !wantsHealthUpdate) continue;
    for (const field of section.fields) {
      if (!field.required) continue;
      const v = answers[field.key];
      if (field.type === 'boolean') {
        if (v !== true) return `Marque: ${field.label}`;
        continue;
      }
      if (v == null || String(v).trim() === '') {
        return `Completa: ${field.label}`;
      }
    }
  }
  return null;
}

export function validateTechnicalSections(technical: Record<string, unknown>): string | null {
  for (const section of FACIAL_CORPORAL_EMPLOYEE_SECTIONS) {
    for (const field of section.fields) {
      if (!field.required) continue;
      const v = technical[field.key];
      if (v == null || String(v).trim() === '') {
        return `Completa: ${field.label}`;
      }
    }
  }
  return null;
}

export function patientDisplayAge(customer: QuestionnaireCustomerRow): string {
  const age = ageFromBirthDate(customer.birth_date);
  return age != null ? String(age) : '';
}

export const VISIT_MODE_LABELS: Record<QuestionnaireVisitMode, string> = {
  initial: 'Primera visita — cuestionario completo',
  follow_up: 'Visita sucesiva — confirmación',
};
