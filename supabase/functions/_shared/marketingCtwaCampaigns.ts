import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import type { WhatsappAdAttribution } from './whatsappAdAttribution.ts';

export type MarketingCtwaCampaignRow = {
  id: string;
  company_id: string;
  name: string;
  match_keywords: string;
  intro_message: string | null;
  intro_enabled: boolean;
  meta_form_id: string | null;
  is_default: boolean;
  enabled: boolean;
  sort_order: number;
};

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function parseCtwaKeywords(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[\n,;]+/)
    .map((k) => k.trim())
    .filter((k) => k.length >= 2);
}

function haystackFromHints(hints: {
  campaign?: string | null;
  formName?: string | null;
  firstMessageBody?: string | null;
  attribution?: WhatsappAdAttribution | null;
}): string {
  return [
    hints.campaign,
    hints.formName,
    hints.firstMessageBody,
    hints.attribution?.campaign,
    hints.attribution?.formName,
    hints.attribution?.headline,
    hints.attribution?.body,
    hints.attribution?.sourceUrl,
  ]
    .filter((v): v is string => !!v?.trim())
    .join('\n');
}

function scoreCampaignMatch(campaign: MarketingCtwaCampaignRow, haystack: string): number {
  const h = norm(haystack);
  if (!h) return 0;
  const name = norm(campaign.name);
  if (name && (h.includes(name) || name.includes(h))) return 90;

  let best = 0;
  for (const kw of parseCtwaKeywords(campaign.match_keywords)) {
    const k = norm(kw);
    if (!k) continue;
    if (h.includes(k)) best = Math.max(best, 70 + Math.min(20, k.length));
  }
  return best;
}

export async function listMarketingCtwaCampaigns(
  admin: SupabaseClient,
  companyId: string,
  onlyEnabled = true,
): Promise<MarketingCtwaCampaignRow[]> {
  let q = admin
    .from('marketing_ctwa_campaigns')
    .select(
      'id, company_id, name, match_keywords, intro_message, intro_enabled, meta_form_id, is_default, enabled, sort_order',
    )
    .eq('company_id', companyId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  if (onlyEnabled) q = q.eq('enabled', true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as MarketingCtwaCampaignRow[];
}

/**
 * Empareja una campaña CTWA por keywords / nombre.
 * El fallback a `is_default` / única campaña solo aplica si `allowDefaultFallback`
 * (p. ej. cuando ya hay evidencia Meta/CTWA en el mensaje). Sin eso, no atribuir
 * campañas por defecto a chats orgánicos.
 */
export async function resolveMarketingCtwaCampaign(
  admin: SupabaseClient,
  companyId: string,
  hints: {
    campaign?: string | null;
    formName?: string | null;
    firstMessageBody?: string | null;
    attribution?: WhatsappAdAttribution | null;
    /** Solo true con señal Meta verificable en el raw del mensaje. */
    allowDefaultFallback?: boolean;
  } = {},
): Promise<MarketingCtwaCampaignRow | null> {
  const rows = await listMarketingCtwaCampaigns(admin, companyId, true);
  if (!rows.length) return null;

  const haystack = haystackFromHints(hints);
  let best: { row: MarketingCtwaCampaignRow; score: number } | null = null;
  for (const row of rows) {
    const score = scoreCampaignMatch(row, haystack);
    if (score > 0 && (!best || score > best.score)) best = { row, score };
  }
  if (best && best.score >= 70) return best.row;

  if (!hints.allowDefaultFallback) return null;

  const fallback = rows.find((r) => r.is_default) ?? (rows.length === 1 ? rows[0] : null);
  return fallback ?? null;
}
