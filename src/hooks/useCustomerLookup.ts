import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

export type CustomerLookupRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  phone_mobile: string | null;
  phone_home: string | null;
};

const digitsOnly = (s: string | null | undefined): string =>
  (s ?? '').replace(/\D/g, '');

const phoneVariants = (raw: string | null | undefined): string[] => {
  const d = digitsOnly(raw);
  if (!d) return [];
  const out = new Set<string>();
  out.add(d);
  if (d.length > 9) out.add(d.slice(-9));
  if (d.length > 7) out.add(d.slice(-7));
  return [...out];
};

const emailKey = (raw: string | null | undefined): string =>
  (raw ?? '').trim().toLowerCase();

export type CustomerLookupIndex = {
  byPhone: Map<string, CustomerLookupRow>;
  byEmail: Map<string, CustomerLookupRow>;
  customers: CustomerLookupRow[];
  match: (criteria: { phone?: string | null; email?: string | null }) => CustomerLookupRow | null;
};

export const useCustomerLookup = (): {
  index: CustomerLookupIndex;
  isLoading: boolean;
} => {
  const { companyId, loading: companyLoading } = useCompanyFilter();

  const query = useQuery({
    queryKey: ['customer-lookup', companyId],
    enabled: !!companyId && !companyLoading,
    queryFn: async (): Promise<CustomerLookupRow[]> => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, email, phone, phone_mobile, phone_home')
        .eq('company_id', companyId);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const index = useMemo<CustomerLookupIndex>(() => {
    const byPhone = new Map<string, CustomerLookupRow>();
    const byEmail = new Map<string, CustomerLookupRow>();
    const customers = query.data ?? [];

    for (const c of customers) {
      for (const ph of [c.phone, c.phone_mobile, c.phone_home]) {
        for (const variant of phoneVariants(ph)) {
          if (!byPhone.has(variant)) byPhone.set(variant, c);
        }
      }
      const e = emailKey(c.email);
      if (e) byEmail.set(e, c);
    }

    const match: CustomerLookupIndex['match'] = ({ phone, email }) => {
      for (const variant of phoneVariants(phone)) {
        const hit = byPhone.get(variant);
        if (hit) return hit;
      }
      const e = emailKey(email);
      if (e) {
        const hit = byEmail.get(e);
        if (hit) return hit;
      }
      return null;
    };

    return { byPhone, byEmail, customers, match };
  }, [query.data]);

  return { index, isLoading: query.isLoading };
};
