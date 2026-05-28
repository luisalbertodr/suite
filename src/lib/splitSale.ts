import { supabase } from '@/lib/supabase';
import type { CartItemWithBilling } from '@/lib/billingCompany';

export type SplitSaleContext = {
  hostCompanyId: string;
  customerId?: string | null;
  customerName?: string | null;
  appointmentId?: string | null;
  notes?: string | null;
};

export type ProcessSplitPaymentInput = {
  group: CartItemWithBilling[];
  total: number;
  paymentMethod: string;
  amountPaid: number;
  change: number;
  billingCompanyId: string;
  context: SplitSaleContext;
  saleGroupId?: string | null;
  isLastPayment: boolean;
  globalTotal: number;
};

export type ProcessSplitPaymentResult = {
  sale: {
    id: string;
    ticket_number: string;
    total_amount: number;
    status: string;
    company_id: string;
  };
  saleGroupId: string;
};

function calcTax(total: number): { subtotal: number; taxAmount: number } {
  const subtotal = Number((total / 1.21).toFixed(2));
  const taxAmount = Number((total - subtotal).toFixed(2));
  return { subtotal, taxAmount };
}

async function ensureSaleGroup(
  input: ProcessSplitPaymentInput,
): Promise<string> {
  if (input.saleGroupId) return input.saleGroupId;

  const { data, error } = await supabase
    .from('sale_groups')
    .insert({
      host_company_id: input.context.hostCompanyId,
      customer_id: input.context.customerId ?? null,
      customer_name: input.context.customerName ?? null,
      appointment_id: input.context.appointmentId ?? null,
      status: 'pending',
      total_amount: input.globalTotal,
      notes: input.context.notes ?? null,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Error creando grupo de venta: ${error.message}`);
  return data.id;
}

async function updateSaleGroupStatus(
  saleGroupId: string,
  paidCount: number,
  totalGroups: number,
): Promise<void> {
  let status: 'pending' | 'partial' | 'completed' = 'pending';
  if (paidCount >= totalGroups) status = 'completed';
  else if (paidCount > 0) status = 'partial';

  const { error } = await supabase
    .from('sale_groups')
    .update({ status })
    .eq('id', saleGroupId);

  if (error) console.error('updateSaleGroupStatus', error);
}

export async function processSplitPayment(
  input: ProcessSplitPaymentInput,
  paidCount: number,
  totalGroups: number,
): Promise<ProcessSplitPaymentResult> {
  const saleGroupId = await ensureSaleGroup(input);
  const { subtotal, taxAmount } = calcTax(input.total);

  const saleRecord: Record<string, unknown> = {
    company_id: input.billingCompanyId,
    host_company_id: input.context.hostCompanyId,
    sale_group_id: saleGroupId,
    ticket_number: '',
    total_amount: input.total,
    subtotal,
    tax_amount: taxAmount,
    payment_method: input.paymentMethod,
    amount_paid: input.amountPaid || 0,
    change_amount: input.change || 0,
    status: 'completed' as const,
    currency: 'EUR',
    customer_name: input.context.customerName || null,
    customer_id: input.context.customerId ?? null,
    appointment_id: input.context.appointmentId ?? null,
    notes: input.context.notes ?? null,
  };

  let sale: ProcessSplitPaymentResult['sale'] | null = null;
  let saleError: { code?: string; message: string } | null = null;

  for (const attempt of [
    saleRecord,
    { ...saleRecord, appointment_id: undefined },
    { ...saleRecord, appointment_id: undefined, customer_id: undefined, sale_group_id: undefined, host_company_id: undefined },
  ]) {
    const res = await supabase.from('sales').insert(attempt).select().single();
    sale = res.data as ProcessSplitPaymentResult['sale'] | null;
    saleError = res.error;
    if (!saleError) break;
    if (saleError.code !== '42703' && saleError.code !== 'PGRST204') break;
  }

  if (saleError || !sale) {
    throw new Error(`Error creando ticket: ${saleError?.message ?? 'sin datos'}`);
  }

  const saleItems = input.group.map((item) => ({
    sale_id: sale!.id,
    article_id: item.variationId ? null : item.id.match(/^[0-9a-f-]{36}$/i) ? item.id : null,
    variation_id: item.variationId || null,
    description: item.name,
    quantity: item.quantity,
    unit_price: item.price,
    total_price: item.total,
  }));

  const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
  if (itemsError) throw new Error(`Error creando líneas: ${itemsError.message}`);

  const newPaidCount = paidCount + 1;
  await updateSaleGroupStatus(saleGroupId, input.isLastPayment ? totalGroups : newPaidCount, totalGroups);

  return { sale, saleGroupId };
}

export async function processSingleCompanySale(
  items: CartItemWithBilling[],
  total: number,
  paymentMethod: string,
  amountPaid: number,
  change: number,
  context: SplitSaleContext & { billingCompanyId: string },
): Promise<ProcessSplitPaymentResult> {
  return processSplitPayment(
    {
      group: items,
      total,
      paymentMethod,
      amountPaid,
      change,
      billingCompanyId: context.billingCompanyId,
      context,
      isLastPayment: true,
      globalTotal: total,
    },
    0,
    1,
  );
}
