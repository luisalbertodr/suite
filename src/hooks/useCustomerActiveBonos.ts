import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import type { PostgrestError } from '@supabase/supabase-js';
import { bonoSessionsDisplay } from '@/lib/bonoSessionsDisplay';

export type ActiveBonoCoverageLine = {
  index: number;
  coverage_type: string;
  article_id: string | null;
  family_code: string | null;
  covered_quantity: number;
  used_quantity: number;
  remaining: number;
  label: string;
};

export type CustomerActiveBono = {
  id: string;
  nombre: string;
  legacy_codboncli: string | null;
  sesiones_totales: number;
  sesiones_usadas: number;
  remaining: number;
  coverage_items: ActiveBonoCoverageLine[];
  storage: 'bonos' | 'customer_vouchers';
  /** Solo vouchers legacy con artículo enlazado */
  article_id?: string | null;
  article_price?: number;
  article_duration?: number;
};

const isMissingRelation = (error: PostgrestError | null) =>
  Boolean(
    error &&
      (error.code === '42P01' ||
        (error.message || '').toLowerCase().includes('relation') ||
        (error.message || '').toLowerCase().includes('does not exist'))
  );

function parseCoverage(raw: unknown): ActiveBonoCoverageLine[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((it, index) => {
    const covered = Number(it?.covered_quantity ?? 1);
    const used = Number(it?.used_quantity ?? 0);
    return {
      index,
      coverage_type: String(it?.coverage_type ?? 'service'),
      article_id: it?.article_id ? String(it.article_id) : null,
      family_code: it?.family_code ? String(it.family_code) : null,
      covered_quantity: covered,
      used_quantity: used,
      remaining: Math.max(0, covered - used),
      label: String(it?.label ?? 'Cobertura'),
    };
  });
}

async function fetchVoucherBonos(companyId: string, customerId: string): Promise<CustomerActiveBono[]> {
  const { data, error } = await supabase
    .from('customer_vouchers')
    .select('id,article_id,total_sessions,used_sessions,is_active,bonus_definition_id,coverage_items,voucher_code,articles(descripcion,precio,duration_minutes)')
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data || [])
    .map((v: any) => {
      const coverage_items = parseCoverage(v.coverage_items);
      const sesiones_totales = Number(v.total_sessions || 0);
      const sesiones_usadas = Number(v.used_sessions || 0);
      const base = {
        id: String(v.id),
        nombre: v.voucher_code || v.articles?.descripcion || 'Bono',
        legacy_codboncli: null,
        sesiones_totales,
        sesiones_usadas,
        coverage_items,
        storage: 'customer_vouchers' as const,
        article_id: v.article_id ? String(v.article_id) : null,
        article_price: Math.max(0, Number(v.articles?.precio || 0)),
        article_duration: Math.max(0, Number(v.articles?.duration_minutes || 0)),
      };
      return { ...base, remaining: bonoSessionsDisplay(base).remaining };
    })
    .filter((b) => b.remaining > 0);
}

export async function fetchCustomerActiveBonos(
  companyId: string,
  customerId: string,
): Promise<CustomerActiveBono[]> {
  const { data: bonosRows, error: bonosError } = await supabase
    .from('bonos')
    .select('id,nombre,legacy_codboncli,sesiones_totales,sesiones_usadas,estado,coverage_items')
    .eq('company_id', companyId)
    .eq('customer_id', customerId)
    .neq('estado', 'completado')
    .order('created_at', { ascending: false });

  if (!bonosError) {
    return (bonosRows || [])
      .map((row: any) => {
        const coverage_items = parseCoverage(row.coverage_items);
        const sesiones_totales = Number(row.sesiones_totales ?? 0);
        const sesiones_usadas = Number(row.sesiones_usadas ?? 0);
        const base = {
          id: String(row.id),
          nombre: row.nombre ?? 'Bono',
          legacy_codboncli: row.legacy_codboncli ?? null,
          sesiones_totales,
          sesiones_usadas,
          coverage_items,
          storage: 'bonos' as const,
        };
        return { ...base, remaining: bonoSessionsDisplay(base).remaining };
      })
      .filter((b) => b.remaining > 0);
  }

  if (!isMissingRelation(bonosError)) throw bonosError;
  return fetchVoucherBonos(companyId, customerId);
}

export function useCustomerActiveBonos(customerId: string | null | undefined) {
  const { companyId } = useCompanyFilter();
  return useQuery({
    queryKey: ['customer-active-bonos', companyId, customerId],
    enabled: !!companyId && !!customerId,
    queryFn: () => fetchCustomerActiveBonos(companyId!, customerId!),
    staleTime: 20_000,
  });
}
