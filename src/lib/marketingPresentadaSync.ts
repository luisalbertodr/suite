import { supabase } from '@/lib/supabase';
import type { MarketingLead } from '@/hooks/useMarketingLeads';
import type { CustomerLookupRow } from '@/lib/customerLookupMatch';
import {
  buildCustomerLookupIndex,
  fetchCustomerLookupRows,
} from '@/lib/customerLookupMatch';
import { isPresentadaExitoStageName } from '@/lib/marketingPresentadaStage';
import {
  fetchCustomerAppointmentInvoiceIds,
  fetchCustomerInvoices,
  hasAppointmentInvoiceSince,
  invoicedValueDiffers,
  leadInvoicingSinceDate,
  sumInvoicedSince,
} from '@/lib/marketingInvoicedTotals';

export type MarketingPresentadaSyncResult = {
  moved: number;
  updated: number;
  skipped: number;
  stageName: string | null;
};

type MatchCustomer = (
  lead: Pick<MarketingLead, 'phone' | 'email' | 'customer_id'>,
) => CustomerLookupRow | null;

type StageLike = { id: string; name: string };

type LeadUpdate = {
  id: string;
  value: number;
  stage_id?: string;
  position_in_stage?: number;
};

export async function runMarketingPresentadaInvoicedSync(input: {
  companyId: string;
  stages: StageLike[];
  leads: MarketingLead[];
  matchCustomer: MatchCustomer;
  customerIdsFilter?: string[] | null;
}): Promise<MarketingPresentadaSyncResult> {
  const { companyId, stages, leads, matchCustomer, customerIdsFilter } = input;

  const presentadaStage = stages.find((s) => isPresentadaExitoStageName(s.name));
  if (!presentadaStage) {
    return { moved: 0, updated: 0, skipped: 0, stageName: null };
  }

  const filterSet = customerIdsFilter?.length
    ? new Set(customerIdsFilter.filter(Boolean))
    : null;

  const leadCustomerPairs: Array<{ lead: MarketingLead; customerId: string }> = [];
  let skipped = 0;

  for (const lead of leads) {
    const customerId = lead.customer_id ?? matchCustomer(lead)?.id ?? null;
    if (!customerId) {
      skipped++;
      continue;
    }
    if (filterSet && !filterSet.has(customerId)) {
      skipped++;
      continue;
    }
    leadCustomerPairs.push({ lead, customerId });
  }

  if (!leadCustomerPairs.length) {
    return { moved: 0, updated: 0, skipped, stageName: presentadaStage.name };
  }

  const customerIds = [...new Set(leadCustomerPairs.map((p) => p.customerId))];
  const [invoices, appointmentInvoiceIds] = await Promise.all([
    fetchCustomerInvoices(companyId, customerIds),
    fetchCustomerAppointmentInvoiceIds(companyId, customerIds),
  ]);

  const presentadaCount = leads.filter((l) => l.stage_id === presentadaStage.id).length;
  let nextPosition = presentadaCount;

  const updates: LeadUpdate[] = [];

  for (const { lead, customerId } of leadCustomerPairs) {
    const sinceDate = leadInvoicingSinceDate(lead);
    const hasAppointmentInvoice = hasAppointmentInvoiceSince(
      invoices,
      appointmentInvoiceIds,
      customerId,
      sinceDate,
    );
    if (!hasAppointmentInvoice) {
      skipped++;
      continue;
    }

    const total = sumInvoicedSince(invoices, customerId, sinceDate, {
      appointmentInvoiceIds,
    });
    if (total <= 0) {
      skipped++;
      continue;
    }

    const inPresentada = lead.stage_id === presentadaStage.id;
    const valueChanged = invoicedValueDiffers(lead.value, total);

    if (inPresentada) {
      if (!valueChanged) {
        skipped++;
        continue;
      }
      updates.push({ id: lead.id, value: total });
      continue;
    }

    updates.push({
      id: lead.id,
      value: total,
      stage_id: presentadaStage.id,
      position_in_stage: nextPosition++,
    });
  }

  if (updates.length > 0) {
    const results = await Promise.all(
      updates.map((u) => {
        const payload: Record<string, unknown> = { value: u.value };
        if (u.stage_id) payload.stage_id = u.stage_id;
        if (typeof u.position_in_stage === 'number') {
          payload.position_in_stage = u.position_in_stage;
        }
        return supabase.from('marketing_leads').update(payload).eq('id', u.id);
      }),
    );
    const firstErr = results.find((r) => r.error)?.error;
    if (firstErr) throw firstErr;
  }

  const moved = updates.filter((u) => u.stage_id).length;
  const updated = updates.filter((u) => !u.stage_id).length;

  return {
    moved,
    updated,
    skipped,
    stageName: presentadaStage.name,
  };
}

export async function runMarketingPresentadaInvoicedSyncForCompany(
  companyId: string,
  opts?: { customerIds?: string[] },
): Promise<MarketingPresentadaSyncResult> {
  const [stagesRes, leadsRes, customers] = await Promise.all([
    supabase
      .from('marketing_lead_stages')
      .select('id, name')
      .eq('company_id', companyId)
      .order('position', { ascending: true }),
    supabase
      .from('marketing_leads')
      .select('*')
      .eq('company_id', companyId)
      .is('archived_at', null),
    fetchCustomerLookupRows(companyId),
  ]);

  if (stagesRes.error) throw stagesRes.error;
  if (leadsRes.error) throw leadsRes.error;

  const matchCustomer = buildCustomerLookupIndex(customers).match;

  return runMarketingPresentadaInvoicedSync({
    companyId,
    stages: stagesRes.data ?? [],
    leads: (leadsRes.data ?? []) as MarketingLead[],
    matchCustomer,
    customerIdsFilter: opts?.customerIds ?? null,
  });
}
