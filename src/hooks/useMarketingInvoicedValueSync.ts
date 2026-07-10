import { useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { MarketingLead } from '@/hooks/useMarketingLeads';
import type { MarketingLeadStage } from '@/hooks/useMarketingStages';
import type { CustomerLookupRow } from '@/hooks/useCustomerLookup';
import {
  runMarketingPresentadaInvoicedSync,
  type MarketingPresentadaSyncResult,
} from '@/lib/marketingPresentadaSync';
import { MARKETING_BILLING_COMPANY_IDS } from '@/lib/marketingScope';

export type MarketingInvoicedValueSyncResult = MarketingPresentadaSyncResult;

type MatchCustomer = (
  lead: Pick<MarketingLead, 'phone' | 'email' | 'customer_id'>,
) => CustomerLookupRow | null;

export const useMarketingInvoicedValueSync = (input: {
  companyId: string | null | undefined;
  stages: MarketingLeadStage[];
  leads: MarketingLead[];
  matchCustomer: MatchCustomer;
  customerLookupRows?: CustomerLookupRow[];
  enabled?: boolean;
}) => {
  const { companyId, stages, leads, matchCustomer, customerLookupRows, enabled = true } = input;
  const queryClient = useQueryClient();
  const syncingRef = useRef(false);
  const bootstrappedRef = useRef(false);

  useEffect(() => {
    bootstrappedRef.current = false;
  }, [companyId]);

  const stagesRef = useRef(stages);
  const leadsRef = useRef(leads);
  const matchCustomerRef = useRef(matchCustomer);
  const customerLookupRowsRef = useRef(customerLookupRows);
  stagesRef.current = stages;
  leadsRef.current = leads;
  matchCustomerRef.current = matchCustomer;
  customerLookupRowsRef.current = customerLookupRows;

  const billingCompanyKey = MARKETING_BILLING_COMPANY_IDS.join(',');

  const { data: billingTick } = useQuery({
    queryKey: ['marketing-billing-sync-tick', billingCompanyKey],
    enabled: !!companyId && enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { supabase } = await import('@/lib/supabase');
      const [invoiceRes, salesRes] = await Promise.all([
        supabase
          .from('invoices')
          .select('id, created_at')
          .in('company_id', [...MARKETING_BILLING_COMPANY_IDS])
          .order('created_at', { ascending: false })
          .limit(1),
        supabase
          .from('sales')
          .select('id, created_at')
          .in('company_id', [...MARKETING_BILLING_COMPANY_IDS])
          .eq('status', 'completed')
          .not('appointment_id', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1),
      ]);
      if (invoiceRes.error) throw invoiceRes.error;
      if (salesRes.error) throw salesRes.error;
      const inv = invoiceRes.data?.[0];
      const sale = salesRes.data?.[0];
      const invTick = inv ? `${inv.id}:${inv.created_at}` : 'none';
      const saleTick = sale ? `${sale.id}:${sale.created_at}` : 'none';
      return `${invTick}|${saleTick}`;
    },
  });

  const runSync = useCallback(async (): Promise<MarketingInvoicedValueSyncResult> => {
    if (!companyId) {
      return { moved: 0, updated: 0, skipped: 0, stageName: null };
    }

    const result = await runMarketingPresentadaInvoicedSync({
      companyId,
      stages: stagesRef.current,
      leads: leadsRef.current,
      matchCustomer: matchCustomerRef.current,
      customerLookupRows: customerLookupRowsRef.current,
    });

    if (result.moved > 0 || result.updated > 0) {
      await queryClient.refetchQueries({ queryKey: ['marketing-leads', companyId] });
    }

    return result;
  }, [companyId, queryClient]);

  const triggerSync = useCallback(() => {
    if (!enabled || !companyId || syncingRef.current) return;
    syncingRef.current = true;
    runSync()
      .catch((e) => console.warn('Sync facturación → Presentada:', e))
      .finally(() => {
        syncingRef.current = false;
      });
  }, [enabled, companyId, runSync]);

  // Al abrir marketing: una pasada inicial cuando hay leads y etapas cargados.
  useEffect(() => {
    if (!enabled || !companyId || bootstrappedRef.current) return;
    if (!stages.length || !leads.length) return;
    bootstrappedRef.current = true;
    triggerSync();
  }, [enabled, companyId, leads.length, stages.length, triggerSync]);

  // Reaccionar a cobros/facturas nuevos, no a cada arrastre manual en el kanban.
  useEffect(() => {
    if (!enabled || !companyId || billingTick == null) return;
    triggerSync();
  }, [enabled, companyId, billingTick, triggerSync]);

  return { runSync };
};
