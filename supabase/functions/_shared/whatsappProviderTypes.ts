export type WhatsappProvider = 'waha' | 'openwa';

export type WhatsappProviderConfig = {
  company_id: string;
  provider: WhatsappProvider;
  base_url: string | null;
  api_key: string | null;
  session_name: string;
  webhook_secret: string | null;
  default_country_code: string | null;
  enabled: boolean;
  last_status: string | null;
  me_jid: string | null;
};

export type WhatsappSendMediaInput = {
  base64: string;
  mime: string;
  filename: string;
  caption?: string;
  /** URL pública (requerida por OpenWA para audio/vídeo/documento). */
  url?: string;
};

export type WhatsappSendResult = {
  messageId: string | null;
  timestamp?: number;
  raw: unknown;
};

export const OPENWA_WEBHOOK_EVENTS = [
  'message.received',
  'message.sent',
  'message.ack',
  'message.failed',
  'message.revoked',
  'session.status',
  'session.qr',
  'session.authenticated',
  'session.disconnected',
] as const;

/** Estados OpenWA → estados internos (compatibles con UI WAHA). */
export function mapOpenwaStatusToInternal(status: string | null | undefined): string {
  const s = (status ?? '').toUpperCase();
  switch (s) {
    case 'CONNECTED':
    case 'READY':
      return 'WORKING';
    case 'SCAN_QR':
    case 'QR_READY':
      return 'SCAN_QR_CODE';
    case 'INITIALIZING':
    case 'STARTING':
      return 'STARTING';
    case 'DISCONNECTED':
    case 'STOPPED':
      return 'STOPPED';
    case 'FAILED':
      return 'FAILED';
    default:
      return s || 'UNKNOWN';
  }
}

export function normalizeWhatsappProvider(raw: string | null | undefined): WhatsappProvider {
  return raw === 'openwa' ? 'openwa' : 'waha';
}

export function trimSlash(s: string): string {
  return s.replace(/\/+$/, '');
}

export function providerLabel(provider: WhatsappProvider): string {
  return provider === 'openwa' ? 'OpenWA' : 'WAHA';
}

/** Mensaje de error de respuestas JSON de WAHA/OpenWA (`message` o `error`). */
export function extractProviderErrorMessage(data: unknown, fallbackStatus: number): string {
  if (!data || typeof data !== 'object') return `HTTP ${fallbackStatus}`;
  const row = data as Record<string, unknown>;
  const msg =
    (typeof row.message === 'string' ? row.message : null) ??
    (typeof row.error === 'string' ? row.error : null) ??
    (Array.isArray(row.message) ? row.message.join(', ') : null);
  return msg ?? `HTTP ${fallbackStatus}`;
}

/** Columnas opcionales de credenciales por proveedor (whatsapp_config). */
export type WhatsappProviderCredentialColumns = {
  waha_base_url?: string | null;
  waha_api_key?: string | null;
  waha_session_name?: string | null;
  openwa_base_url?: string | null;
  openwa_api_key?: string | null;
  openwa_session_name?: string | null;
};

export type WhatsappConfigDbRow = WhatsappProviderConfig & WhatsappProviderCredentialColumns;

/** api_key/base_url activos: columnas del proveedor + legacy api_key/base_url. */
export function resolveWhatsappCredentials(
  cfg: WhatsappConfigDbRow,
): WhatsappProviderConfig {
  const provider = normalizeWhatsappProvider(cfg.provider);
  if (provider === 'openwa') {
    return {
      ...cfg,
      provider,
      base_url: cfg.openwa_base_url ?? cfg.base_url,
      api_key: cfg.openwa_api_key ?? cfg.api_key,
      session_name: cfg.openwa_session_name ?? cfg.session_name ?? 'default',
    };
  }
  return {
    ...cfg,
    provider,
    base_url: cfg.waha_base_url ?? cfg.base_url,
    api_key: cfg.waha_api_key ?? cfg.api_key,
    session_name: cfg.waha_session_name ?? cfg.session_name ?? 'default',
  };
}
