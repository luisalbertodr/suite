/** Helpers NFC / ACR122U login */
const STATION_KEY = 'suite_nfc_station_id';

export function getNfcStationId(): string {
  try {
    let id = localStorage.getItem(STATION_KEY);
    if (!id) {
      id = `station-${crypto.randomUUID().slice(0, 8)}`;
      localStorage.setItem(STATION_KEY, id);
    }
    return id;
  } catch {
    return 'default';
  }
}

export function setNfcStationId(id: string) {
  localStorage.setItem(STATION_KEY, id.trim() || 'default');
}

export function normalizeNfcUid(raw: string): string {
  return String(raw ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-F]/g, '');
}

type NfcJson = Record<string, unknown>;

export async function callNfcAuth(
  body: Record<string, unknown>,
  opts?: { accessToken?: string | null; agentSecret?: string | null },
): Promise<NfcJson> {
  const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
  const anon =
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
    '';
  if (!base || !anon) throw new Error('Falta configuración Supabase');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: anon,
  };
  if (opts?.accessToken) headers.Authorization = `Bearer ${opts.accessToken}`;
  if (opts?.agentSecret) headers['x-nfc-agent-secret'] = opts.agentSecret;

  const resp = await fetch(`${base.replace(/\/+$/, '')}/functions/v1/nfc-auth`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  const json = (await resp.json().catch(() => ({}))) as NfcJson;
  if (!resp.ok) {
    const err = typeof json.error === 'string' ? json.error : `nfc-auth HTTP ${resp.status}`;
    throw new Error(err);
  }
  return json;
}
