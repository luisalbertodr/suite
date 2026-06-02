import { supabase } from '@/lib/supabase';

export type AppointmentAssetKind = 'photo_before' | 'photo_after' | 'document' | 'consent' | 'other';

export type AppointmentAssetRow = {
  id: string;
  asset_kind: AppointmentAssetKind;
  title: string | null;
  storage_path: string | null;
  created_at: string;
};

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|svg)(\?|$)/i;

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
  const { file, appointmentId, customerId, companyId, logDate } = params;
  const assetKind = params.assetKind ?? inferAssetKindFromFile(file);
  const ext = file.name.split('.').pop() || 'bin';
  const storagePath = `appointment-attachments/${appointmentId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error: uploadError } = await supabase.storage.from('documents').upload(storagePath, file, {
    cacheControl: '3600',
    upsert: false,
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
      title: params.title?.trim() || file.name,
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
