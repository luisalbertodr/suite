import type { BillingCompanyOption } from '@/lib/billingCompany';
import { supabase } from '@/lib/supabase';

/** Misma emisora E / hub Style que WhatsApp (María del Mar Lamas Pernas). */
export const PAYMENT_GATEWAY_SHORT_NAME = 'E';

/**
 * Resuelve la empresa anfitriona de Stripe/Redsys en el cliente.
 * Preferencia: RPC payment_gateway_company_id; si falla, short_name E del centro.
 */
export async function resolvePaymentGatewayCompanyIdClient(
  sessionCompanyId: string,
  billingCompanies?: BillingCompanyOption[],
): Promise<string> {
  const { data, error } = await supabase.rpc('payment_gateway_company_id', {
    p_company_id: sessionCompanyId,
  });
  if (!error && data) return String(data);

  if (billingCompanies && billingCompanies.length > 0) {
    const target = PAYMENT_GATEWAY_SHORT_NAME.toLowerCase();
    const match = billingCompanies.find(
      (c) => c.short_name?.trim().toLowerCase() === target,
    );
    if (match) return match.id;
    return billingCompanies[0]?.id ?? sessionCompanyId;
  }

  return sessionCompanyId;
}
