import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';

export interface AgendaVisibleFields {
  clientName: boolean;
  service: boolean;
  description: boolean;
  timeRange: boolean;
  status: boolean;
  legacyCodes: boolean;
}

export interface AgendaPreferences {
  visibleEmployeeIds: string[];
  visibleFields: AgendaVisibleFields;
  slotMinutes: 15 | 30;
  cellHeight: number;
}

const DEFAULT_PREFERENCES: AgendaPreferences = {
  visibleEmployeeIds: [],
  visibleFields: {
    clientName: true,
    service: true,
    description: true,
    timeRange: true,
    status: true,
    legacyCodes: false,
  },
  slotMinutes: 15,
  cellHeight: 32,
};

const normalize = (raw: unknown): AgendaPreferences => {
  const parsed = (raw && typeof raw === 'object') ? (raw as Partial<AgendaPreferences>) : {};
  const fields = (parsed.visibleFields && typeof parsed.visibleFields === 'object')
    ? (parsed.visibleFields as Partial<AgendaVisibleFields>)
    : {};

  const slot = parsed.slotMinutes === 30 ? 30 : 15;
  const cellHeight = typeof parsed.cellHeight === 'number' && parsed.cellHeight >= 24 && parsed.cellHeight <= 64
    ? parsed.cellHeight
    : 32;

  return {
    visibleEmployeeIds: Array.isArray(parsed.visibleEmployeeIds)
      ? parsed.visibleEmployeeIds.filter((x): x is string => typeof x === 'string')
      : [],
    slotMinutes: slot,
    cellHeight,
    visibleFields: {
      clientName: fields.clientName ?? DEFAULT_PREFERENCES.visibleFields.clientName,
      service: fields.service ?? DEFAULT_PREFERENCES.visibleFields.service,
      description: fields.description ?? DEFAULT_PREFERENCES.visibleFields.description,
      timeRange: fields.timeRange ?? DEFAULT_PREFERENCES.visibleFields.timeRange,
      status: fields.status ?? DEFAULT_PREFERENCES.visibleFields.status,
      legacyCodes: fields.legacyCodes ?? DEFAULT_PREFERENCES.visibleFields.legacyCodes,
    },
  };
};

export const useAgendaPreferences = () => {
  const { user } = useAuth();
  const { companyId } = useCompanyFilter();
  const { operationalCompanyId, loading: wcLoading } = useWorkCenter();
  const scopeCompanyId = operationalCompanyId ?? companyId;
  const queryClient = useQueryClient();

  const settingKey = user ? `agenda_preferences:${user.id}` : null;

  const query = useQuery({
    queryKey: ['agenda-preferences', scopeCompanyId, user?.id],
    enabled: !!scopeCompanyId && !!user && !!settingKey && !wcLoading,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('company_id', scopeCompanyId!)
        .eq('setting_key', settingKey!)
        .maybeSingle();

      if (error) throw error;

      if (!data?.setting_value) return DEFAULT_PREFERENCES;

      try {
        return normalize(JSON.parse(data.setting_value));
      } catch {
        return DEFAULT_PREFERENCES;
      }
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (preferences: AgendaPreferences) => {
      if (!scopeCompanyId || !settingKey) throw new Error('No user/company context');
      const payload = JSON.stringify(preferences);

      const { error } = await supabase
        .from('system_settings')
        .upsert(
          [{
            company_id: scopeCompanyId,
            setting_key: settingKey,
            setting_value: payload,
          }],
          { onConflict: 'company_id,setting_key' }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agenda-preferences'] });
    },
  });

  return {
    preferences: query.data ?? DEFAULT_PREFERENCES,
    isLoading: query.isLoading,
    savePreferences: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    defaultPreferences: DEFAULT_PREFERENCES,
  };
};

