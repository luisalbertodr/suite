import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { providerJson } from './whatsappProviderClient.ts';
import { openwaGetSession } from './whatsappProviderOpenwa.ts';
import {
  normalizeWhatsappProvider,
  type WhatsappProviderConfig,
} from './whatsappProviderTypes.ts';

export type LiveWhatsappSessionStatus = {
  internalStatus: string;
  meJid: string | null;
};

/** Consulta el estado real de la sesión en WAHA/OpenWA (no el cache de BD). */
export async function fetchLiveWhatsappSessionStatus(
  cfg: WhatsappProviderConfig,
): Promise<LiveWhatsappSessionStatus> {
  const provider = normalizeWhatsappProvider(cfg.provider);
  if (provider === 'openwa') {
    const session = await openwaGetSession(cfg);
    return {
      internalStatus: session.internalStatus,
      meJid: session.meJid ?? null,
    };
  }

  const sessionName = cfg.session_name || 'default';
  const data = await providerJson<{ status?: string; me?: { id?: string } | null }>(
    cfg,
    `/api/sessions/${encodeURIComponent(sessionName)}`,
  );
  return {
    internalStatus: (data.status ?? 'UNKNOWN').toUpperCase(),
    meJid: data.me?.id ?? null,
  };
}

export async function persistWhatsappSessionStatus(
  admin: SupabaseClient,
  companyId: string,
  live: LiveWhatsappSessionStatus,
): Promise<void> {
  await admin
    .from('whatsapp_config')
    .update({
      last_status: live.internalStatus,
      last_status_message: null,
      last_status_at: new Date().toISOString(),
      ...(live.meJid ? { me_jid: live.meJid } : {}),
    })
    .eq('company_id', companyId);
}

const HARD_OFFLINE_STATUSES = new Set([
  'STOPPED',
  'DISCONNECTED',
  'FAILED',
  'SCAN_QR_CODE',
]);

/** ¿Puede enviarse un mensaje? Tolera last_status en BD desactualizado si hay me_jid activo. */
export function isWhatsappSessionReadyForSend(
  lastStatus: string | null | undefined,
  meJid: string | null | undefined,
): boolean {
  const status = (lastStatus ?? '').toUpperCase();
  if (status === 'WORKING') return true;
  if (HARD_OFFLINE_STATUSES.has(status)) return false;
  return !!meJid;
}

/** Refresca estado en proveedor + BD y devuelve si la sesión está lista para enviar. */
export async function ensureWhatsappSessionReadyForSend(
  admin: SupabaseClient,
  companyId: string,
  cfg: WhatsappProviderConfig & { last_status?: string | null; me_jid?: string | null },
): Promise<{
  ready: boolean;
  lastStatus: string | null;
  meJid: string | null;
  error?: string;
}> {
  let lastStatus = cfg.last_status ?? null;
  let meJid = cfg.me_jid ?? null;

  try {
    const live = await fetchLiveWhatsappSessionStatus(cfg);
    lastStatus = live.internalStatus;
    meJid = live.meJid ?? meJid;
    await persistWhatsappSessionStatus(admin, companyId, {
      internalStatus: live.internalStatus,
      meJid,
    });
  } catch (e) {
    console.warn('ensureWhatsappSessionReadyForSend: live check failed', e);
  }

  const ready = isWhatsappSessionReadyForSend(lastStatus, meJid);
  return {
    ready,
    lastStatus,
    meJid,
    error: ready
      ? undefined
      : `Sesión WhatsApp no conectada (${lastStatus ?? 'desconocido'})`,
  };
}
