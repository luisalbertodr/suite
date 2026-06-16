import { supabase } from '@/lib/supabase';

/** Notifica a Meta (vía n8n) si la etapa del lead tiene regla CAPI. No bloquea la UI. */
export async function notifyMetaConversionStageChange(leadId: string): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.functions.invoke('meta-conversion-stage', {
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: { lead_id: leadId },
    });
  } catch {
    // No interrumpir flujo de Marketing por fallos de conversión
  }
}
