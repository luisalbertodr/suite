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

/** Aplica `?nfc_station=` / `?station=` de la URL y lo persiste. */
export function applyNfcStationFromUrl(search = window.location.search): string {
  try {
    const params = new URLSearchParams(search);
    const fromUrl = (params.get('nfc_station') || params.get('station') || '').trim();
    if (fromUrl) {
      setNfcStationId(fromUrl);
      params.delete('nfc_station');
      params.delete('station');
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
      window.history.replaceState({}, '', next);
    }
  } catch {
    /* ignore */
  }
  return getNfcStationId();
}

export type NfcPickup = { challengeId: string; pollToken: string };

/**
 * Si el agente abrió Chrome con `?nfc_challenge=&nfc_poll=`, consume esos
 * parámetros (one-shot) para aplicar la sesión sin esperar otra lectura.
 */
export function consumeNfcPickupFromUrl(search = window.location.search): NfcPickup | null {
  try {
    const params = new URLSearchParams(search);
    const challengeId = (params.get('nfc_challenge') || params.get('nfc_cid') || '').trim();
    const pollToken = (params.get('nfc_poll') || params.get('nfc_pt') || '').trim();
    const station = (params.get('nfc_station') || params.get('station') || '').trim();
    if (station) setNfcStationId(station);
    if (!challengeId || !pollToken) return null;

    params.delete('nfc_challenge');
    params.delete('nfc_cid');
    params.delete('nfc_poll');
    params.delete('nfc_pt');
    params.delete('nfc_station');
    params.delete('station');
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
    window.history.replaceState({}, '', next);
    return { challengeId, pollToken };
  } catch {
    return null;
  }
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
