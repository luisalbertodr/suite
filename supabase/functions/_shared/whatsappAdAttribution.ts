/** Extracción best-effort de señales CTWA / anuncio Meta desde payloads WAHA/OpenWA/Baileys. */

export type WhatsappAdAttribution = {
  /** true si hay indicios de clic en anuncio / CTWA */
  fromAd: boolean;
  campaign: string | null;
  formName: string | null;
  sourceUrl: string | null;
  sourceId: string | null;
  ctwaClid: string | null;
  headline: string | null;
  body: string | null;
  mediaType: string | null;
  /** Fragmentos útiles para field_data / depuración */
  extras: Array<{ name: string; values: string[] }>;
};

type JsonRecord = Record<string, unknown>;

function asRecord(v: unknown): JsonRecord | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as JsonRecord) : null;
}

function asString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t || null;
}

function pushExtra(
  extras: Array<{ name: string; values: string[] }>,
  name: string,
  value: string | null | undefined,
) {
  const v = value?.trim();
  if (!v) return;
  extras.push({ name, values: [v] });
}

function collectExternalAdReply(node: unknown, out: JsonRecord[]): void {
  const r = asRecord(node);
  if (!r) return;
  const reply = asRecord(r.externalAdReply) ?? asRecord(r.external_ad_reply);
  if (reply) out.push(reply);
  for (const key of Object.keys(r)) {
    const child = r[key];
    if (child && typeof child === 'object') collectExternalAdReply(child, out);
  }
}

function collectReferralNodes(node: unknown, out: JsonRecord[]): void {
  const r = asRecord(node);
  if (!r) return;
  const referral = asRecord(r.referral);
  if (referral) out.push(referral);
  const ctwa = asRecord(r.ctwaInfo) ?? asRecord(r.ctwa_info);
  if (ctwa) out.push(ctwa);
  for (const key of Object.keys(r)) {
    if (key === 'referral' || key === 'ctwaInfo' || key === 'ctwa_info') continue;
    const child = r[key];
    if (child && typeof child === 'object') collectReferralNodes(child, out);
  }
}

/**
 * Intenta leer atribución de anuncio / CTWA del `raw` del mensaje.
 * WAHA/Baileys a veces incluye `contextInfo.externalAdReply`; Cloud API usa `referral`.
 */
export function extractWhatsappAdAttribution(raw: unknown): WhatsappAdAttribution {
  const extras: Array<{ name: string; values: string[] }> = [];
  const replies: JsonRecord[] = [];
  const referrals: JsonRecord[] = [];
  collectExternalAdReply(raw, replies);
  collectReferralNodes(raw, referrals);

  let campaign: string | null = null;
  let formName: string | null = null;
  let sourceUrl: string | null = null;
  let sourceId: string | null = null;
  let ctwaClid: string | null = null;
  let headline: string | null = null;
  let body: string | null = null;
  let mediaType: string | null = null;

  for (const reply of replies) {
    headline = headline ?? asString(reply.title) ?? asString(reply.headline);
    body = body ?? asString(reply.body) ?? asString(reply.description);
    sourceUrl = sourceUrl ?? asString(reply.sourceUrl) ?? asString(reply.source_url);
    sourceId =
      sourceId ??
      asString(reply.sourceId) ??
      asString(reply.source_id) ??
      asString(reply.advertisementId) ??
      asString(reply.adId) ??
      asString(reply.ad_id);
    mediaType = mediaType ?? asString(reply.mediaType) ?? asString(reply.media_type);
    campaign =
      campaign ??
      asString(reply.sourceApp) ??
      asString(reply.source_app) ??
      headline;
  }

  for (const ref of referrals) {
    sourceUrl = sourceUrl ?? asString(ref.source_url) ?? asString(ref.sourceUrl);
    sourceId = sourceId ?? asString(ref.source_id) ?? asString(ref.sourceId);
    ctwaClid = ctwaClid ?? asString(ref.ctwa_clid) ?? asString(ref.ctwaClid);
    headline = headline ?? asString(ref.headline) ?? asString(ref.title);
    body = body ?? asString(ref.body);
    mediaType = mediaType ?? asString(ref.media_type) ?? asString(ref.mediaType);
    formName =
      formName ??
      asString(ref.source_type) ??
      asString(ref.sourceType);
    campaign =
      campaign ??
      asString(ref.headline) ??
      asString(ref.title) ??
      asString(ref.body);
  }

  const fromAd = replies.length > 0 || referrals.length > 0 || !!ctwaClid || !!sourceId;

  if (fromAd && !campaign) campaign = 'WhatsApp Meta (CTWA)';
  if (fromAd && !formName) formName = 'Click to WhatsApp';

  pushExtra(extras, 'ad_source_url', sourceUrl);
  pushExtra(extras, 'ad_source_id', sourceId);
  pushExtra(extras, 'ctwa_clid', ctwaClid);
  pushExtra(extras, 'ad_headline', headline);
  pushExtra(extras, 'ad_body', body);
  pushExtra(extras, 'ad_media_type', mediaType);

  return {
    fromAd,
    campaign,
    formName,
    sourceUrl,
    sourceId,
    ctwaClid,
    headline,
    body,
    mediaType,
    extras,
  };
}
