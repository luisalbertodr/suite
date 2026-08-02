import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { WhatsappAdAttribution } from './whatsappAdAttribution.ts';

export type MetaFormInboundRow = {
  id: string;
  form_id: string;
  form_name: string | null;
  whatsapp_inbound_default?: boolean | null;
  whatsapp_automation_enabled?: boolean | null;
  whatsapp_initial_audio_path?: string | null;
};

const GENERIC_FORM_NAMES = new Set([
  'click to whatsapp',
  'click-to-whatsapp',
  'ctwa',
  'whatsapp',
  'whatsapp entrante',
  'whatsapp meta (ctwa)',
  'whatsapp meta',
]);

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function tokens(s: string): string[] {
  return norm(s)
    .split(/[^a-z0-9áéíóúüñ]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3)
    .filter((t) => !['form', 'formulario', 'meta', 'lead', 'ads', 'the', 'and', 'para'].includes(t));
}

function scoreNameMatch(haystack: string, needle: string): number {
  const h = norm(haystack);
  const n = norm(needle);
  if (!h || !n) return 0;
  if (h === n) return 100;
  if (h.includes(n) || n.includes(h)) return 80;
  const ht = new Set(tokens(haystack));
  const nt = tokens(needle);
  if (!nt.length || !ht.size) return 0;
  let hit = 0;
  for (const t of nt) if (ht.has(t)) hit += 1;
  const ratio = hit / nt.length;
  if (ratio >= 0.6 && hit >= 2) return Math.round(50 + ratio * 30);
  if (ratio === 1 && hit >= 1) return 55;
  return 0;
}

function isGenericLabel(value: string | null | undefined): boolean {
  if (!value?.trim()) return true;
  return GENERIC_FORM_NAMES.has(norm(value));
}

/** Busca el meta_form al que deben asociarse leads WhatsApp / CTWA. */
export async function resolveMetaFormForWhatsappInbound(
  admin: SupabaseClient,
  companyId: string,
  hints: {
    campaign?: string | null;
    formName?: string | null;
    attribution?: WhatsappAdAttribution | null;
  } = {},
): Promise<MetaFormInboundRow | null> {
  const { data, error } = await admin
    .from('meta_forms')
    .select(
      'id, form_id, form_name, whatsapp_inbound_default, whatsapp_automation_enabled, whatsapp_initial_audio_path',
    )
    .eq('company_id', companyId);
  if (error) throw error;
  const rows = (data ?? []) as MetaFormInboundRow[];
  if (!rows.length) return null;

  const candidates: string[] = [];
  for (const v of [
    hints.campaign,
    hints.formName,
    hints.attribution?.campaign,
    hints.attribution?.formName,
    hints.attribution?.headline,
    hints.attribution?.body,
  ]) {
    if (v?.trim() && !isGenericLabel(v)) candidates.push(v.trim());
  }

  let best: { row: MetaFormInboundRow; score: number } | null = null;
  for (const row of rows) {
    const fn = row.form_name?.trim();
    if (!fn) continue;
    for (const c of candidates) {
      const score = scoreNameMatch(fn, c);
      if (score > 0 && (!best || score > best.score)) best = { row, score };
    }
  }
  if (best && best.score >= 55) return best.row;

  const inboundDefault = rows.find((r) => r.whatsapp_inbound_default);
  if (inboundDefault) return inboundDefault;

  // Un solo formulario con audio de campaña → usarlo para CTWA.
  const withAudio = rows.filter(
    (r) => !!(r.whatsapp_initial_audio_path && r.whatsapp_initial_audio_path.trim()),
  );
  if (withAudio.length === 1) return withAudio[0];

  return null;
}

export function leadFieldsFromMetaForm(
  form: MetaFormInboundRow,
  attribution?: WhatsappAdAttribution | null,
): {
  meta_form_id: string;
  form_name: string | null;
  campaign: string | null;
} {
  const formName = form.form_name?.trim() || null;
  const campaign =
    (attribution?.campaign?.trim() && !isGenericLabel(attribution.campaign)
      ? attribution.campaign.trim()
      : null) ||
    formName ||
    'WhatsApp Meta';
  return {
    meta_form_id: form.id,
    form_name: formName,
    campaign,
  };
}
