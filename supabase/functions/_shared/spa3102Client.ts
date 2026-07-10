export type Spa3102HookState = 'On' | 'Off' | 'Unknown';

export type Spa3102Status = {
  line1HookState: Spa3102HookState;
  pstnHookState: Spa3102HookState;
  pstnState: string;
  lineVoltage: string | null;
  line1Registration: string | null;
};

export type Spa3102Config = {
  baseUrl: string;
  username: string;
  password: string;
};

const STATUS_PATH = '/voice/advanced';
const REBOOT_PATH = '/admin/reboot';

function trimSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

function basicAuthHeader(username: string, password: string): string {
  return `Basic ${btoa(`${username}:${password}`)}`;
}

export function loadSpa3102Config(): Spa3102Config | null {
  const baseUrl = Deno.env.get('SPA3102_BASE_URL')?.trim() || 'http://192.168.99.82';
  const username = Deno.env.get('SPA3102_USERNAME')?.trim() || 'admin';
  const password = Deno.env.get('SPA3102_PASSWORD')?.trim();
  if (!password) return null;
  return { baseUrl: trimSlash(baseUrl), username, password };
}

function parseHookValue(raw: string | undefined): Spa3102HookState {
  const v = (raw ?? '').trim();
  if (v === 'On') return 'On';
  if (v === 'Off') return 'Off';
  return 'Unknown';
}

function extractFontValue(html: string, label: string): string | null {
  const re = new RegExp(`${label}:<td><font[^>]*>([^<]*)<`, 'i');
  const m = html.match(re);
  return m?.[1]?.trim() ?? null;
}

/** Parsea la página Voice > Info del SPA3102 (admin/advanced). */
export function parseVoiceAdvancedHtml(html: string): Spa3102Status {
  const hookStates = [...html.matchAll(/Hook State:<td><font[^>]*>([^<]+)</gi)].map((m) =>
    m[1].trim()
  );
  const pstnIdx = html.indexOf('PSTN Line Status');
  const pstnSection = pstnIdx >= 0 ? html.slice(pstnIdx, pstnIdx + 2000) : html;

  return {
    line1HookState: parseHookValue(hookStates[0]),
    pstnHookState: parseHookValue(hookStates[1] ?? hookStates[0]),
    pstnState: extractFontValue(pstnSection, 'PSTN State') ?? 'Unknown',
    lineVoltage: extractFontValue(pstnSection, 'Line Voltage'),
    line1Registration: extractFontValue(html, 'Registration State'),
  };
}

export async function fetchSpa3102Status(cfg: Spa3102Config): Promise<Spa3102Status> {
  const url = `${cfg.baseUrl}${STATUS_PATH}`;
  const resp = await fetch(url, {
    headers: { Authorization: basicAuthHeader(cfg.username, cfg.password) },
    signal: AbortSignal.timeout(12_000),
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`SPA3102 status HTTP ${resp.status}: ${text.slice(0, 120)}`);
  }
  if (!text.includes('Hook State')) {
    throw new Error('SPA3102: respuesta sin estado de línea (¿auth fallida?)');
  }
  return parseVoiceAdvancedHtml(text);
}

export async function rebootSpa3102(cfg: Spa3102Config): Promise<string> {
  const url = `${cfg.baseUrl}${REBOOT_PATH}`;
  const resp = await fetch(url, {
    headers: { Authorization: basicAuthHeader(cfg.username, cfg.password) },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`SPA3102 reboot HTTP ${resp.status}: ${text.slice(0, 120)}`);
  }
  return 'Reinicio SPA3102 solicitado';
}

function normalizePstnState(state: string): string {
  return state.trim().toLowerCase();
}

/** PSTN en reposo (colgado, sin llamada activa). */
export function isPstnIdle(status: Spa3102Status): boolean {
  const state = normalizePstnState(status.pstnState);
  return state === '' || state === 'idle';
}

/**
 * Off-hook con actividad PSTN = uso normal (p. ej. "Connected to PSTN", ringing).
 * En telefonía, Hook State "Off" significa auricular levantado / línea en uso.
 */
export function isPstnInCall(status: Spa3102Status): boolean {
  if (status.pstnHookState !== 'Off') return false;
  return !isPstnIdle(status);
}

/** Off-hook con PSTN idle = auricular abajo sin llamada; línea potencialmente pillada. */
export function isPstnLineStuck(status: Spa3102Status): boolean {
  return status.pstnHookState === 'Off' && isPstnIdle(status);
}

/** @deprecated Usar isPstnInCall / isPstnLineStuck. Mantenido por compatibilidad. */
export function isPstnBusy(status: Spa3102Status): boolean {
  return isPstnInCall(status);
}
