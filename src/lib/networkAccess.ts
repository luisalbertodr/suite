import { supabase } from '@/lib/supabase';

export type NetworkAccessCheckResult = {
  allowed: boolean;
  restricted?: boolean;
  clientIp?: string | null;
  reason?: string | null;
  bypass?: string;
  error?: string;
};

/**
 * Comprueba en el servidor si la IP del cliente está permitida para el usuario
 * autenticado. Si la función aún no está desplegada (404), falla abierto para
 * no bloquear el login durante el despliegue.
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
      // Función no desplegada / gateway: no bloquear
      if (status === 404 || /not found|Failed to send/i.test(msg)) {
        return { allowed: true, error: msg };
      }
      // 401/403 → denegar
      if (status === 401 || status === 403) {
        return { allowed: false, error: msg, reason: 'unauthorized' };
      }
      // Otros errores de transporte: no bloquear (evita lockout por outage breve)
      return { allowed: true, error: msg };
    }

    if (!body) {
      return { allowed: true };
    }
    return {
      allowed: body.allowed !== false,
      restricted: body.restricted,
      clientIp: body.clientIp,
      reason: body.reason,
      bypass: body.bypass,
      error: body.error,
    };
  } catch (e) {
    return {
      allowed: true,
      error: e instanceof Error ? e.message : 'network check failed',
    };
  }
}

export const NETWORK_ACCESS_DENIED_MESSAGE =
  'No tienes permiso para acceder a Suite desde esta red. Contacta con un administrador.';
