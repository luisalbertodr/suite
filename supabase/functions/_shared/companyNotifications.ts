import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { formatEurosFromCents } from './stripeDeposit.ts';

export type StripeDepositPaidNotificationInput = {
  depositSessionId: string;
  leadId: string;
  leadName: string;
  phone: string | null;
  amountCents: number;
  currency: string;
  formName?: string | null;
  campaign?: string | null;
};

async function marketingReadUserIds(
  admin: SupabaseClient,
  companyId: string,
): Promise<string[]> {
  const { data: profiles, error } = await admin
    .from('user_profiles')
    .select('user_id')
    .eq('company_id', companyId);
  if (error) throw error;

  const userIds = [...new Set((profiles ?? []).map((p) => p.user_id).filter(Boolean))];
  const recipients: string[] = [];

  for (const userId of userIds) {
    const { data: allowed, error: permError } = await admin.rpc('user_has_effective_permission', {
      p_user_id: userId,
      p_resource: 'marketing',
      p_action: 'read',
    });
    if (permError) {
      console.error('marketing permission check failed:', permError);
      continue;
    }
    if (allowed) recipients.push(userId);
  }

  return recipients;
}

/** Notifica en la campana a usuarios con permiso marketing:read. */
export async function notifyStripeDepositPaid(
  admin: SupabaseClient,
  companyId: string,
  input: StripeDepositPaidNotificationInput,
): Promise<void> {
  const { data: existing, error: existingError } = await admin
    .from('notifications')
    .select('id')
    .eq('company_id', companyId)
    .eq('type', 'stripe_deposit_paid')
    .eq('metadata->>stripe_deposit_session_id', input.depositSessionId)
    .limit(1);
  if (existingError) {
    console.error('stripe deposit notification dedup failed:', existingError);
    return;
  }
  if (existing?.length) return;

  const recipients = await marketingReadUserIds(admin, companyId);
  if (recipients.length === 0) return;

  const amount = formatEurosFromCents(input.amountCents, input.currency);
  const title = `Señal Stripe · ${input.leadName}`;
  const phoneLabel = input.phone?.trim() ?? '';
  const message = phoneLabel
    ? `${input.leadName} (${phoneLabel}) ha confirmado el pago de la señal: ${amount}.`
    : `${input.leadName} ha confirmado el pago de la señal: ${amount}.`;

  const inserts = recipients.map((userId) => ({
    company_id: companyId,
    user_id: userId,
    title,
    message,
    type: 'stripe_deposit_paid',
    link: '/marketing',
    read: false,
    metadata: {
      stripe_deposit_session_id: input.depositSessionId,
      marketing_lead_id: input.leadId,
      amount_cents: input.amountCents,
      currency: input.currency,
      phone: input.phone,
      form_name: input.formName ?? null,
      campaign: input.campaign ?? null,
    },
  }));

  const { error: insertError } = await admin.from('notifications').insert(inserts);
  if (insertError) {
    console.error('stripe deposit notification insert failed:', insertError);
  }
}
