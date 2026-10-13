/** F6 — ElectricSQL vía edge proxy (shape autenticado). */

export function getElectricProxyUrl(): string {
  const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '') || '';
  if (!base) return '';
  return `${base}/functions/v1/electric-shape-proxy`;
}

export function isElectricProxyConfigured(): boolean {
  return getElectricProxyUrl().length > 0;
}

export type ServiceStatusRow = {
  service_key: string;
  status: string;
  last_error?: string | null;
  updated_at?: string | null;
  latency_ms?: number | null;
};
