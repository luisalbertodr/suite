import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import type { BillingCompanyOption } from '@/lib/billingCompany';

export type WorkCenterInfo = {
  id: string;
  name: string;
} | null;

export function useWorkCenter() {
  const { companyId, loading: companyLoading } = useCompanyFilter();

  const hostCompanyQuery = useQuery({
    queryKey: ['host-company', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, short_name, work_center_id, tpv_ticket_prefix, tax_id')
        .eq('id', companyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && !companyLoading,
  });

  const workCenterId = hostCompanyQuery.data?.work_center_id ?? null;
  const isMultiEntity = !!workCenterId;

  const billingCompaniesQuery = useQuery({
    queryKey: ['work-center-billing-companies', companyId, workCenterId],
    queryFn: async (): Promise<BillingCompanyOption[]> => {
      if (!companyId) return [];

      if (!workCenterId) {
        const host = hostCompanyQuery.data;
        if (!host) return [];
        return [{
          id: host.id,
          name: host.name,
          short_name: host.short_name ?? null,
          tpv_ticket_prefix: host.tpv_ticket_prefix ?? null,
          tax_id: host.tax_id ?? null,
        }];
      }

      const { data, error } = await supabase
        .from('companies')
        .select('id, name, short_name, tpv_ticket_prefix, tax_id')
        .eq('work_center_id', workCenterId)
        .order('name');

      if (error) {
        if (error.code === '42703') {
          const host = hostCompanyQuery.data;
          return host
            ? [{
                id: host.id,
                name: host.name,
                short_name: host.short_name ?? null,
                tpv_ticket_prefix: host.tpv_ticket_prefix ?? null,
                tax_id: host.tax_id ?? null,
              }]
            : [];
        }
        throw error;
      }

      return (data ?? []) as BillingCompanyOption[];
    },
    enabled: !!companyId && !companyLoading && hostCompanyQuery.isSuccess,
  });

  const workCenterQuery = useQuery({
    queryKey: ['work-center', workCenterId],
    queryFn: async (): Promise<WorkCenterInfo> => {
      if (!workCenterId) return null;
      const { data, error } = await supabase
        .from('work_centers')
        .select('id, name')
        .eq('id', workCenterId)
        .maybeSingle();
      if (error) {
        if (error.code === '42P01' || error.code === '42703') return null;
        throw error;
      }
      return data;
    },
    enabled: !!workCenterId,
  });

  const billingCompanies = billingCompaniesQuery.data ?? [];
  const companyLabels = new Map(
    billingCompanies.map((c) => [c.id, c.short_name?.trim() || c.name]),
  );

  const catalogHostQuery = useQuery({
    queryKey: ['work-center-catalog-host', workCenterId, billingCompanies.map((c) => c.id).join(',')],
    queryFn: async (): Promise<string | null> => {
      if (!workCenterId || billingCompanies.length === 0) return companyId;
      for (const c of billingCompanies) {
        const { count, error } = await supabase
          .from('article_families')
          .select('id', { count: 'exact', head: true })
          .eq('company_id', c.id);
        if (!error && (count ?? 0) > 0) return c.id;
      }
      return billingCompanies[0]?.id ?? companyId;
    },
    enabled: !!companyId && isMultiEntity && billingCompanies.length > 0,
  });

  const catalogHostCompanyId = isMultiEntity
    ? (catalogHostQuery.data ?? billingCompanies[0]?.id ?? companyId)
    : companyId;

  const operationalCompanyId = catalogHostCompanyId ?? companyId;

  const siblingBillingCompanyId =
    isMultiEntity && companyId
      ? (billingCompanies.find((c) => c.id !== companyId)?.id ?? null)
      : null;

  return {
    companyId,
    loading:
      companyLoading ||
      hostCompanyQuery.isLoading ||
      (isMultiEntity && catalogHostQuery.isLoading),
    workCenter: workCenterQuery.data ?? null,
    workCenterId,
    isMultiEntity,
    billingCompanies,
    companyLabels,
    hostCompany: hostCompanyQuery.data ?? null,
    catalogHostCompanyId,
    operationalCompanyId,
    siblingBillingCompanyId,
  };
}
