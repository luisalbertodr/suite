import { supabase } from '@/lib/supabase';
import type { MarketingLead } from '@/hooks/useMarketingLeads';
import type { CustomerLookupRow } from '@/lib/customerLookupMatch';
import {
  buildCustomerLookupIndex,
  fetchCustomerLookupRowsForCompanies,
  normalizePersonName,
} from '@/lib/customerLookupMatch';
import { isPresentadaExitoStageName } from '@/lib/marketingPresentadaStage';
import {
  MARKETING_ACCESS_COMPANY_IDS,
  MARKETING_BILLING_COMPANY_IDS,
} from '@/lib/marketingScope';
import {
  fetchDunasoftFacturadoCharges,
  hasDunasoftFacturadoSince,
} from '@/lib/marketingDunasoftCharges';
import {
  fetchCustomerAppointmentCharges,
  fetchCustomerAppointmentInvoiceIds,
  fetchCustomerInvoices,
  hasChargedAppointmentSince,
  hasStyleSyncedInvoiceSince,
  invoicedValueDiffers,
  leadInvoicingSinceDate,
  sumInvoicedSince,
} from '@/lib/marketingInvoicedTotals';
import { notifyMetaConversionStageChange } from '@/lib/metaConversionStageNotify';

export type MarketingPresentadaSyncResult = {
  moved: number;
  updated: number;
  skipped: number;
  linked: number;
  stageName: string | null;
};

type MatchCustomer = (criteria: {
  phone?: string | null;
  email?: string | null;
  name?: string | null;
  customer_id?: string | null;
}) => CustomerLookupRow | null;

type StageLike = { id: string; name: string };

type LeadUpdate = {
  id: string;
  value: number;
  stage_id?: string;
  position_in_stage?: number;
};

function leadFullName(lead: Pick<MarketingLead, 'first_name' | 'last_name'>): string {
  return [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim();
}

function customerChargeMetaForIds(
  customerIds: string[],
  customerLookupRows: CustomerLookupRow[],
  leadCustomerPairs: Array<{ lead: MarketingLead; customerId: string }>,
  matchCustomer: MatchCustomer,
) {
  const byId = new Map(customerLookupRows.map((c) => [c.id, c]));
  const out: Array<{
    id: string;
    phone?: string | null;
    phone_mobile?: string | null;
    phone_home?: string | null;
    legacy_codcli?: string | null;
  }> = [];
  const added = new Set<string>();

  for (const customerId of customerIds) {
    if (added.has(customerId)) continue;
    let row = byId.get(customerId);
    if (!row) {
      const pair = leadCustomerPairs.find((p) => p.customerId === customerId);
      if (pair) {
        row =
          matchCustomer({
            phone: pair.lead.phone,
            email: pair.lead.email,
            name: leadFullName(pair.lead),
          }) ?? undefined;
      }
    }
    if (!row) continue;
    added.add(customerId);
    out.push({
      id: row.id,
      phone: row.phone,
      phone_mobile: row.phone_mobile,
      phone_home: row.phone_home,
      legacy_codcli: row.legacy_codcli ?? null,
    });
  }
  return out;
}

async function fetchWhatsappChatNamesByLeadId(
  companyId: string,
  leadIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!leadIds.length) return out;
  const CHUNK = 200;
  for (let i = 0; i < leadIds.length; i += CHUNK) {
    const slice = leadIds.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('whatsapp_chats')
      .select('marketing_lead_id, name')
      .eq('company_id', companyId)
      .in('marketing_lead_id', slice);
    if (error) throw error;
    for (const row of data ?? []) {
      const leadId = row.marketing_lead_id as string | null;
      const name = (row.name as string | null)?.trim();
      if (leadId && name && !out.has(leadId)) out.set(leadId, name);
    }
  }
  return out;
}

function resolveLeadCustomer(
  lead: MarketingLead,
  matchCustomer: MatchCustomer,
  chatNameByLeadId: Map<string, string>,
): CustomerLookupRow | null {
  if (lead.customer_id) {
    return matchCustomer({ phone: lead.phone, email: lead.email, name: leadFullName(lead) }) ??
      ({ id: lead.customer_id } as CustomerLookupRow);
  }
  const byPhoneOrEmail = matchCustomer({
    phone: lead.phone,
    email: lead.email,
  });
  if (byPhoneOrEmail) return byPhoneOrEmail;

  const full = leadFullName(lead);
  if (full && normalizePersonName(full).includes(' ')) {
    const byLeadName = matchCustomer({ name: full });
    if (byLeadName) return byLeadName;
  }

  const chatName = chatNameByLeadId.get(lead.id);
  if (chatName) {
    const byChat = matchCustomer({ name: chatName });
    if (byChat) return byChat;
  }
  return null;
}

export async function runMarketingPresentadaInvoicedSync(input: {
  companyId: string;
  stages: StageLike[];
  leads: MarketingLead[];
  matchCustomer: MatchCustomer;
  /** Clientes ya cargados (Estética + Medicina); evita GET gigante id=in.(...) */
  customerLookupRows?: CustomerLookupRow[];
  customerIdsFilter?: string[] | null;
}): Promise<MarketingPresentadaSyncResult> {
  const { companyId, stages, leads, matchCustomer, customerLookupRows, customerIdsFilter } =
    input;

  const presentadaStage = stages.find((s) => isPresentadaExitoStageName(s.name));
  if (!presentadaStage) {
    return { moved: 0, updated: 0, skipped: 0, linked: 0, stageName: null };
  }

  const filterSet = customerIdsFilter?.length
    ? new Set(customerIdsFilter.filter(Boolean))
    : null;

  const needsNameFallback = leads.filter((l) => !l.customer_id && !l.phone && !l.email);
  const maybeUnlinked = leads.filter((l) => !l.customer_id);
  const chatNameByLeadId = await fetchWhatsappChatNamesByLeadId(
    companyId,
    maybeUnlinked.map((l) => l.id),
  );
  void needsNameFallback;

  const leadCustomerPairs: Array<{
    lead: MarketingLead;
    customerId: string;
    newlyLinked: boolean;
    matched: CustomerLookupRow | null;
  }> = [];
  let skipped = 0;

  for (const lead of leads) {
    const matched = resolveLeadCustomer(lead, matchCustomer, chatNameByLeadId);
    const customerId = lead.customer_id ?? matched?.id ?? null;
    if (!customerId) {
      skipped++;
      continue;
    }
    if (filterSet && !filterSet.has(customerId)) {
      skipped++;
      continue;
    }
    leadCustomerPairs.push({
      lead,
      customerId,
      newlyLinked: !lead.customer_id && !!matched?.id,
      matched: matched?.id === customerId ? matched : null,
    });
  }

  // Persistimos vínculos lead → cliente (y teléfono vacío del cliente si el lead lo trae).
  let linked = 0;
  const linkOps = leadCustomerPairs.filter((p) => p.newlyLinked);
  if (linkOps.length > 0) {
    const results = await Promise.all(
      linkOps.map(async ({ lead, customerId, matched }) => {
        const { error: leadErr } = await supabase
          .from('marketing_leads')
          .update({ customer_id: customerId })
          .eq('id', lead.id)
          .eq('company_id', companyId);
        if (leadErr) return leadErr;

        if (lead.phone?.trim() && matched && !matched.phone && !matched.phone_mobile && !matched.phone_home) {
          const { error: custErr } = await supabase
            .from('customers')
            .update({ phone: lead.phone.trim(), phone_mobile: lead.phone.trim() })
            .eq('id', customerId);
          if (custErr) return custErr;
        }

        await supabase
          .from('whatsapp_chats')
          .update({ customer_id: customerId })
          .eq('company_id', companyId)
          .eq('marketing_lead_id', lead.id)
          .is('customer_id', null);

        return null;
      }),
    );
    const firstErr = results.find(Boolean);
    if (firstErr) throw firstErr;
    linked = linkOps.length;
  }

  if (!leadCustomerPairs.length) {
    return { moved: 0, updated: 0, skipped, linked, stageName: presentadaStage.name };
  }

  const customerIds = [...new Set(leadCustomerPairs.map((p) => p.customerId))];
  const billingCompanyIds = [...MARKETING_BILLING_COMPANY_IDS];
  const customerMeta = customerChargeMetaForIds(
    customerIds,
    customerLookupRows ?? [],
    leadCustomerPairs,
    matchCustomer,
  );

  const [invoices, appointmentInvoiceIds, appointmentCharges, dunasoftCharges] =
    await Promise.all([
      fetchCustomerInvoices(billingCompanyIds, customerIds),
      fetchCustomerAppointmentInvoiceIds(billingCompanyIds, customerIds),
      fetchCustomerAppointmentCharges(billingCompanyIds, customerIds),
      fetchDunasoftFacturadoCharges(customerMeta),
    ]);

  const presentadaCount = leads.filter((l) => l.stage_id === presentadaStage.id).length;
  let nextPosition = presentadaCount;

  const updates: LeadUpdate[] = [];

  for (const { lead, customerId } of leadCustomerPairs) {
    const sinceDate = leadInvoicingSinceDate(lead);
    const hasChargedAppointment =
      hasChargedAppointmentSince(appointmentCharges, customerId, sinceDate) ||
      hasDunasoftFacturadoSince(dunasoftCharges, customerId, sinceDate) ||
      hasStyleSyncedInvoiceSince(invoices, customerId, sinceDate);
    if (!hasChargedAppointment) {
      skipped++;
      continue;
    }

    const total = sumInvoicedSince(invoices, customerId, sinceDate, {
      appointmentInvoiceIds,
    });

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
        const payload: {
          value: number;
          stage_id?: string;
          position_in_stage?: number;
        } = { value: u.value };
        if (u.stage_id) payload.stage_id = u.stage_id;
        if (typeof u.position_in_stage === 'number') {
          payload.position_in_stage = u.position_in_stage;
        }
        return supabase.from('marketing_leads').update(payload).eq('id', u.id);
      }),
    );
    const firstErr = results.find((r) => r.error)?.error;
    if (firstErr) throw firstErr;

    for (const u of updates) {
      if (u.stage_id) void notifyMetaConversionStageChange(u.id);
    }
  }

  const moved = updates.filter((u) => u.stage_id).length;
  const updated = updates.filter((u) => !u.stage_id).length;

  return {
    moved,
    updated,
    skipped,
    linked,
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
    fetchCustomerLookupRowsForCompanies(MARKETING_ACCESS_COMPANY_IDS),
  ]);

  if (stagesRes.error) throw stagesRes.error;
  if (leadsRes.error) throw leadsRes.error;

  const matchCustomer = buildCustomerLookupIndex(customers).match;

  return runMarketingPresentadaInvoicedSync({
    companyId,
    stages: stagesRes.data ?? [],
    leads: (leadsRes.data ?? []) as MarketingLead[],
    matchCustomer,
    customerLookupRows: customers,
    customerIdsFilter: opts?.customerIds ?? null,
  });
}
