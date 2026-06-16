export type QuestionnaireStatus =
  | 'patient_editing'
  | 'patient_submitted'
  | 'technical_editing'
  | 'completed';

export type QuestionnaireFieldType =
  | 'text'
  | 'textarea'
  | 'date'
  | 'number'
  | 'single'
  | 'multi'
  | 'boolean';

export type QuestionnaireFieldRole = 'patient' | 'employee';

export type QuestionnaireField = {
  key: string;
  label: string;
  type: QuestionnaireFieldType;
  options?: string[];
  required?: boolean;
  placeholder?: string;
  fullWidth?: boolean;
};

export type QuestionnaireSection = {
  id: string;
  title: string;
  role: QuestionnaireFieldRole;
  description?: string;
  fields: QuestionnaireField[];
  /** Si se omite, la sección aplica a initial y follow_up. */
  visitModes?: QuestionnaireVisitMode[];
  /** En follow_up los campos se muestran informativos salvo que la clienta indique cambios. */
  readOnlyInFollowUp?: boolean;
};

export type QuestionnaireVisitMode = 'initial' | 'follow_up';

export const VISIT_MODE_ANSWER_KEY = '__visit_mode';

export type ClinicalProfile = Record<string, unknown>;

export type CustomerQuestionnaire = {
  id: string;
  customer_id: string;
  company_id: string;
  appointment_id: string | null;
  form_key: string;
  form_version: number;
  status: QuestionnaireStatus;
  answers: Record<string, unknown>;
  technical_data: Record<string, unknown>;
  profile_snapshot: ClinicalProfile | null;
  patient_submitted_at: string | null;
  technical_started_at: string | null;
  technical_started_by: string | null;
  completed_at: string | null;
  completed_by: string | null;
  return_note: string | null;
  firma_url: string | null;
  documento_pdf_url: string | null;
  created_at: string;
  updated_at: string;
};

export type QuestionnaireCustomerRow = {
  id: string;
  name: string;
  tax_id: string | null;
  email: string | null;
  phone: string | null;
  phone_mobile: string | null;
  birth_date: string | null;
  address_street: string | null;
  address_city: string | null;
  address_postal_code: string | null;
  occupation: string | null;
  height_cm: number | null;
  first_session_date: string | null;
  clinical_profile: ClinicalProfile | null;
};

export const QUESTIONNAIRE_STATUS_LABELS: Record<QuestionnaireStatus, string> = {
  patient_editing: 'Rellenando (clienta)',
  patient_submitted: 'Enviado — pendiente revisión',
  technical_editing: 'Datos técnicos (empleada)',
  completed: 'Completado',
};

export const FACIAL_CORPORAL_FORM_KEY = 'facial_corporal_2026';

export const LOPD_DECLARATION_TEXT = `Con el presente afirmo, que he contestado a todas las preguntas sinceramente según mi leal entender y saber.
Si hay alguna variación o cambio en mi estado, informaré inmediatamente al centro.
Declaro que el tratamiento que se me aplicará es por riesgo propio.

En cumplimiento de lo establecido en la Ley Orgánica 03/2018, de 6 de Diciembre del 2018 de Protección de Datos y garantía de Derechos Digitales (LOPDGDD) le informamos que los datos personales que facilite quedarán incorporados y serán tratados en los ficheros de LIPOOUT, con el fin de informarle sobre nuevos servicios, productos y/o promociones. Asimismo el cliente presta su consentimiento a LIPOOUT para que, por cualquier medio de comunicación, incluido el correo electrónico o equivalente, le envíe comunicaciones comerciales o promocionales relativas a sus productos y servicios. El cliente podrá ejercer en cualquier momento su derecho de acceso, rectificación, cancelación y oposición de sus datos, y revocar la autorización concedida para que LIPOOUT envíe por vía electrónica ofertas o comunicaciones publicitarias y promocionales, notificándolo mediante correo electrónico a info@lipoout.com o por correo postal a LIPOOUT - Rda. de Outeiro, 219 - Bajo 15007 - A Coruña.`;
