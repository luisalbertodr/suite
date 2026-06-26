import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { generatePdfBlobFromHtml } from '@/lib/pdfFromHtml';
import {
  FACIAL_CORPORAL_EMPLOYEE_SECTIONS,
  patientSectionsForVisitMode,
} from '@/lib/questionnaires/facialCorporal2026Schema';
import { getVisitModeFromAnswers, patientDisplayAge, VISIT_MODE_LABELS } from '@/lib/questionnaireApi';
import { LOPD_DECLARATION_TEXT, type QuestionnaireCustomerRow, type QuestionnaireVisitMode } from '@/lib/questionnaireTypes';
import type { QuestionnaireField } from '@/lib/questionnaireTypes';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatFieldValue(field: QuestionnaireField, value: unknown): string {
  if (value == null || value === '') return '—';
  if (field.type === 'date' && value) {
    const s = String(value).slice(0, 10);
    try {
      return escapeHtml(format(new Date(s), 'dd/MM/yyyy', { locale: es }));
    } catch {
      return escapeHtml(s);
    }
  }
  if (field.type === 'boolean') return value === true ? 'Sí' : 'No';
  if (field.type === 'multi' && Array.isArray(value)) {
    return value.length ? value.map((v) => escapeHtml(String(v))).join(', ') : '—';
  }
  if (field.type === 'single') return escapeHtml(String(value));
  return escapeHtml(String(value)).replace(/\n/g, '<br/>');
}

function renderSectionFields(
  fields: QuestionnaireField[],
  data: Record<string, unknown>,
): string {
  return fields
    .map((f) => {
      const val = formatFieldValue(f, data[f.key]);
      return `<tr><td style="padding:4px 8px 4px 0;vertical-align:top;width:38%;font-weight:600;color:#444;">${escapeHtml(f.label)}</td><td style="padding:4px 0;vertical-align:top;">${val}</td></tr>`;
    })
    .join('');
}

export type QuestionnairePdfParams = {
  customer: QuestionnaireCustomerRow;
  companyName: string;
  answers: Record<string, unknown>;
  technicalData: Record<string, unknown>;
  signatureDataUrl: string | null;
  signedAt: Date;
  visitMode?: QuestionnaireVisitMode;
};

export function buildQuestionnairePdfHtml(params: QuestionnairePdfParams): string {
  const { customer, companyName, answers, technicalData, signatureDataUrl, signedAt } = params;
  const visitMode = params.visitMode ?? getVisitModeFromAnswers(answers);
  const fechaFirma = format(signedAt, "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es });
  const address = [customer.address_street, customer.address_city, customer.address_postal_code]
    .filter(Boolean)
    .join(', ');

  const patientSections = patientSectionsForVisitMode(visitMode)
    .map(
      (s) => `
    <h3 style="margin:18px 0 8px;font-size:13px;color:#0369a1;border-bottom:1px solid #bae6fd;padding-bottom:4px;">${escapeHtml(s.title)}</h3>
    <table style="width:100%;border-collapse:collapse;font-size:11px;">${renderSectionFields(s.fields, answers)}</table>
  `,
    )
    .join('');

  const technicalSections = FACIAL_CORPORAL_EMPLOYEE_SECTIONS.map(
    (s) => `
    <h3 style="margin:18px 0 8px;font-size:13px;color:#0369a1;border-bottom:1px solid #bae6fd;padding-bottom:4px;">${escapeHtml(s.title)}</h3>
    <table style="width:100%;border-collapse:collapse;font-size:11px;">${renderSectionFields(s.fields, technicalData)}</table>
  `,
  ).join('');

  const height = answers.height_cm ?? customer.height_cm;

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#111;background:#ffffff;padding:20px;max-width:720px;">
      <div style="border-bottom:2px solid #0ea5e9;padding-bottom:10px;margin-bottom:16px;">
        <h1 style="margin:0;font-size:16px;">Cuestionario Facial-Corporal 2026</h1>
        <p style="margin:4px 0 0;color:#555;">${escapeHtml(companyName)} · ${escapeHtml(VISIT_MODE_LABELS[visitMode])}</p>
      </div>

      <h3 style="margin:0 0 8px;font-size:13px;color:#0369a1;">Datos personales</h3>
      <table style="width:100%;font-size:11px;margin-bottom:8px;">
        <tr><td style="width:38%;font-weight:600;">Nombre</td><td>${escapeHtml(customer.name)}</td></tr>
        <tr><td style="font-weight:600;">DNI</td><td>${escapeHtml(customer.tax_id || '—')}</td></tr>
        <tr><td style="font-weight:600;">Dirección</td><td>${escapeHtml(address || '—')}</td></tr>
        <tr><td style="font-weight:600;">Teléfono / Email</td><td>${escapeHtml([customer.phone_mobile || customer.phone, customer.email].filter(Boolean).join(' · ') || '—')}</td></tr>
        <tr><td style="font-weight:600;">Fecha nacimiento</td><td>${escapeHtml(customer.birth_date?.slice(0, 10) || '—')}</td></tr>
        <tr><td style="font-weight:600;">Ocupación</td><td>${escapeHtml(String(answers.occupation ?? customer.occupation ?? '—'))}</td></tr>
        <tr><td style="font-weight:600;">Situación personal</td><td>${escapeHtml(String(answers.situacion_personal ?? '—'))}</td></tr>
      </table>

      ${patientSections}

      ${technicalSections}

      <h3 style="margin:18px 0 8px;font-size:13px;color:#0369a1;">Declaración del paciente</h3>
      <p style="text-align:justify;line-height:1.45;font-size:10px;">${escapeHtml(LOPD_DECLARATION_TEXT).replace(/\n/g, '<br/>')}</p>
      <p style="margin-top:12px;font-size:11px;">
        <strong>Nombre:</strong> ${escapeHtml(customer.name)} ·
        <strong>DNI:</strong> ${escapeHtml(customer.tax_id || '—')} ·
        <strong>Edad:</strong> ${escapeHtml(patientDisplayAge(customer) || '—')} ·
        <strong>Altura:</strong> ${height != null ? `${escapeHtml(String(height))} cm` : '—'}
      </p>
      <p style="font-size:10px;color:#555;">Firmado el ${escapeHtml(fechaFirma)}</p>
      ${
        signatureDataUrl
          ? `<div style="margin-top:8px;border:1px solid #ccc;padding:6px;width:240px;height:90px;"><img src="${signatureDataUrl}" style="max-width:220px;max-height:78px;object-fit:contain;" /></div>`
          : ''
      }
    </div>
  `;
}

export async function generateQuestionnairePdfBlob(html: string): Promise<Blob> {
  return generatePdfBlobFromHtml(html, { filename: 'cuestionario.pdf', margin: 0.35 });
}
