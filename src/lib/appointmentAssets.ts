import { supabase } from '@/lib/supabase';
import { prepareImageBlobForUpload } from '@/lib/heicImage';

export type AppointmentAssetKind = 'photo_before' | 'photo_after' | 'document' | 'consent' | 'other';

export type AppointmentAssetRow = {
  id: string;
  asset_kind: AppointmentAssetKind;
  title: string | null;
  storage_path: string | null;
  created_at: string;
};

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|svg|heic|heif)(\?|$)/i;

const EXT_TO_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  avi: 'video/x-msvideo',
};

/** MIME aceptado por storage.documents (evita 400 por application/octet-stream). */
export function resolveDocumentsBucketMimeType(fileName: string, blobType?: string): string {
  const raw = (blobType ?? '').trim().toLowerCase();
  if (raw && raw !== 'application/octet-stream') return raw;
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return EXT_TO_MIME[ext] ?? 'image/jpeg';
}

export function appointmentAssetPublicUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath?.trim()) return null;
  if (/^https?:\/\//i.test(storagePath)) return storagePath;
  const { data } = supabase.storage.from('documents').getPublicUrl(storagePath);
  return data.publicUrl;
}

export function isAppointmentAssetImage(asset: Pick<AppointmentAssetRow, 'asset_kind' | 'storage_path'>): boolean {
  const url = appointmentAssetPublicUrl(asset.storage_path);
  if (asset.asset_kind === 'photo_before' || asset.asset_kind === 'photo_after') return true;
  return url ? IMAGE_EXT.test(url) : false;
}

export function inferAssetKindFromFile(file: File): AppointmentAssetKind {
  if (file.type.startsWith('image/')) return 'photo_after';
  if (/consent|consentimiento/i.test(file.name)) return 'consent';
  return 'document';
}

export function inferAssetKindFromMime(mime: string, fileName: string): AppointmentAssetKind {
  if (mime.startsWith('image/')) return 'photo_after';
  if (mime.startsWith('video/')) return 'document';
  if (/consent|consentimiento/i.test(fileName)) return 'consent';
  return 'document';
}

async function ensureDailyLog(companyId: string, customerId: string, logDate: string): Promise<string> {
  const { data: existing, error: findErr } = await supabase
    .from('daily_customer_log')
    .select('id')
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .eq('log_date', logDate)
    .maybeSingle();
  if (findErr) throw findErr;
  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from('daily_customer_log')
    .insert({
      company_id: companyId,
      customer_id: customerId,
      log_date: logDate,
      source: 'manual',
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function fetchAppointmentAssets(appointmentId: string): Promise<AppointmentAssetRow[]> {
  const { data, error } = await supabase
    .from('daily_customer_log_assets')
    .select('id, asset_kind, title, storage_path, created_at')
    .eq('ref_table', 'agenda_appointments')
    .eq('ref_id', appointmentId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as AppointmentAssetRow[];
}

export async function uploadAppointmentAsset(params: {
  file: File;
  appointmentId: string;
  customerId: string;
  companyId: string;
  logDate: string;
  assetKind?: AppointmentAssetKind;
  title?: string;
}): Promise<AppointmentAssetRow> {
  const { appointmentId, customerId, companyId, logDate } = params;
  const prepared = await prepareImageBlobForUpload(params.file, params.file.name, params.file.type);
  const uploadFile = new File([prepared.blob], prepared.fileName, { type: prepared.mimeType });
  const assetKind = params.assetKind ?? inferAssetKindFromFile(uploadFile);
  const ext = prepared.fileName.split('.').pop() || 'bin';
  const storagePath = `appointment-attachments/${appointmentId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const mime = resolveDocumentsBucketMimeType(prepared.fileName, prepared.mimeType);
  const { error: uploadError } = await supabase.storage.from('documents').upload(storagePath, uploadFile, {
    cacheControl: '3600',
    upsert: false,
    contentType: mime,
  });
  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from('documents').getPublicUrl(storagePath);
  const publicUrl = urlData.publicUrl;
  const logId = await ensureDailyLog(companyId, customerId, logDate);

  const { data, error } = await supabase
    .from('daily_customer_log_assets')
    .insert({
      log_id: logId,
      asset_kind: assetKind,
      title: params.title?.trim() || uploadFile.name,
      storage_path: publicUrl,
      ref_table: 'agenda_appointments',
      ref_id: appointmentId,
    })
    .select('id, asset_kind, title, storage_path, created_at')
    .single();
  if (error) throw error;
  return data as AppointmentAssetRow;
}

export async function deleteAppointmentAsset(assetId: string): Promise<void> {
  const { error } = await supabase.from('daily_customer_log_assets').delete().eq('id', assetId);
  if (error) throw error;
}

/** Foto/documento en el diario del cliente (sin cita), p. ej. importación desde Immich. */
export async function uploadCustomerLogAsset(params: {
  blob: Blob;
  fileName: string;
  customerId: string;
  companyId: string;
  logDate?: string;
  assetKind?: AppointmentAssetKind;
  title?: string;
  mimeType?: string;
}): Promise<void> {
  const logDate = params.logDate ?? new Date().toISOString().slice(0, 10);
  const safeName = params.fileName.replace(/[^\w.\-()+ ]+/g, '_').slice(0, 120);

  const prepared = await prepareImageBlobForUpload(
    params.blob,
    safeName,
    params.mimeType ?? params.blob.type,
  );
  const uploadName = prepared.fileName.replace(/[^\w.\-()+ ]+/g, '_').slice(0, 120);
  const ext = uploadName.includes('.') ? uploadName.split('.').pop() : 'jpg';
  const storagePath = `customer-immich/${params.customerId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const mime = resolveDocumentsBucketMimeType(uploadName, prepared.mimeType);
  const file = new File([prepared.blob], uploadName, { type: mime });

  const { error: uploadError } = await supabase.storage.from('documents').upload(storagePath, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: mime,
  });
  if (uploadError) {
    throw new Error(uploadError.message || 'Error al subir el archivo a almacenamiento');
  }

  const { data: urlData } = supabase.storage.from('documents').getPublicUrl(storagePath);
  const logId = await ensureDailyLog(params.companyId, params.customerId, logDate);
  const assetKind = params.assetKind ?? inferAssetKindFromMime(mime, uploadName);

  const { error } = await supabase.from('daily_customer_log_assets').insert({
    log_id: logId,
    asset_kind: assetKind,
    title: params.title?.trim() || uploadName,
    storage_path: urlData.publicUrl,
    ref_table: 'customers',
    ref_id: params.customerId,
  });
  if (error) throw error;
}
