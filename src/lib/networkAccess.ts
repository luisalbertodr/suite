import { supabase } from '@/lib/supabase';

export type NetworkAccessCheckResult = {
  allowed: boolean;
  restricted?: boolean;
  clientIp?: string | null;
  ipSource?: string;
  reason?: string | null;
  bypass?: string;
  error?: string;
};

/**
 * Comprueba en el servidor si la IP del cliente está permitida para el usuario
 * autenticado.
 *
 * Fail-closed salvo 404 (función aún no desplegada en un entorno nuevo):
 * si no podemos verificar la red, no dejamos pasar la sesión.
 */
export async function checkNetworkAccess(): Promise<NetworkAccessCheckResult> {
  try {
    const { data, error } = await supabase.functions.invoke('network-access-check', {
      body: {},
    });

    const body = (data ?? null) as NetworkAccessCheckResult | null;

    // Cuerpo explícito de denegación (también si invoke marca error HTTP).
    if (body && body.allowed === false) {
      return body;
    }

    if (error) {
      const status = (error as { context?: { status?: number } }).context?.status;
      const msg = error.message || '';
      // Solo fail-open si la función no existe todavía (despliegue inicial).
      if (status === 404) {
        return { allowed: true, error: msg };
      }
      // Cualquier otro error (transporte, 5xx, 401/403): denegar.
      return {
        allowed: false,
        error: msg,
        reason: status === 401 || status === 403 ? 'unauthorized' : 'check_error',
        clientIp: body?.clientIp ?? null,
      };
    }

    if (!body || typeof body !== 'object') {
      return { allowed: false, reason: 'empty_response' };
    }

    return {
      allowed: body.allowed === true,
      restricted: body.restricted,
      clientIp: body.clientIp,
      ipSource: body.ipSource,
      reason: body.reason,
      bypass: body.bypass,
      error: body.error,
    };
  } catch (e) {
    return {
      allowed: false,
      reason: 'check_error',
      error: e instanceof Error ? e.message : 'network check failed',
    };
  }
}

export const NETWORK_ACCESS_DENIED_MESSAGE =
  'No tienes permiso para acceder a Suite desde esta red. Contacta con un administrador.';
