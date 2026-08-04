/**
 * Firma Redsys TPV Virtual (HMAC_SHA512_V2 y HMAC_SHA256_V1).
 * V2 verificado contra el ejemplo oficial de Redsys (clave diversificada AES + HMAC-SHA512).
 */

import CryptoJS from 'https://esm.sh/crypto-js@4.2.0';

export type RedsysSignatureVersion = 'HMAC_SHA512_V2' | 'HMAC_SHA256_V1';

const te = new TextEncoder();

function bytesToBinaryString(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return s;
}

export function encodeBase64(bytes: Uint8Array): string {
  return btoa(bytesToBinaryString(bytes));
}

export function encodeBase64Url(bytes: Uint8Array): string {
  return encodeBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export function decodeBase64(b64: string): Uint8Array {
  const normalized = b64.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const bin = atob(normalized + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function normalizeBase64Url(sig: string): string {
  return sig.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function prepareAesKey16(secretKey: string): string {
  if (secretKey.length > 16) return secretKey.slice(0, 16);
  if (secretKey.length < 16) return secretKey.padEnd(16, '0');
  return secretKey;
}

/** Diversifica la clave con AES-128-CBC(order) y usa el Base64 del ciphertext como clave HMAC (UTF-8). */
async function diversifyKeyAesBase64(secretKey: string, order: string): Promise<string> {
  const keyStr = prepareAesKey16(secretKey);
  const key = await crypto.subtle.importKey(
    'raw',
    te.encode(keyStr),
    { name: 'AES-CBC' },
    false,
    ['encrypt'],
  );
  const iv = new Uint8Array(16);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-CBC', iv },
    key,
    te.encode(order),
  );
  return encodeBase64(new Uint8Array(cipherBuf));
}

async function hmacSha512Base64Url(keyUtf8: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    te.encode(keyUtf8),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, te.encode(message)),
  );
  return encodeBase64Url(sig);
}

/** Firma clásica HMAC_SHA256_V1 (3DES + HMAC-SHA256). */
function signHmacSha256V1(secretKeyBase64: string, order: string, merchantParamsB64: string): string {
  const keyWordArray = CryptoJS.enc.Base64.parse(secretKeyBase64);
  const iv = CryptoJS.enc.Hex.parse('0000000000000000');
  const cipher = CryptoJS.TripleDES.encrypt(order, keyWordArray, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.ZeroPadding,
  });
  const signature = CryptoJS.HmacSHA256(merchantParamsB64, cipher.ciphertext);
  return CryptoJS.enc.Base64.stringify(signature);
}

export async function createRedsysSignature(
  secretKey: string,
  order: string,
  merchantParamsEncoded: string,
  version: RedsysSignatureVersion,
): Promise<string> {
  if (version === 'HMAC_SHA256_V1') {
    return signHmacSha256V1(secretKey, order, merchantParamsEncoded);
  }
  const diversifyB64 = await diversifyKeyAesBase64(secretKey, order);
  return hmacSha512Base64Url(diversifyB64, merchantParamsEncoded);
}

export async function verifyRedsysSignature(
  secretKey: string,
  order: string,
  merchantParamsEncoded: string,
  receivedSignature: string,
  version: RedsysSignatureVersion,
): Promise<boolean> {
  const expected = await createRedsysSignature(
    secretKey,
    order,
    merchantParamsEncoded,
    version,
  );
  const a = normalizeBase64Url(expected);
  const b = normalizeBase64Url(receivedSignature);
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i)! ^ b.charCodeAt(i)!;
  }
  return diff === 0;
}

export function encodeMerchantParameters(params: Record<string, string>): string {
  const json = JSON.stringify(params);
  return encodeBase64Url(te.encode(json));
}

export function decodeMerchantParameters(encoded: string): Record<string, string> {
  const raw = new TextDecoder().decode(decodeBase64(encoded));
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(parsed)) {
    out[k] = v == null ? '' : String(v);
  }
  return out;
}

export function redsysRedirectUrl(environment: 'live' | 'test'): string {
  return environment === 'test'
    ? 'https://sis-t.redsys.es:25443/sis/realizarPago'
    : 'https://sis.redsys.es/sis/realizarPago';
}

export type ParsedRedsysApiKey = {
  environment: 'live' | 'test';
  merchant_code: string;
  terminal: string;
  signature_key: string;
};

/** Formato portal: PROD_|TEST_ + base64(merchant_terminal_key). */
export function parseRedsysApiKey(apiKey: string): ParsedRedsysApiKey | null {
  const trimmed = apiKey.trim();
  const m = /^(PROD|TEST)_(.+)$/i.exec(trimmed);
  if (!m) return null;
  const environment = m[1]!.toUpperCase() === 'TEST' ? 'test' : 'live';
  let decoded: string;
  try {
    decoded = new TextDecoder().decode(decodeBase64(m[2]!));
  } catch {
    return null;
  }
  const parts = decoded.split('_');
  if (parts.length < 3) return null;
  const merchant_code = parts[0]!.replace(/^0+/, '') || parts[0]!;
  const terminal = String(Number(parts[1]) || parts[1]);
  const signature_key = parts.slice(2).join('_');
  if (!merchant_code || !signature_key) return null;
  return { environment, merchant_code, terminal, signature_key };
}

/** Número de pedido Redsys: 4–12 chars, primeros 4 numéricos. */
export function generateRedsysOrder(): string {
  const now = Date.now().toString();
  const prefix = now.slice(-8);
  const arr = new Uint8Array(2);
  crypto.getRandomValues(arr);
  const suffix = ((arr[0]! << 8) | arr[1]!).toString().padStart(4, '0').slice(-4);
  return `${prefix}${suffix}`.slice(0, 12);
}

export function isRedsysResponseAuthorized(dsResponse: string | null | undefined): boolean {
  if (dsResponse == null || dsResponse === '') return false;
  const n = Number.parseInt(String(dsResponse).trim(), 10);
  return Number.isFinite(n) && n >= 0 && n <= 99;
}
