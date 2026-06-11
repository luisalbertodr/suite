import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  dniMatchKeys,
  normalizeInbodyMeasurement,
  type InbodyMeasurement,
} from '@/lib/inbodyMeasurements';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

export function useInbodyMeasurements(
  customerId: string | undefined,
  taxId: string | null | undefined,
  /** Empresa del cliente (customers.company_id); evita filtrar por la sesión activa si difiere. */
  customerCompanyId?: string | null,
) {
  const { companyId: sessionCompanyId } = useCompanyFilter();
  const companyId = customerCompanyId || sessionCompanyId;
  const taxKeys = taxId ? dniMatchKeys(taxId) : [];

  return useQuery({
    queryKey: ['inbody_measurements', companyId, customerId, taxKeys.join('|')],
    enabled: Boolean(companyId && customerId),
    queryFn: async (): Promise<InbodyMeasurement[]> => {
      if (!companyId || !customerId) return [];

      const orParts = [`customer_id.eq.${customerId}`];
      for (const key of taxKeys) {
        orParts.push(`inbody_user_id.eq.${key}`);
      }

      const { data, error } = await (supabase as any)
        .from('inbody_measurements')
        .select('*')
        .eq('company_id', companyId)
        .or(orParts.join(','))
        .order('measured_at', { ascending: false });

      if (error) throw error;

      const seen = new Set<string>();
      const deduped: InbodyMeasurement[] = [];
      for (const row of (data || []) as InbodyMeasurement[]) {
        const key = `${row.inbody_user_id}|${row.measured_at}`;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(normalizeInbodyMeasurement(row));
      }
      return deduped;
    },
  });
}
