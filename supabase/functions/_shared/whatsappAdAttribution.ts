/** Extracción de señales CTWA / anuncio Meta desde payloads WAHA/OpenWA/Baileys/Cloud API. */

export type WhatsappAdAttribution = {
  /**
   * true solo con evidencia verificable de clic en anuncio Meta/CTWA
   * (`ctwa_clid`, `source_id` de anuncio, `source_type=ad`, o URL Meta Ads).
   */
  fromAd: boolean;
  /** Nivel de confianza: verified = IDs Meta; likely = source_type/URL; none = sin evidencia. */
  confidence: 'verified' | 'likely' | 'none';
  campaign: string | null;
  formName: string | null;
  sourceUrl: string | null;
  sourceId: string | null;
  ctwaClid: string | null;
  sourceType: string | null;
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

/** Nodos con al menos un campo útil de atribución (evita objetos vacíos anidados). */
function hasAttributionPayload(node: JsonRecord): boolean {
  const keys = [
    'ctwa_clid',
    'ctwaClid',
    'source_id',
    'sourceId',
    'source_url',
    'sourceUrl',
    'source_type',
    'sourceType',
    'advertisementId',
    'adId',
    'ad_id',
    'headline',
    'title',
    'body',
    'description',
    'mediaType',
    'media_type',
    'thumbnailUrl',
    'thumbnail_url',
    'image_url',
    'video_url',
  ];
  return keys.some((k) => {
    const v = node[k];
    return typeof v === 'string' ? v.trim().length > 0 : v != null && v !== '';
  });
}

function collectExternalAdReply(node: unknown, out: JsonRecord[]): void {
  const r = asRecord(node);
  if (!r) return;
  const reply = asRecord(r.externalAdReply) ?? asRecord(r.external_ad_reply);
  if (reply && hasAttributionPayload(reply)) out.push(reply);
  for (const key of Object.keys(r)) {
    const child = r[key];
    if (child && typeof child === 'object') collectExternalAdReply(child, out);
  }
}

function collectReferralNodes(node: unknown, out: JsonRecord[]): void {
  const r = asRecord(node);
  if (!r) return;
  const referral = asRecord(r.referral);
  if (referral && hasAttributionPayload(referral)) out.push(referral);
  const ctwa = asRecord(r.ctwaInfo) ?? asRecord(r.ctwa_info);
  if (ctwa && hasAttributionPayload(ctwa)) out.push(ctwa);
  for (const key of Object.keys(r)) {
    if (key === 'referral' || key === 'ctwaInfo' || key === 'ctwa_info') continue;
    const child = r[key];
    if (child && typeof child === 'object') collectReferralNodes(child, out);
  }
}

function isAdSourceType(value: string | null | undefined): boolean {
  if (!value?.trim()) return false;
  const n = value.trim().toLowerCase();
  return n === 'ad' || n === 'ads' || n === 'advertisement' || n === 'post';
}

/** URLs típicas de Click-to-WhatsApp / Meta Ads en el payload. */
export function isMetaAdSourceUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  const u = url.trim().toLowerCase();
  if (
    u.includes('facebook.com') ||
    u.includes('fb.com') ||
    u.includes('fb.me') ||
    u.includes('instagram.com') ||
    u.includes('l.facebook.com') ||
    u.includes('lm.facebook.com') ||
    u.includes('fbwat.ch')
  ) {
    return true;
  }
  return /(?:^|[/?#.&])ads?(?:[=/?&#.]|$)/i.test(u);
}

/**
 * Evidencia verificable de campaña Meta / CTWA.
 * Oro: `ctwa_clid`. Plata: `source_id` de anuncio. Bronce: source_type=ad o URL Meta.
 */
export function isVerifiedMetaAdAttribution(
  attr: Pick<
    WhatsappAdAttribution,
    'ctwaClid' | 'sourceId' | 'sourceType' | 'sourceUrl' | 'fromAd' | 'confidence'
  >,
): boolean {
  return attr.fromAd && attr.confidence !== 'none';
}

/**
 * Intenta leer atribución de anuncio / CTWA del `raw` del mensaje.
 * WAHA/Baileys a veces incluye `contextInfo.externalAdReply`; Cloud API usa `referral`.
 *
 * `fromAd` exige identificadores o tipado de anuncio Meta — no basta con un nodo vacío
 * ni con campañas/formularios configurados por defecto en Suite.
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
  let sourceType: string | null = null;
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
    sourceType =
      sourceType ?? asString(reply.sourceType) ?? asString(reply.source_type);
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
    sourceType = sourceType ?? asString(ref.source_type) ?? asString(ref.sourceType);
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

  const hasClid = !!ctwaClid;
  const hasSourceId = !!sourceId;
  const hasAdType = isAdSourceType(sourceType);
  const hasMetaUrl = isMetaAdSourceUrl(sourceUrl);

  let confidence: WhatsappAdAttribution['confidence'] = 'none';
  if (hasClid || hasSourceId) confidence = 'verified';
  else if (hasAdType || hasMetaUrl) confidence = 'likely';

  const fromAd = confidence !== 'none';

  if (fromAd && !campaign) campaign = 'WhatsApp Meta (CTWA)';
  if (fromAd && !formName) formName = 'Click to WhatsApp';

  pushExtra(extras, 'ad_source_url', sourceUrl);
  pushExtra(extras, 'ad_source_id', sourceId);
  pushExtra(extras, 'ctwa_clid', ctwaClid);
  pushExtra(extras, 'ad_source_type', sourceType);
  pushExtra(extras, 'ad_headline', headline);
  pushExtra(extras, 'ad_body', body);
  pushExtra(extras, 'ad_media_type', mediaType);
  if (fromAd) pushExtra(extras, 'ad_attribution_confidence', confidence);

  return {
    fromAd,
    confidence,
    campaign,
    formName,
    sourceUrl,
    sourceId,
    ctwaClid,
    sourceType,
    headline,
    body,
    mediaType,
    extras,
  };
}
