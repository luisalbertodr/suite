import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { MarketingLead } from '@/hooks/useMarketingLeads';
import type { MarketingLeadStage } from '@/hooks/useMarketingStages';
import type { CustomerLookupRow } from '@/hooks/useCustomerLookup';
import {
  runMarketingPresentadaInvoicedSync,
  type MarketingPresentadaSyncResult,
} from '@/lib/marketingPresentadaSync';

export type MarketingInvoicedValueSyncResult = MarketingPresentadaSyncResult;

type MatchCustomer = (
  lead: Pick<MarketingLead, 'phone' | 'email' | 'customer_id'>,
) => CustomerLookupRow | null;

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

  const { data: invoiceTick } = useQuery({
    queryKey: ['marketing-invoice-sync-tick', companyId],
    enabled: !!companyId && enabled,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { supabase } = await import('@/lib/supabase');
      const { data, error } = await supabase
        .from('invoices')
        .select('id, created_at')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      const row = data?.[0];
      return row ? `${row.id}:${row.created_at}` : 'none';
    },
  });

  const runSync = useCallback(async (): Promise<MarketingInvoicedValueSyncResult> => {
    if (!companyId) {
      return { moved: 0, updated: 0, skipped: 0, stageName: null };
    }

    const result = await runMarketingPresentadaInvoicedSync({
      companyId,
      stages,
      leads,
      matchCustomer,
    });

    if (result.moved > 0 || result.updated > 0) {
      await queryClient.invalidateQueries({ queryKey: ['marketing-leads', companyId] });
    }

    return result;
  }, [companyId, stages, leads, matchCustomer, queryClient]);

  // Solo reaccionar a cambios de facturación (invoiceTick), no a cada movimiento manual
  // de lead en el kanban — evita revertir etapas que acaba de cambiar el usuario.
  useEffect(() => {
    if (!enabled || !companyId || syncingRef.current) return;

    let cancelled = false;
    syncingRef.current = true;
    runSync()
      .catch((e) => console.warn('Sync facturación → Presentada:', e))
      .finally(() => {
        if (!cancelled) syncingRef.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, companyId, invoiceTick, runSync]);

  return { runSync };
};
