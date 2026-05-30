import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

export interface TpvSettings {
  /** Emite factura al cobrar una cita desde TPV (si hay cliente vinculado). */
  autoInvoiceOnAppointmentCharge: boolean;
}

export const TPV_SETTINGS_KEY = 'tpv_settings';

export const DEFAULT_TPV_SETTINGS: TpvSettings = {
  autoInvoiceOnAppointmentCharge: false,
};

function normalize(raw: unknown): TpvSettings {
  const parsed = raw && typeof raw === 'object' ? (raw as Partial<TpvSettings>) : {};
  return {
    autoInvoiceOnAppointmentCharge: parsed.autoInvoiceOnAppointmentCharge === true,
  };
}

export const useTpvSettings = () => {
  const { companyId } = useCompanyFilter();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['tpv-settings', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('company_id', companyId!)
        .eq('setting_key', TPV_SETTINGS_KEY)
        .maybeSingle();

      if (error) throw error;
      if (!data?.setting_value) return DEFAULT_TPV_SETTINGS;

      try {
        return normalize(JSON.parse(data.setting_value));
      } catch {
        return DEFAULT_TPV_SETTINGS;
      }
    },
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: async (settings: TpvSettings) => {
      if (!companyId) throw new Error('No hay empresa activa');
      const { error } = await supabase.from('system_settings').upsert(
        [
          {
            company_id: companyId,
            setting_key: TPV_SETTINGS_KEY,
            setting_value: JSON.stringify(settings),
          },
        ],
        { onConflict: 'company_id,setting_key' },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tpv-settings'] });
    },
  });

  return {
    settings: query.data ?? DEFAULT_TPV_SETTINGS,
    isLoading: query.isLoading,
    saveSettings: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    defaultSettings: DEFAULT_TPV_SETTINGS,
  };
};
