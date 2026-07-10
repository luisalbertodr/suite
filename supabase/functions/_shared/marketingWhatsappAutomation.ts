import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildMarketingFieldTemplateVars } from './marketingWhatsappFieldVars.ts';
import {
  loadAutomationSettings,
  logAutomationSend,
  resolveRecipientPhone,
  wrapMessageForTestMode,
  isWhatsappTestChatId,
  type AutomationSendType,
} from './whatsappAutomationDispatch.ts';
import {
  providerSendMedia,
  providerSendText,
} from './whatsappProviderClient.ts';
import {
  buildDefaultStoragePublicUrl,
  isOggOpusBase64,
  openwaMediaRequiresPublicUrl,
  openwaVoiceNoteFormatError,
  uploadWhatsappOutgoingMedia,
  wahaVoiceRequiresPublicUrl,
} from './whatsappOutgoingMediaStorage.ts';
import {
  normalizeWhatsappProvider,
  resolveWhatsappCredentials,
  type WhatsappProvider,
  type WhatsappProviderConfig,
} from './whatsappProviderTypes.ts';
import { ensureWhatsappSessionReadyForSend } from './whatsappSessionStatus.ts';

export type WhatsappConfigRow = {
  company_id: string;
  provider?: WhatsappProvider | string | null;
  base_url: string | null;
  api_key: string | null;
  session_name: string;
  waha_base_url?: string | null;
  waha_api_key?: string | null;
  waha_session_name?: string | null;
  openwa_base_url?: string | null;
  openwa_api_key?: string | null;
  openwa_session_name?: string | null;
  webhook_secret?: string | null;
  default_country_code: string | null;
  enabled: boolean;
  last_status: string | null;
  me_jid: string | null;
};

function asProviderConfig(cfg: WhatsappConfigRow): WhatsappProviderConfig {
  return resolveWhatsappCredentials(cfg);
}

export type MetaFormAutomation = {
  id: string;
  form_id: string;
  form_name: string | null;
  whatsapp_automation_enabled: boolean;
  whatsapp_initial_message: string | null;
  whatsapp_initial_audio_enabled?: boolean | null;
  whatsapp_initial_audio_path?: string | null;
  whatsapp_initial_audio_filename?: string | null;
  whatsapp_initial_audio_mime?: string | null;
  whatsapp_reply_1_message: string | null;
  whatsapp_reply_2_message: string | null;
  whatsapp_reply_invalid_message: string | null;
  whatsapp_reminder_message: string | null;
  whatsapp_reminder_delay_hours?: number | null;
  whatsapp_reminder_enabled?: boolean | null;
  stripe_deposit_enabled?: boolean;
  stripe_deposit_amount_cents?: number | null;
};

export type InitialWhatsappSendKind = 'text' | 'audio' | 'audio_link' | 'voice';

/** Tipo de bienvenida automática al lead (solo texto; el audio es manual desde el chat). */
export function resolveInitialWhatsappSendKind(
  form: MetaFormAutomation,
): InitialWhatsappSendKind | null {
  if (!form.whatsapp_automation_enabled) return null;
  if (form.whatsapp_initial_message?.trim()) return 'text';
  return null;
}

export function formHasInitialWhatsappContent(form: MetaFormAutomation): boolean {
  return resolveInitialWhatsappSendKind(form) !== null;
}

export function metaFormHasCampaignAudio(form: MetaFormAutomation | null): boolean {
  return !!(
    form?.whatsapp_initial_audio_enabled &&
    form.whatsapp_initial_audio_path?.trim()
  );
}

export type MarketingLeadAutomationRow = {
  id: string;
  company_id: string;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  email?: string | null;
  campaign?: string | null;
  form_name?: string | null;
  appointment_at?: string | null;
  appointment_label?: string | null;
  source?: string | null;
  meta_form_id: string | null;
  field_data?: unknown;
  wa_automation_status: string;
  wa_automation_initial_sent_at?: string | null;
  wa_automation_reminder_sent_at?: string | null;
};

export type WhatsappTemplateContext = Pick<
  MarketingLeadAutomationRow,
  | 'first_name'
  | 'last_name'
  | 'phone'
  | 'email'
  | 'campaign'
  | 'form_name'
  | 'appointment_at'
  | 'appointment_label'
  | 'source'
  | 'field_data'
>;

/** Variables documentadas en Configuración → Meta. */
export const WHATSAPP_TEMPLATE_VAR_KEYS = [
  'nombre',
  'nombre_completo',
  'apellido',
  'telefono',
  'email',
  'oferta',
  'campana',
  'campaña',
  'formulario',
  'cita',
  'fecha_cita',
  'origen',
] as const;

function normalizeTemplateKey(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function formatSourceLabel(source: string | null | undefined): string {
  const s = (source ?? '').trim().toLowerCase();
  if (s === 'facebook') return 'Facebook';
  if (s === 'instagram') return 'Instagram';
  if (s === 'meta') return 'Meta';
  return source?.trim() ?? '';
}

function formatAppointmentDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function resolveAppointmentText(ctx: WhatsappTemplateContext): string {
  const label = ctx.appointment_label?.trim();
  const dateText = formatAppointmentDate(ctx.appointment_at);
  if (label && dateText) return `${dateText} (${label})`;
  return label || dateText || '';
}

export function buildWhatsappTemplateVars(
  ctx: WhatsappTemplateContext,
  form?: Pick<MetaFormAutomation, 'form_name' | 'form_id'>,
): Record<string, string> {
  const fullName = [ctx.first_name, ctx.last_name].filter(Boolean).join(' ').trim();
  const firstName = ctx.first_name?.trim() || fullName.split(/\s+/)[0] || '';
  const campaign = ctx.campaign?.trim() ?? '';
  const formName = ctx.form_name?.trim() || form?.form_name?.trim() || '';

  return {
    nombre: firstName,
    nombre_completo: fullName,
    apellido: ctx.last_name?.trim() ?? '',
    telefono: ctx.phone?.trim() ?? '',
    email: ctx.email?.trim() ?? '',
    oferta: campaign,
    campana: campaign,
    campaña: campaign,
    formulario: formName,
    cita: resolveAppointmentText(ctx),
    fecha_cita: formatAppointmentDate(ctx.appointment_at),
    origen: formatSourceLabel(ctx.source),
  };
}

/** Sustituye {nombre}, {oferta}, etc. en plantillas de WhatsApp automático. */
export function renderWhatsappTemplate(
  template: string,
  ctx: WhatsappTemplateContext,
  form?: Pick<MetaFormAutomation, 'form_name' | 'form_id'>,
  fieldData?: unknown,
): string {
  const vars = {
    ...buildWhatsappTemplateVars(ctx, form),
    ...buildMarketingFieldTemplateVars(fieldData ?? (ctx as { field_data?: unknown }).field_data),
  };
  return template.replace(/\{([a-zA-ZáéíóúÁÉÍÓÚñÑ0-9_]+)\}/g, (match, rawKey: string) => {
    const key = normalizeTemplateKey(rawKey);
    if (key in vars) return vars[key];
    return match;
  });
}

function trimSlash(s: string): string {
  return s.replace(/\/+$/, '');
}

export function normalizeChatId(raw: string, defaultCountryCode: string | null): string {
  let s = String(raw ?? '').trim();
  if (!s) return s;
  if (s.includes('@')) return s;
  s = s.replace(/[^0-9]/g, '');
  if (!s) return raw;
  if (defaultCountryCode && s.length <= 9) s = `${defaultCountryCode}${s}`;
  return `${s}@c.us`;
}

export function leadDisplayName(lead: Pick<MarketingLeadAutomationRow, 'first_name' | 'last_name'>): string | null {
  const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim();
  return name || null;
}

export function parseReplyChoice(body: string | null | undefined): '1' | '2' | null {
  if (!body) return null;
  const t = body.trim().toLowerCase().replace(/\s+/g, '');
  if (!t) return null;
  if (t === '1' || t === 'uno' || t === 'opcion1' || t === 'opción1' || /^1[.!]?$/.test(t)) return '1';
  if (t === '2' || t === 'dos' || t === 'opcion2' || t === 'opción2' || /^2[.!]?$/.test(t)) return '2';
  return null;
}

function isWahaPlusOnlyMediaError(error: unknown, provider: WhatsappProvider): boolean {
  if (provider !== 'waha') return false;
  const msg = error instanceof Error ? error.message : String(error ?? '');
  return /plus version|AvailableInPlusVersion|sendVoice|sendFile/i.test(msg);
}

function extractRemoteFromSendRaw(raw: unknown, fallbackChatId: string): string | null {
  const res = raw as {
    id?: { _serialized?: string; remote?: string };
    _data?: { id?: { _serialized?: string; remote?: string }; to?: string };
    to?: string;
  };
  const detectedRemote =
    res?.id?.remote ??
    res?._data?.id?.remote ??
    res?.to ??
    res?._data?.to ??
    null;
  const fromSerialized = (() => {
    const s = res?.id?._serialized ?? res?._data?.id?._serialized;
    if (!s) return null;
    const m = /^(?:true|false)_(.+?)_/.exec(s);
    return m ? m[1] : null;
  })();
  return detectedRemote ?? fromSerialized ?? fallbackChatId;
}

async function persistOutgoingMessage(
  admin: SupabaseClient,
  cfg: WhatsappConfigRow,
  companyId: string,
  resolvedChatId: string,
  wahaId: string | null,
  ts: string,
  type: string,
  body: string,
  media?: { mime: string; filename: string },
  raw?: unknown,
): Promise<string> {
  const detectedRemote = extractRemoteFromSendRaw(raw, resolvedChatId);
  let chatId = resolvedChatId;
  if (detectedRemote && detectedRemote.includes('@') && detectedRemote !== chatId) {
    await admin
      .from('whatsapp_messages')
      .update({ chat_id: detectedRemote })
      .eq('company_id', companyId)
      .eq('chat_id', chatId);
    await admin
      .from('whatsapp_chats')
      .update({ chat_id: detectedRemote })
      .eq('company_id', companyId)
      .eq('chat_id', chatId);
    chatId = detectedRemote;
  }

  if (wahaId) {
    await admin.from('whatsapp_messages').upsert(
      {
        company_id: companyId,
        chat_id: chatId,
        source_provider: normalizeWhatsappProvider(cfg.provider),
        waha_message_id: wahaId,
        from_jid: cfg.me_jid ?? null,
        from_me: true,
        type,
        body,
        media_mime_type: media?.mime ?? null,
        media_filename: media?.filename ?? null,
        ack: 0,
        timestamp: ts,
        raw: raw as unknown,
      },
      { onConflict: 'company_id,waha_message_id', ignoreDuplicates: false },
    );
  }

  await admin.from('whatsapp_chats').upsert(
    {
      company_id: companyId,
      chat_id: chatId,
      is_group: false,
      last_message_preview: body.slice(0, 200),
      last_message_at: ts,
      last_message_from_me: true,
    },
    { onConflict: 'company_id,chat_id', ignoreDuplicates: false },
  );

  return chatId;
}

export async function loadWhatsappConfig(
  admin: SupabaseClient,
  companyId: string,
): Promise<WhatsappConfigRow | null> {
  const { data, error } = await admin
    .from('whatsapp_config')
    .select(
      'company_id, provider, base_url, api_key, session_name, waha_base_url, waha_api_key, waha_session_name, openwa_base_url, openwa_api_key, openwa_session_name, webhook_secret, default_country_code, enabled, last_status, me_jid',
    )
    .eq('company_id', companyId)
    .maybeSingle();
  if (error) throw error;
  return (data as WhatsappConfigRow | null) ?? null;
}

export async function loadMetaFormAutomation(
  admin: SupabaseClient,
  metaFormId: string,
): Promise<MetaFormAutomation | null> {
  const { data, error } = await admin
    .from('meta_forms')
    .select(
      'id, form_id, form_name, whatsapp_automation_enabled, whatsapp_initial_message, whatsapp_initial_audio_enabled, whatsapp_initial_audio_path, whatsapp_initial_audio_filename, whatsapp_initial_audio_mime, whatsapp_reply_1_message, whatsapp_reply_2_message, whatsapp_reply_invalid_message, whatsapp_reminder_message, whatsapp_reminder_delay_hours, whatsapp_reminder_enabled, stripe_deposit_enabled, stripe_deposit_amount_cents',
    )
    .eq('id', metaFormId)
    .maybeSingle();
  if (error) throw error;
  return (data as MetaFormAutomation | null) ?? null;
}

async function sendWhatsappText(
  admin: SupabaseClient,
  cfg: WhatsappConfigRow,
  companyId: string,
  chatId: string,
  text: string,
): Promise<{ chatId: string; wahaId: string | null }> {
  const providerCfg = asProviderConfig(cfg);
  const sent = await providerSendText(providerCfg, chatId, text);
  const wahaId = sent.messageId;
  const ts = sent.timestamp
    ? new Date(sent.timestamp * 1000).toISOString()
    : new Date().toISOString();
  const resolvedChatId = await persistOutgoingMessage(
    admin,
    cfg,
    companyId,
    chatId,
    wahaId,
    ts,
    'text',
    text,
    undefined,
    sent.raw,
  );
  return { chatId: resolvedChatId, wahaId };
}

const WA_AUDIO_STORAGE_BUCKET = 'documents';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function loadStorageFileBytes(
  admin: SupabaseClient,
  storagePath: string,
): Promise<Uint8Array> {
  const { data, error } = await admin.storage.from(WA_AUDIO_STORAGE_BUCKET).download(storagePath);
  if (error) throw new Error(`No se pudo cargar el audio: ${error.message}`);
  return new Uint8Array(await data.arrayBuffer());
}

function normalizeWhatsappAudioMime(mime: string, filename: string): string {
  const m = mime.toLowerCase();
  const f = filename.toLowerCase();
  if (m.includes('ogg') || m.includes('opus') || m === 'application/ogg') return 'audio/ogg';
  if (m && m !== 'application/octet-stream' && m.startsWith('audio/')) return m;
  if (f.endsWith('.ogg') || f.endsWith('.opus')) return 'audio/ogg';
  if (f.endsWith('.mp3')) return 'audio/mpeg';
  if (f.endsWith('.m4a')) return 'audio/mp4';
  if (f.endsWith('.wav')) return 'audio/wav';
  if (f.endsWith('.webm')) return 'audio/webm';
  return 'audio/ogg';
}

async function createStorageSignedUrl(
  admin: SupabaseClient,
  bucket: string,
  path: string,
  expiresInSeconds = 60 * 60 * 24 * 7,
): Promise<string> {
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(`No se pudo firmar URL del audio: ${error?.message ?? 'sin URL'}`);
  }
  return data.signedUrl;
}

function isOggVoiceAttachment(filename: string, mime: string): boolean {
  const f = filename.toLowerCase();
  const m = mime.toLowerCase();
  return (
    f.endsWith('.ogg') ||
    f.endsWith('.opus') ||
    m.includes('ogg') ||
    m.includes('opus') ||
    m === 'application/ogg'
  );
}

async function sendWhatsappMedia(
  admin: SupabaseClient,
  cfg: WhatsappConfigRow,
  companyId: string,
  chatId: string,
  media: { base64: string; mime: string; filename: string },
): Promise<{ chatId: string; wahaId: string | null; mediaType: 'voice' | 'audio' }> {
  const providerCfg = asProviderConfig(cfg);
  const provider = normalizeWhatsappProvider(providerCfg.provider);
  const normalizedMime = normalizeWhatsappAudioMime(media.mime, media.filename);
  const looksLikeOggVoice = isOggVoiceAttachment(media.filename, normalizedMime);

  if (
    provider === 'openwa' &&
    looksLikeOggVoice &&
    !isOggOpusBase64(media.base64)
  ) {
    throw new Error(openwaVoiceNoteFormatError());
  }

  // Misma lógica que el chat manual: .ogg/.opus → nota de voz.
  const mediaType = looksLikeOggVoice ? 'voice' : 'audio';
  const sendMime = mediaType === 'voice' ? 'audio/ogg' : normalizedMime;
  const sendFilename = mediaType === 'voice' ? 'voice.ogg' : media.filename;
  const preview = mediaType === 'voice' ? '[nota de voz]' : `[audio] ${media.filename}`;
  const mediaPayload = {
    base64: media.base64,
    mime: sendMime,
    filename: sendFilename,
  };
  if (
    (provider === 'openwa' && openwaMediaRequiresPublicUrl(mediaType)) ||
    wahaVoiceRequiresPublicUrl(providerCfg.provider, mediaType)
  ) {
    mediaPayload.url = await uploadWhatsappOutgoingMedia(
      admin,
      companyId,
      media.base64,
      sendMime,
      buildDefaultStoragePublicUrl,
      sendFilename,
    );
  }
  const sent = await providerSendMedia(providerCfg, chatId, mediaType, mediaPayload);
  const wahaId = sent.messageId;
  const ts = sent.timestamp
    ? new Date(sent.timestamp * 1000).toISOString()
    : new Date().toISOString();
  const resolvedChatId = await persistOutgoingMessage(
    admin,
    cfg,
    companyId,
    chatId,
    wahaId,
    ts,
    mediaType,
    preview,
    { mime: sendMime, filename: sendFilename },
    sent.raw,
  );
  return { chatId: resolvedChatId, wahaId, mediaType };
}

async function sendAutomatedLeadMessage(
  admin: SupabaseClient,
  cfg: WhatsappConfigRow,
  companyId: string,
  intendedPhone: string,
  text: string,
  meta: {
    automation_type: AutomationSendType;
    reference_id: string;
    contactName?: string | null;
  },
): Promise<{ chatId: string; wahaId: string | null }> {
  const settings = await loadAutomationSettings(admin, companyId);
  const { chatPhone, intendedLabel } = resolveRecipientPhone(intendedPhone, settings);
  const body = wrapMessageForTestMode(
    text,
    settings,
    meta.contactName ?? intendedLabel,
  );
  const chatId = normalizeChatId(chatPhone, cfg.default_country_code);
  try {
    const sent = await sendWhatsappText(admin, cfg, companyId, chatId, body);
    await logAutomationSend(admin, {
      company_id: companyId,
      automation_type: meta.automation_type,
      reference_id: meta.reference_id,
      intended_phone: intendedPhone,
      sent_to_phone: chatPhone,
      message_preview: body,
      success: true,
    });
    return sent;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al enviar';
    await logAutomationSend(admin, {
      company_id: companyId,
      automation_type: meta.automation_type,
      reference_id: meta.reference_id,
      intended_phone: intendedPhone,
      sent_to_phone: chatPhone,
      message_preview: body,
      success: false,
      error: msg,
    });
    throw e;
  }
}

async function sendAutomatedLeadAudio(
  admin: SupabaseClient,
  cfg: WhatsappConfigRow,
  companyId: string,
  intendedPhone: string,
  media: { base64: string; mime: string; filename: string },
  meta: {
    automation_type: AutomationSendType;
    reference_id: string;
    contactName?: string | null;
  },
): Promise<{ chatId: string; wahaId: string | null }> {
  const settings = await loadAutomationSettings(admin, companyId);
  const { chatPhone } = resolveRecipientPhone(intendedPhone, settings);
  const chatId = normalizeChatId(chatPhone, cfg.default_country_code);
  const preview = `[audio] ${media.filename}`;
  try {
    const sent = await sendWhatsappMedia(admin, cfg, companyId, chatId, media);
    await logAutomationSend(admin, {
      company_id: companyId,
      automation_type: meta.automation_type,
      reference_id: meta.reference_id,
      intended_phone: intendedPhone,
      sent_to_phone: chatPhone,
      message_preview: preview,
      success: true,
    });
    return sent;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al enviar';
    await logAutomationSend(admin, {
      company_id: companyId,
      automation_type: meta.automation_type,
      reference_id: meta.reference_id,
      intended_phone: intendedPhone,
      sent_to_phone: chatPhone,
      message_preview: preview,
      success: false,
      error: msg,
    });
    throw e;
  }
}

async function sendAutomatedLeadAudioLink(
  admin: SupabaseClient,
  cfg: WhatsappConfigRow,
  companyId: string,
  intendedPhone: string,
  opts: {
    storagePath: string;
    filename: string;
    introText?: string | null;
  },
  meta: {
    automation_type: AutomationSendType;
    reference_id: string;
    contactName?: string | null;
  },
): Promise<{ chatId: string; wahaId: string | null }> {
  const signedUrl = await createStorageSignedUrl(admin, WA_AUDIO_STORAGE_BUCKET, opts.storagePath);
  const intro = opts.introText?.trim()
    || '🎧 Te dejamos un mensaje de bienvenida. Pulsa el enlace para escucharlo:';
  const body = `${intro}\n\n${signedUrl}`;
  const settings = await loadAutomationSettings(admin, companyId);
  const { chatPhone, intendedLabel } = resolveRecipientPhone(intendedPhone, settings);
  const wrapped = wrapMessageForTestMode(
    body,
    settings,
    meta.contactName ?? intendedLabel,
  );
  const chatId = normalizeChatId(chatPhone, cfg.default_country_code);
  const preview = `[audio enlace] ${opts.filename}`;
  try {
    const sent = await sendWhatsappText(admin, cfg, companyId, chatId, wrapped);
    await logAutomationSend(admin, {
      company_id: companyId,
      automation_type: meta.automation_type,
      reference_id: meta.reference_id,
      intended_phone: intendedPhone,
      sent_to_phone: chatPhone,
      message_preview: preview,
      success: true,
    });
    return sent;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al enviar';
    await logAutomationSend(admin, {
      company_id: companyId,
      automation_type: meta.automation_type,
      reference_id: meta.reference_id,
      intended_phone: intendedPhone,
      sent_to_phone: chatPhone,
      message_preview: preview,
      success: false,
      error: msg,
    });
    throw e;
  }
}

async function linkChatToLead(
  admin: SupabaseClient,
  companyId: string,
  chatId: string,
  leadId: string,
  contactName: string | null,
): Promise<void> {
  const settings = await loadAutomationSettings(admin, companyId);
  if (isWhatsappTestChatId(chatId, settings)) {
    // Modo prueba: todos los envíos van al mismo número; no mezclar leads en ese chat.
    return;
  }

  const { data: existing } = await admin
    .from('whatsapp_chats')
    .select('id, marketing_lead_id, customer_id, name')
    .eq('company_id', companyId)
    .eq('chat_id', chatId)
    .maybeSingle();

  const updates: Record<string, unknown> = {
    company_id: companyId,
    chat_id: chatId,
    marketing_lead_id: leadId,
  };
  if (contactName && !existing?.name) updates.name = contactName;
  if (!existing?.customer_id) {
    await admin.from('whatsapp_chats').upsert(updates, {
      onConflict: 'company_id,chat_id',
      ignoreDuplicates: false,
    });
  } else if (!existing.marketing_lead_id) {
    await admin
      .from('whatsapp_chats')
      .update({ marketing_lead_id: leadId })
      .eq('id', existing.id);
  }
}

export async function sendInitialAutomationForLead(
  admin: SupabaseClient,
  companyId: string,
  leadId: string,
  lead: WhatsappTemplateContext &
    Pick<MarketingLeadAutomationRow, 'phone' | 'meta_form_id'>,
  form: MetaFormAutomation,
): Promise<{ ok: boolean; status: string; error?: string; sent_kind?: InitialWhatsappSendKind }> {
  if (!form.whatsapp_automation_enabled) {
    await admin
      .from('marketing_leads')
      .update({ wa_automation_status: 'none' })
      .eq('id', leadId);
    return { ok: true, status: 'none' };
  }

  const sendKind = resolveInitialWhatsappSendKind(form);
  if (!sendKind) {
    const onlyManualAudio =
      metaFormHasCampaignAudio(form) && !form.whatsapp_initial_message?.trim();
    await admin
      .from('marketing_leads')
      .update({
        wa_automation_status: 'skipped',
        wa_automation_error: onlyManualAudio
          ? 'Bienvenida automática desactivada (solo audio manual en chat)'
          : 'Falta mensaje inicial en la configuración del formulario',
      })
      .eq('id', leadId);
    return {
      ok: onlyManualAudio,
      status: 'skipped',
      error: onlyManualAudio
        ? undefined
        : 'Falta mensaje inicial',
    };
  }

  if (!lead.phone?.trim()) {
    await admin
      .from('marketing_leads')
      .update({
        wa_automation_status: 'skipped',
        wa_automation_error: 'Lead sin teléfono',
      })
      .eq('id', leadId);
    return { ok: false, status: 'skipped', error: 'Sin teléfono' };
  }

  const cfg = await loadWhatsappConfig(admin, companyId);
  if (!cfg?.enabled || !cfg.base_url) {
    await admin
      .from('marketing_leads')
      .update({
        wa_automation_status: 'failed',
        wa_automation_error: 'WhatsApp no configurado o deshabilitado',
      })
      .eq('id', leadId);
    return { ok: false, status: 'failed', error: 'WhatsApp no configurado' };
  }

  if ((cfg.last_status ?? '').toUpperCase() !== 'WORKING') {
    await admin
      .from('marketing_leads')
      .update({
        wa_automation_status: 'failed',
        wa_automation_error: `Sesión WhatsApp no conectada (${cfg.last_status ?? 'desconocido'})`,
      })
      .eq('id', leadId);
    return { ok: false, status: 'failed', error: 'Sesión WhatsApp no conectada' };
  }

  try {
    const contactName = leadDisplayName(lead);
    const providerCfg = asProviderConfig(cfg);
    let sent: { chatId: string; wahaId: string | null };
    let actualSentKind: InitialWhatsappSendKind = sendKind;

    if (sendKind === 'audio') {
      const audioPath = form.whatsapp_initial_audio_path!.trim();
      const filename = form.whatsapp_initial_audio_filename?.trim() || 'bienvenida.ogg';
      const bytes = await loadStorageFileBytes(admin, audioPath);
      const base64 = bytesToBase64(bytes);
      const mime = normalizeWhatsappAudioMime(
        form.whatsapp_initial_audio_mime?.trim() || 'audio/ogg',
        filename,
      );
      try {
        sent = await sendAutomatedLeadAudio(
          admin,
          cfg,
          companyId,
          lead.phone!,
          { base64, mime, filename },
          {
            automation_type: 'meta_initial_audio',
            reference_id: leadId,
            contactName,
          },
        );
        actualSentKind = 'audio';
      } catch (e) {
        if (!isWahaPlusOnlyMediaError(e, providerCfg.provider)) throw e;
        let introText: string | null = form.whatsapp_initial_message?.trim() || null;
        if (introText) {
          const { renderWhatsappTemplateWithPaymentLinks } = await import('./stripeDeposit.ts');
          introText = await renderWhatsappTemplateWithPaymentLinks(
            admin,
            companyId,
            leadId,
            introText,
            lead,
            form,
            null,
          );
        }
        sent = await sendAutomatedLeadAudioLink(
          admin,
          cfg,
          companyId,
          lead.phone!,
          { storagePath: audioPath, filename, introText },
          {
            automation_type: 'meta_initial_audio_link',
            reference_id: leadId,
            contactName,
          },
        );
        actualSentKind = 'audio_link';
      }
    } else {
      const initialRaw = form.whatsapp_initial_message!.trim();
      const { renderWhatsappTemplateWithPaymentLinks } = await import('./stripeDeposit.ts');
      const initialText = await renderWhatsappTemplateWithPaymentLinks(
        admin,
        companyId,
        leadId,
        initialRaw,
        lead,
        form,
        null,
      );
      sent = await sendAutomatedLeadMessage(
        admin,
        cfg,
        companyId,
        lead.phone!,
        initialText,
        {
          automation_type: 'meta_initial',
          reference_id: leadId,
          contactName,
        },
      );
    }

    await linkChatToLead(admin, companyId, sent.chatId, leadId, contactName);
    const now = new Date().toISOString();
    await admin
      .from('marketing_leads')
      .update({
        wa_automation_status: 'awaiting_reply',
        wa_automation_error: null,
        wa_automation_initial_sent_at: now,
        wa_automation_initial_sent_kind: actualSentKind,
        last_contacted_at: now,
      })
      .eq('id', leadId);
    return { ok: true, status: 'awaiting_reply', sent_kind: actualSentKind };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al enviar WhatsApp';
    await admin
      .from('marketing_leads')
      .update({
        wa_automation_status: 'failed',
        wa_automation_error: msg.slice(0, 500),
      })
      .eq('id', leadId);
    return { ok: false, status: 'failed', error: msg };
  }
}

async function findAwaitingLeadForChat(
  admin: SupabaseClient,
  companyId: string,
  chatId: string,
  marketingLeadId: string | null,
): Promise<MarketingLeadAutomationRow | null> {
  const settings = await loadAutomationSettings(admin, companyId);
  const isTestChat = isWhatsappTestChatId(chatId, settings);

  if (marketingLeadId && !isTestChat) {
    const { data } = await admin
      .from('marketing_leads')
      .select(
        'id, company_id, phone, first_name, last_name, email, campaign, form_name, appointment_at, appointment_label, source, meta_form_id, field_data, wa_automation_status, wa_automation_initial_sent_at, wa_automation_reminder_sent_at',
      )
      .eq('id', marketingLeadId)
      .eq('company_id', companyId)
      .maybeSingle();
    if (data) return data as MarketingLeadAutomationRow;
  }

  if (isTestChat) {
    const { data: leads } = await admin
      .from('marketing_leads')
      .select(
        'id, company_id, phone, first_name, last_name, email, campaign, form_name, appointment_at, appointment_label, source, meta_form_id, field_data, wa_automation_status, wa_automation_initial_sent_at, wa_automation_reminder_sent_at',
      )
      .eq('company_id', companyId)
      .eq('wa_automation_status', 'awaiting_reply')
      .order('wa_automation_initial_sent_at', { ascending: false })
      .limit(1);
    return (leads?.[0] as MarketingLeadAutomationRow | undefined) ?? null;
  }

  const { data: suffix } = await admin.rpc('whatsapp_resolve_chat_phone_last9', {
    p_company_id: companyId,
    p_chat_id: chatId,
  });

  if (typeof suffix !== 'string' || !suffix) return null;

  const { data: leads } = await admin
    .from('marketing_leads')
    .select(
      'id, company_id, phone, first_name, last_name, email, campaign, form_name, appointment_at, appointment_label, source, meta_form_id, field_data, wa_automation_status, wa_automation_initial_sent_at, wa_automation_reminder_sent_at',
    )
    .eq('company_id', companyId)
    .eq('wa_automation_status', 'awaiting_reply')
    .eq('phone_norm', suffix)
    .order('wa_automation_initial_sent_at', { ascending: false })
    .limit(1);

  return (leads?.[0] as MarketingLeadAutomationRow | undefined) ?? null;
}

export async function processAutomationReply(
  admin: SupabaseClient,
  companyId: string,
  chatId: string,
  messageBody: string | null,
  marketingLeadId: string | null,
): Promise<{ handled: boolean; action?: string }> {
  const lead = await findAwaitingLeadForChat(admin, companyId, chatId, marketingLeadId);
  if (!lead || lead.wa_automation_status !== 'awaiting_reply') {
    return { handled: false };
  }

  if (!lead.meta_form_id) return { handled: false };

  const form = await loadMetaFormAutomation(admin, lead.meta_form_id);
  if (!form?.whatsapp_automation_enabled) return { handled: false };

  const choice = parseReplyChoice(messageBody);
  if (!choice) {
    const trimmed = (messageBody ?? '').trim();
    const usesNumericMenu =
      !!form.whatsapp_reply_1_message?.trim() || !!form.whatsapp_reply_2_message?.trim();
    if (!usesNumericMenu && trimmed.length >= 2) {
      await admin
        .from('marketing_leads')
        .update({
          wa_automation_status: 'completed',
          wa_automation_completed_at: new Date().toISOString(),
          wa_automation_error: null,
          last_contacted_at: new Date().toISOString(),
        })
        .eq('id', lead.id)
        .eq('wa_automation_status', 'awaiting_reply');
      return { handled: true, action: 'human_takeover' };
    }

    const invalidRaw = form.whatsapp_reply_invalid_message?.trim();
    if (!invalidRaw) return { handled: false };

    const cfg = await loadWhatsappConfig(admin, companyId);
    if (!cfg?.enabled || !cfg.base_url || (cfg.last_status ?? '').toUpperCase() !== 'WORKING') {
      return { handled: false };
    }
    try {
      const { renderWhatsappTemplateWithPaymentLinks } = await import('./stripeDeposit.ts');
      const invalidText = await renderWhatsappTemplateWithPaymentLinks(
        admin,
        companyId,
        lead.id,
        invalidRaw,
        lead,
        form,
        null,
      );
      await sendAutomatedLeadMessage(
        admin,
        cfg,
        companyId,
        lead.phone ?? chatId.replace(/@.*/, ''),
        invalidText,
        {
          automation_type: 'meta_invalid',
          reference_id: `${lead.id}:invalid:${Date.now()}`,
          contactName: leadDisplayName(lead),
        },
      );
      return { handled: true, action: 'invalid_reply' };
    } catch (e) {
      console.error('processAutomationReply invalid message failed:', e);
      return { handled: false };
    }
  }

  const replyRaw =
    choice === '1'
      ? form.whatsapp_reply_1_message?.trim()
      : form.whatsapp_reply_2_message?.trim();

  if (!replyRaw) {
    await admin
      .from('marketing_leads')
      .update({
        wa_automation_status: 'failed',
        wa_automation_error: `Falta mensaje de respuesta para opción ${choice}`,
      })
      .eq('id', lead.id)
      .eq('wa_automation_status', 'awaiting_reply');
    return { handled: true, action: 'missing_reply_template' };
  }

  const cfg = await loadWhatsappConfig(admin, companyId);
  if (!cfg?.enabled || !cfg.base_url || (cfg.last_status ?? '').toUpperCase() !== 'WORKING') {
    return { handled: false };
  }

  try {
    await linkChatToLead(admin, companyId, chatId, lead.id, leadDisplayName(lead));
    const { renderWhatsappTemplateWithPaymentLinks, loadStripeConfig, resolveDepositAmountCents } =
      await import('./stripeDeposit.ts');
    const replyText = await renderWhatsappTemplateWithPaymentLinks(
      admin,
      companyId,
      lead.id,
      replyRaw,
      lead,
      form,
      null,
    );
    await sendAutomatedLeadMessage(
      admin,
      cfg,
      companyId,
      lead.phone ?? chatId.replace(/@.*/, ''),
      replyText,
      {
        automation_type: choice === '1' ? 'meta_reply_1' : 'meta_reply_2',
        reference_id: `${lead.id}:reply_${choice}`,
        contactName: leadDisplayName(lead),
      },
    );

    const stripeCfg = await loadStripeConfig(admin, companyId);
    const depositAmount = stripeCfg ? resolveDepositAmountCents(stripeCfg, form) : null;
    const waitsPayment = choice === '1' && !!depositAmount && !!stripeCfg?.enabled;

    const { data: locked } = await admin
      .from('marketing_leads')
      .update({
        wa_automation_status: waitsPayment ? 'awaiting_payment' : 'completed',
        wa_automation_completed_at: waitsPayment ? null : new Date().toISOString(),
        wa_automation_error: null,
        last_contacted_at: new Date().toISOString(),
      })
      .eq('id', lead.id)
      .eq('wa_automation_status', 'awaiting_reply')
      .select('id')
      .maybeSingle();

    if (!locked) return { handled: false };
    return { handled: true, action: `reply_${choice}` };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al enviar respuesta';
    await admin
      .from('marketing_leads')
      .update({
        wa_automation_error: msg.slice(0, 500),
      })
      .eq('id', lead.id)
      .eq('wa_automation_status', 'awaiting_reply');
    console.error('processAutomationReply send failed:', e);
    return { handled: true, action: 'send_failed' };
  }
}

export async function runMarketingLeadRemindersForCompany(
  admin: SupabaseClient,
  companyId: string,
): Promise<{ sent: number; skipped: number; errors: number }> {
  const cfg = await loadWhatsappConfig(admin, companyId);
  if (!cfg?.enabled || !cfg.base_url || (cfg.last_status ?? '').toUpperCase() !== 'WORKING') {
    return { sent: 0, skipped: 0, errors: 0 };
  }

  const { loadAutomationSettings } = await import('./whatsappAutomationDispatch.ts');
  const { isWithinAutomationHours } = await import('./whatsappAutomationHours.ts');
  const automationSettings = await loadAutomationSettings(admin, companyId);
  if (!isWithinAutomationHours(automationSettings)) {
    return { sent: 0, skipped: 0, errors: 0 };
  }

  const { data: leads, error } = await admin
    .from('marketing_leads')
    .select(
      'id, company_id, phone, first_name, last_name, email, campaign, form_name, appointment_at, appointment_label, source, meta_form_id, field_data, wa_automation_status, wa_automation_initial_sent_at, wa_automation_reminder_sent_at',
    )
    .eq('company_id', companyId)
    .eq('wa_automation_status', 'awaiting_reply')
    .is('wa_automation_reminder_sent_at', null)
    .not('wa_automation_initial_sent_at', 'is', null)
    .order('wa_automation_initial_sent_at', { ascending: true })
    .limit(40);

  if (error) throw error;

  let sent = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of leads ?? []) {
    const lead = row as MarketingLeadAutomationRow;
    if (!lead.meta_form_id || !lead.phone?.trim()) {
      skipped++;
      continue;
    }

    const form = await loadMetaFormAutomation(admin, lead.meta_form_id);
    if (!form?.whatsapp_automation_enabled) {
      skipped++;
      continue;
    }

    if (form.whatsapp_reminder_enabled === false) {
      skipped++;
      continue;
    }

    const reminderRaw = form.whatsapp_reminder_message?.trim();
    if (!reminderRaw) {
      skipped++;
      continue;
    }

    const delayHours = Math.max(1, Number(form.whatsapp_reminder_delay_hours ?? 3));
    const initialAt = lead.wa_automation_initial_sent_at
      ? new Date(lead.wa_automation_initial_sent_at)
      : null;
    if (!initialAt || Number.isNaN(initialAt.getTime())) {
      skipped++;
      continue;
    }
    if (Date.now() - initialAt.getTime() < delayHours * 60 * 60 * 1000) {
      skipped++;
      continue;
    }

    try {
      const contactName = leadDisplayName(lead);
      const { renderWhatsappTemplateWithPaymentLinks } = await import('./stripeDeposit.ts');
      const reminderText = await renderWhatsappTemplateWithPaymentLinks(
        admin,
        companyId,
        lead.id,
        reminderRaw,
        lead,
        form,
        null,
      );
      await sendAutomatedLeadMessage(
        admin,
        cfg,
        companyId,
        lead.phone!,
        reminderText,
        {
          automation_type: 'meta_reminder',
          reference_id: `${lead.id}:reminder`,
          contactName,
        },
      );
      const now = new Date().toISOString();
      const { data: locked } = await admin
        .from('marketing_leads')
        .update({
          wa_automation_reminder_sent_at: now,
          last_contacted_at: now,
          wa_automation_error: null,
        })
        .eq('id', lead.id)
        .eq('wa_automation_status', 'awaiting_reply')
        .is('wa_automation_reminder_sent_at', null)
        .select('id')
        .maybeSingle();
      if (locked) sent++;
      else skipped++;
    } catch (e) {
      errors++;
      console.error('marketing lead reminder failed:', lead.id, e);
    }
  }

  return { sent, skipped, errors };
}

function isMetaSourceLead(source: string | null | undefined): boolean {
  const s = (source ?? '').trim().toLowerCase();
  return s === 'meta' || s === 'facebook' || s === 'instagram';
}

/** Formulario Meta con audio de campaña para un lead (por meta_form_id o nombre de campaña). */
export async function resolveMetaFormForCampaignLead(
  admin: SupabaseClient,
  companyId: string,
  lead: {
    meta_form_id: string | null;
    campaign?: string | null;
    form_name?: string | null;
    source?: string | null;
  },
): Promise<MetaFormAutomation | null> {
  if (lead.meta_form_id) {
    const byId = await loadMetaFormAutomation(admin, lead.meta_form_id);
    if (byId) return byId;
  }
  const campaign = lead.campaign?.trim();
  const formName = lead.form_name?.trim();
  if (!campaign && !formName) return null;

  const { data: forms, error } = await admin
    .from('meta_forms')
    .select(
      'id, form_id, form_name, whatsapp_automation_enabled, whatsapp_initial_message, whatsapp_initial_audio_enabled, whatsapp_initial_audio_path, whatsapp_initial_audio_filename, whatsapp_initial_audio_mime, whatsapp_reply_1_message, whatsapp_reply_2_message, whatsapp_reply_invalid_message, whatsapp_reminder_message, whatsapp_reminder_delay_hours, whatsapp_reminder_enabled, stripe_deposit_enabled, stripe_deposit_amount_cents',
    )
    .eq('company_id', companyId);
  if (error) throw error;
  const rows = (forms ?? []) as MetaFormAutomation[];
  const norm = (s: string) => s.trim().toLowerCase();
  if (campaign) {
    const c = norm(campaign);
    const hit = rows.find((f) => {
      const fn = f.form_name?.trim();
      if (!fn) return false;
      const n = norm(fn);
      return n === c || n.includes(c) || c.includes(n);
    });
    if (hit) return hit;
  }
  if (formName) {
    const f = norm(formName);
    const hit = rows.find((x) => x.form_name && norm(x.form_name) === f);
    if (hit) return hit;
  }
  return null;
}

/** Envío manual del audio de campaña desde el chat de WhatsApp. */
export async function sendManualCampaignAudioForChat(
  admin: SupabaseClient,
  companyId: string,
  chatId: string,
  opts: {
    marketing_lead_id?: string | null;
    customer_id?: string | null;
    chat_display_name?: string | null;
  },
): Promise<{
  ok: boolean;
  campaign_label?: string;
  filename?: string;
  sent_kind?: InitialWhatsappSendKind;
  error?: string;
}> {
  const { resolveMarketingLeadForWhatsappChat } = await import('./stripeDeposit.ts');
  const { lead } = await resolveMarketingLeadForWhatsappChat(
    admin,
    companyId,
    chatId.trim(),
    opts.marketing_lead_id ?? null,
    opts.chat_display_name ?? null,
    opts.customer_id ?? null,
  );

  if (!isMetaSourceLead(lead.source) && !lead.meta_form_id && !lead.campaign?.trim()) {
    return { ok: false, error: 'Este contacto no es un lead de Meta' };
  }

  const form = await resolveMetaFormForCampaignLead(admin, companyId, lead);
  if (!metaFormHasCampaignAudio(form)) {
    const label = lead.campaign?.trim() || lead.form_name?.trim() || 'esta campaña';
    return {
      ok: false,
      error: `No hay audio configurado para «${label}». Súbelo en Configuración → WhatsApp → Audios campaña.`,
    };
  }

  const cfg = await loadWhatsappConfig(admin, companyId);
  if (!cfg?.enabled || !cfg.base_url) {
    return { ok: false, error: 'WhatsApp no configurado o deshabilitado' };
  }
  const providerCfg = asProviderConfig(cfg);
  const session = await ensureWhatsappSessionReadyForSend(admin, companyId, {
    ...providerCfg,
    last_status: cfg.last_status,
    me_jid: cfg.me_jid,
  });
  if (!session.ready) {
    return { ok: false, error: session.error ?? 'Sesión WhatsApp no conectada' };
  }

  const contactName = leadDisplayName(lead);
  const audioPath = form!.whatsapp_initial_audio_path!.trim();
  const filename = form!.whatsapp_initial_audio_filename?.trim() || 'bienvenida.ogg';
  const bytes = await loadStorageFileBytes(admin, audioPath);
  const base64 = bytesToBase64(bytes);
  const mime = normalizeWhatsappAudioMime(
    form!.whatsapp_initial_audio_mime?.trim() || 'audio/ogg',
    filename,
  );

  try {
    let actualSentKind: InitialWhatsappSendKind = 'audio';
    const settings = await loadAutomationSettings(admin, companyId);
    const intendedPhone = lead.phone ?? chatId;
    const { chatPhone } = resolveRecipientPhone(intendedPhone, settings);

    try {
      const sent = await sendWhatsappMedia(admin, cfg, companyId, chatId.trim(), {
        base64,
        mime,
        filename,
      });
      actualSentKind = sent.mediaType === 'voice' ? 'voice' : 'audio';
      await logAutomationSend(admin, {
        company_id: companyId,
        automation_type: 'meta_initial_audio',
        reference_id: `${lead.id}:manual_audio`,
        intended_phone: intendedPhone,
        sent_to_phone: chatPhone,
        message_preview:
          sent.mediaType === 'voice' ? '[nota de voz]' : `[audio] ${filename}`,
        success: true,
      });
    } catch (e) {
      if (!isWahaPlusOnlyMediaError(e, providerCfg.provider)) throw e;
      const signedUrl = await createStorageSignedUrl(admin, WA_AUDIO_STORAGE_BUCKET, audioPath);
      const intro =
        form!.whatsapp_initial_message?.trim() ||
        '🎧 Te dejamos un mensaje de bienvenida. Pulsa el enlace para escucharlo:';
      const body = `${intro}\n\n${signedUrl}`;
      const wrapped = wrapMessageForTestMode(body, settings, contactName);
      await sendWhatsappText(admin, cfg, companyId, chatId.trim(), wrapped);
      await logAutomationSend(admin, {
        company_id: companyId,
        automation_type: 'meta_initial_audio',
        reference_id: `${lead.id}:manual_audio_link`,
        intended_phone: intendedPhone,
        sent_to_phone: chatPhone,
        message_preview: `[audio enlace] ${filename}`,
        success: true,
      });
      actualSentKind = 'audio_link';
    }

    await linkChatToLead(admin, companyId, chatId.trim(), lead.id, contactName);

    const campaignLabel =
      lead.campaign?.trim() || form!.form_name?.trim() || lead.form_name?.trim() || 'campaña';

    return {
      ok: true,
      campaign_label: campaignLabel,
      filename,
      sent_kind: actualSentKind,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al enviar audio';
    return { ok: false, error: msg };
  }
}
