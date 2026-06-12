/** Deno requiere cabeceras Authorization como byte string para caracteres no-ASCII. */
export function toHeaderByteString(value: string): string {
  return String.fromCharCode(...new TextEncoder().encode(value));
}

export function issabelAuthHeaders(accept = 'application/json'): Record<string, string> {
  const headers: Record<string, string> = { Accept: accept };
  const token = Deno.env.get('ISSABEL_API_TOKEN')?.trim();
  const username = Deno.env.get('ISSABEL_USERNAME')?.trim();
  const password = Deno.env.get('ISSABEL_PASSWORD')?.trim();
  if (token) {
    headers.Authorization = toHeaderByteString(`Bearer ${token}`);
  } else if (username && password) {
    headers.Authorization = `Basic ${btoa(`${username}:${password}`)}`;
  }
  return headers;
}
