import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import type { Database } from '@/integrations/supabase/types';

export type MarketingFieldConfig = Database['public']['Tables']['marketing_field_config']['Row'];
export type MarketingFieldConfigInsert = Database['public']['Tables']['marketing_field_config']['Insert'];
export type MarketingFieldConfigUpdate = Database['public']['Tables']['marketing_field_config']['Update'];

export type MarketingFieldType = 'string' | 'phone' | 'email' | 'number' | 'currency' | 'datetime';

const DEFAULT_FIELDS: Array<Omit<MarketingFieldConfigInsert, 'company_id'>> = [
  { field_key: 'value',      display_label: 'Valor del cliente',     visible_in_card: true,  visible_in_detail: true, sort_order: 0, field_type: 'currency', is_system: true },
  { field_key: 'phone',      display_label: 'Teléfono del contacto', visible_in_card: true,  visible_in_detail: true, sort_order: 1, field_type: 'phone',    is_system: true },
  { field_key: 'first_name', display_label: 'Contacto',              visible_in_card: true,  visible_in_detail: true, sort_order: 2, field_type: 'string',   is_system: true },
  { field_key: 'created_at', display_label: 'Creado el',             visible_in_card: true,  visible_in_detail: true, sort_order: 3, field_type: 'datetime', is_system: true },
  { field_key: 'email',      display_label: 'Email',                 visible_in_card: false, visible_in_detail: true, sort_order: 4, field_type: 'email',    is_system: true },
  { field_key: 'form_name',  display_label: 'Formulario',            visible_in_card: false, visible_in_detail: true, sort_order: 5, field_type: 'string',   is_system: true },
  { field_key: 'source',     display_label: 'Origen',                visible_in_card: false, visible_in_detail: true, sort_order: 6, field_type: 'string',   is_system: true },
];

export const useMarketingFieldConfig = (scopeCompanyId?: string | null) => {
  const queryClient = useQueryClient();
  const { companyId: hostCompanyId, loading: companyLoading } = useCompanyFilter();
  const companyId = scopeCompanyId ?? hostCompanyId;

  const query = useQuery({
    queryKey: ['marketing-field-config', companyId],
    enabled: !!companyId && !companyLoading,
    staleTime: 60_000,
    queryFn: async (): Promise<MarketingFieldConfig[]> => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('marketing_field_config')
        .select('*')
        .eq('company_id', companyId)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      if (!data || data.length === 0) {
        const seedRows = DEFAULT_FIELDS.map((f) => ({ ...f, company_id: companyId }));
        const { data: seeded, error: seedError } = await supabase
          .from('marketing_field_config')
          .insert(seedRows)
          .select('*');
        if (seedError) {
          console.warn('No se pudo sembrar la configuración de campos:', seedError.message);
          return [];
        }
        return (seeded ?? []).sort((a, b) => a.sort_order - b.sort_order);
      }

      return data;
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['marketing-field-config', companyId] });

  const upsertField = useMutation({
    mutationFn: async (input: Omit<MarketingFieldConfigInsert, 'company_id'>) => {
      if (!companyId) throw new Error('Sin empresa');
      const { data, error } = await supabase
        .from('marketing_field_config')
        .upsert(
          { ...input, company_id: companyId },
          { onConflict: 'company_id,field_key' }
        )
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const updateField = useMutation({
    mutationFn: async (input: { id: string; values: MarketingFieldConfigUpdate }) => {
      const { data, error } = await supabase
        .from('marketing_field_config')
        .update(input.values)
        .eq('id', input.id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const deleteField = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('marketing_field_config')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    fields: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error as Error | null,
    upsertField,
    updateField,
    deleteField,
  };
};
