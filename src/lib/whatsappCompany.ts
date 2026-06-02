import type { BillingCompanyOption } from '@/lib/billingCompany';

/** Empresa emisora fija para WhatsApp (temporalmente siempre E). */
export const WHATSAPP_BILLING_SHORT_NAME = 'E';

export function resolveWhatsappBillingCompanyId(
  billingCompanies: BillingCompanyOption[],
  fallbackCompanyId?: string | null,
): string | null {
  if (billingCompanies.length === 0) return fallbackCompanyId ?? null;

  const target = WHATSAPP_BILLING_SHORT_NAME.toLowerCase();
  const match = billingCompanies.find(
    (c) => c.short_name?.trim().toLowerCase() === target,
  );
  if (match) return match.id;

  return billingCompanies[0]?.id ?? fallbackCompanyId ?? null;
}
