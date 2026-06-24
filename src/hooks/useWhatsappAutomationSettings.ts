import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

export type WhatsappAutomationSettings = {
  company_id: string;
  test_mode_enabled: boolean;
  test_phone: string;
  appointment_reminders_enabled: boolean;
  appointment_reminder_day_before_enabled: boolean;
  appointment_reminder_day_before_message: string | null;
  appointment_reminder_hour_before_enabled: boolean;
  appointment_reminder_hour_before_message: string | null;
  appointment_reminder_send_hour_start: number;
  marketing_queue_hour_start: number;
  marketing_queue_hour_end: number;
  phone_missed_whatsapp_enabled: boolean;
  phone_missed_whatsapp_phone: string;
};

export const DEFAULT_DAY_BEFORE =
  'Hola {nombre}, te recordamos tu cita mañana {fecha_cita} a las {hora_cita} en Lipoout. Si necesitas cambiarla, responde a este mensaje.';
export const DEFAULT_HOUR_BEFORE =
  'Hola {nombre}, tu cita es dentro de 1 hora ({hora_cita}). Te esperamos en Lipoout.';

export function useWhatsappAutomationSettings() {
  const { companyId, loading: companyLoading } = useCompanyFilter();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ['whatsapp-automation-settings', companyId],
    enabled: !!companyId && !companyLoading,
    staleTime: 5 * 60_000,
    retry: (failureCount, error) => {
      const msg = error instanceof Error ? error.message : String(error);
      if (/403|42501|permission|policy/i.test(msg)) return false;
      return failureCount < 2;
    },
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_automation_settings')
        .select('*')
        .eq('company_id', companyId!)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as WhatsappAutomationSettings;
      const { data: isAdmin, error: adminErr } = await supabase.rpc('is_admin');
      if (adminErr) throw adminErr;
      if (!isAdmin) return null;
      const { data: inserted, error: insErr } = await supabase
        .from('whatsapp_automation_settings')
        .insert({ company_id: companyId! })
        .select('*')
        .single();
      if (insErr) throw insErr;
      return inserted as WhatsappAutomationSettings;
    },
  });

  const save = useMutation({
    mutationFn: async (values: Partial<WhatsappAutomationSettings>) => {
      if (!companyId) throw new Error('Sin empresa activa');
      const { data, error } = await supabase
        .from('whatsapp_automation_settings')
        .update({
          ...values,
          updated_at: new Date().toISOString(),
        })
        .eq('company_id', companyId)
        .select('*')
        .single();
      if (error) throw error;
      return data as WhatsappAutomationSettings;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp-automation-settings', companyId] });
    },
  });

  const sendTest = useMutation({
    mutationFn: async (testType: 'day_before' | 'hour_before') => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sin sesión');
      const { data, error } = await supabase.functions.invoke('whatsapp-automation', {
        body: {
          action: 'test_send',
          company_id: companyId,
          test_type: testType,
        },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
  });

  return { ...query, save, sendTest, companyId };
}

export function useWhatsappAutomationLog(limit = 20) {
  const { companyId, loading: companyLoading } = useCompanyFilter();
  return useQuery({
    queryKey: ['whatsapp-automation-log', companyId, limit],
    enabled: !!companyId && !companyLoading,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_automation_send_log')
        .select('*')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
  });
}
