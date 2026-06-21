import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { generatePdfBlobFromHtml } from '@/lib/pdfFromHtml';
import type { ConsentimientoSnapshot } from '@/lib/consentimientoTypes';

export type ConsentPdfParams = {
  titulo: string;
  tipo: string;
  contenido: string;
  signatureDataUrl: string;
  snapshot: ConsentimientoSnapshot;
  signedAt: Date;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function contentToHtmlParagraphs(content: string): string {
  const escaped = escapeHtml(content);
  return escaped
    .split(/\r?\n/)
    .map((line) => (line.trim() ? `<p style="margin:0 0 8px;line-height:1.5;">${line}</p>` : '<br/>'))
    .join('');
}

export function buildConsentimientoPdfHtml(params: ConsentPdfParams): string {
  const fechaFirma = format(params.signedAt, "d 'de' MMMM 'de' yyyy, HH:mm", { locale: es });
  const cliente = [
    params.snapshot.customer_name,
    params.snapshot.customer_tax_id ? `DNI/NIF: ${params.snapshot.customer_tax_id}` : null,
    params.snapshot.customer_phone ? `Tel: ${params.snapshot.customer_phone}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#111;padding:24px;max-width:720px;">
      <div style="border-bottom:2px solid #0ea5e9;padding-bottom:12px;margin-bottom:20px;">
        <h1 style="margin:0 0 4px;font-size:18px;">${escapeHtml(params.titulo)}</h1>
        <p style="margin:0;color:#555;font-size:11px;">${escapeHtml(params.tipo)} · ${escapeHtml(params.snapshot.company_name || '')}</p>
      </div>
      ${cliente ? `<p style="margin:0 0 16px;"><strong>Cliente:</strong> ${escapeHtml(cliente)}</p>` : ''}
      ${params.snapshot.tratamiento ? `<p style="margin:0 0 16px;"><strong>Tratamiento:</strong> ${escapeHtml(params.snapshot.tratamiento)}</p>` : ''}
      ${params.snapshot.profesional ? `<p style="margin:0 0 16px;"><strong>Profesional:</strong> ${escapeHtml(params.snapshot.profesional)}</p>` : ''}
      <div style="margin:16px 0 24px;text-align:justify;">
        ${contentToHtmlParagraphs(params.contenido)}
      </div>
      <div style="margin-top:32px;">
        <p style="margin:0 0 8px;font-size:11px;color:#555;">Firma del cliente</p>
        <div style="border:1px solid #ccc;border-radius:4px;padding:8px;width:280px;height:100px;display:flex;align-items:center;justify-content:center;">
          <img src="${params.signatureDataUrl}" alt="Firma" style="max-width:260px;max-height:84px;object-fit:contain;" />
        </div>
        <p style="margin:12px 0 0;font-size:11px;color:#555;">Firmado el ${escapeHtml(fechaFirma)}</p>
      </div>
    </div>
  `;
}

export async function generateConsentimientoPdfBlob(html: string): Promise<Blob> {
  return generatePdfBlobFromHtml(html, { filename: 'consentimiento.pdf', margin: 0.4 });
}
