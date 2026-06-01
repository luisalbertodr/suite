import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { MarketingLead } from '@/hooks/useMarketingLeads';
import type { MarketingLeadStage } from '@/hooks/useMarketingStages';
import type { CustomerLookupRow } from '@/hooks/useCustomerLookup';
import { isPresentadaExitoStageName } from '@/lib/marketingPresentadaStage';
import {
  fetchCustomerInvoices,
  invoicedValueDiffers,
  leadInvoicingSinceDate,
  sumInvoicedSince,
} from '@/lib/marketingInvoicedTotals';

export type MarketingInvoicedValueSyncResult = {
  updated: number;
  skipped: number;
  stageName: string | null;
};

type MatchCustomer = (lead: Pick<MarketingLead, 'phone' | 'email' | 'customer_id'>) => CustomerLookupRow | null;

export const useMarketingInvoicedValueSync = (input: {
  companyId: string | null | undefined;
  stages: MarketingLeadStage[];
  leads: MarketingLead[];
  matchCustomer: MatchCustomer;
  enabled?: boolean;
}) => {
  const { companyId, stages, leads, matchCustomer, enabled = true } = input;
  const queryClient = useQueryClient();
  const syncingRef = useRef(false);

  const runSync = useCallback(async (): Promise<MarketingInvoicedValueSyncResult> => {
    if (!companyId) {
      return { updated: 0, skipped: 0, stageName: null };
    }

    const stage = stages.find((s) => isPresentadaExitoStageName(s.name));
    if (!stage) {
      return { updated: 0, skipped: 0, stageName: null };
    }

    const stageLeads = leads.filter((l) => l.stage_id === stage.id);
    if (!stageLeads.length) {
      return { updated: 0, skipped: 0, stageName: stage.name };
    }

    const leadCustomerPairs: Array<{ leadId: string; customerId: string }> = [];
    let skipped = 0;

    for (const lead of stageLeads) {
      const customerId = lead.customer_id ?? matchCustomer(lead)?.id ?? null;
      if (!customerId) {
        skipped++;
        continue;
      }
      leadCustomerPairs.push({ leadId: lead.id, customerId });
    }

    if (!leadCustomerPairs.length) {
      return { updated: 0, skipped, stageName: stage.name };
    }

    const customerIds = [...new Set(leadCustomerPairs.map((p) => p.customerId))];
    const invoices = await fetchCustomerInvoices(companyId, customerIds);

    const updates: Array<{ id: string; value: number }> = [];
    for (const { leadId, customerId } of leadCustomerPairs) {
      const lead = stageLeads.find((l) => l.id === leadId);
      if (!lead) continue;
      const sinceDate = leadInvoicingSinceDate(lead);
      const total = sumInvoicedSince(invoices, customerId, sinceDate);
      if (total <= 0) {
        skipped++;
        continue;
      }
      if (!invoicedValueDiffers(lead.value, total)) {
        skipped++;
        continue;
      }
      updates.push({ id: leadId, value: total });
    }

    if (updates.length > 0) {
      const results = await Promise.all(
        updates.map((u) =>
          supabase.from('marketing_leads').update({ value: u.value }).eq('id', u.id),
        ),
      );
      const firstErr = results.find((r) => r.error)?.error;
      if (firstErr) throw firstErr;
      await queryClient.invalidateQueries({ queryKey: ['marketing-leads', companyId] });
    }

    return {
      updated: updates.length,
      skipped,
      stageName: stage.name,
    };
  }, [companyId, stages, leads, matchCustomer, queryClient]);

  const syncFingerprint = useMemo(() => {
    const stage = stages.find((s) => isPresentadaExitoStageName(s.name));
    if (!stage) return '';
    return leads
      .filter((l) => l.stage_id === stage.id)
      .map((l) => {
        const since = leadInvoicingSinceDate(l);
        return `${l.id}:${l.customer_id ?? ''}:${since}:${l.value ?? 0}`;
      })
      .sort()
      .join('|');
  }, [stages, leads]);

  useEffect(() => {
    if (!enabled || !companyId || !syncFingerprint || syncingRef.current) return;

    let cancelled = false;
    syncingRef.current = true;
    runSync()
      .catch((e) => console.warn('Sync valor facturado (Presentada con éxito):', e))
      .finally(() => {
        if (!cancelled) syncingRef.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, companyId, syncFingerprint, runSync]);

  return { runSync };
};
