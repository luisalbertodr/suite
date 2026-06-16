import { supabase } from '@/lib/supabase';
import { resolveDocumentsBucketMimeType } from '@/lib/appointmentAssets';

function consentBasePath(companyId: string, customerId: string, consentId: string): string {
  return `consentimientos/${companyId}/${customerId}/${consentId}`;
}

export async function uploadConsentSignaturePng(
  companyId: string,
  customerId: string,
  consentId: string,
  dataUrl: string,
): Promise<string> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const path = `${consentBasePath(companyId, customerId, consentId)}-firma.png`;
  const file = new File([blob], 'firma.png', { type: 'image/png' });
  const { error } = await supabase.storage.from('documents').upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: resolveDocumentsBucketMimeType('firma.png', 'image/png'),
  });
  if (error) throw error;
  return path;
}

export async function uploadConsentPdf(
  companyId: string,
  customerId: string,
  consentId: string,
  pdfBlob: Blob,
): Promise<string> {
  const path = `${consentBasePath(companyId, customerId, consentId)}.pdf`;
  const file = new File([pdfBlob], 'consentimiento.pdf', { type: 'application/pdf' });
  const { error } = await supabase.storage.from('documents').upload(path, file, {
    cacheControl: '3600',
    upsert: true,
    contentType: 'application/pdf',
  });
  if (error) throw error;
  return path;
}

export function consentDocumentPublicUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath?.trim()) return null;
  if (/^https?:\/\//i.test(storagePath)) return storagePath;
  const { data } = supabase.storage.from('documents').getPublicUrl(storagePath);
  return data.publicUrl;
}
