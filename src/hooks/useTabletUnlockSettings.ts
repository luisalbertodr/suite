import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import {
  DEFAULT_TABLET_UNLOCK_SETTINGS,
  normalizeTabletUnlockSettings,
  TABLET_UNLOCK_SETTINGS_KEY,
  type TabletUnlockSettings,
} from '@/lib/tabletUnlockSettings';

export function useTabletUnlockSettings(companyIdOverride?: string | null) {
  const { companyId: filterCompanyId } = useCompanyFilter();
  const companyId = companyIdOverride ?? filterCompanyId;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['tablet-unlock-settings', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('company_id', companyId!)
        .eq('setting_key', TABLET_UNLOCK_SETTINGS_KEY)
        .maybeSingle();

      if (error) throw error;
      if (!data?.setting_value) return DEFAULT_TABLET_UNLOCK_SETTINGS;

      try {
        return normalizeTabletUnlockSettings(JSON.parse(data.setting_value));
      } catch {
        return DEFAULT_TABLET_UNLOCK_SETTINGS;
      }
    },
    staleTime: 60_000,
  });

  const saveMutation = useMutation({
    mutationFn: async (settings: TabletUnlockSettings) => {
      if (!companyId) throw new Error('No hay empresa activa');
      const { error } = await supabase.from('system_settings').upsert(
        [
          {
            company_id: companyId,
            setting_key: TABLET_UNLOCK_SETTINGS_KEY,
            setting_value: JSON.stringify(settings),
          },
        ],
        { onConflict: 'company_id,setting_key' },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tablet-unlock-settings'] });
    },
  });

  return {
    settings: query.data ?? DEFAULT_TABLET_UNLOCK_SETTINGS,
    isLoading: query.isLoading,
    saveSettings: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    defaultSettings: DEFAULT_TABLET_UNLOCK_SETTINGS,
  };
}
