import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import type { Database } from '@/integrations/supabase/types';

type WhatsappMessageRow = Database['public']['Tables']['whatsapp_messages']['Row'];

const RECENT_THRESHOLD_MS = 60_000;

function bestPreview(row: WhatsappMessageRow): string {
  if (row.body && row.body.trim()) return row.body.trim();
  if (row.caption && row.caption.trim()) return row.caption.trim();
  const t = (row.type ?? '').toLowerCase();
  if (!t || t === 'text' || t === 'chat') return 'Mensaje nuevo';
  return `[${t}]`;
}

function jidToName(jid: string | null | undefined): string {
  if (!jid) return 'Contacto';
  const local = jid.split('@')[0] ?? jid;
  if (/^\d+$/.test(local)) return `+${local}`;
  return local;
}

// Hook global (lo monta el Layout) que muestra un toast y, si el navegador lo
// permite, una notificación del sistema al recibir un mensaje entrante de
// WhatsApp. No notifica si ya estamos viendo la pestaña /whatsapp.
export const useWhatsappIncomingNotifier = () => {
  const { companyId, loading } = useCompanyFilter();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const inAppRef = useRef(location.pathname);
  inAppRef.current = location.pathname;

  // Pedir permiso de notificación una vez (silenciosamente; el usuario puede
  // aceptarlo o no, no insistimos).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined);
    }
  }, []);

  const channelIdRef = useRef<string>('');
  if (!channelIdRef.current) {
    channelIdRef.current = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  }
  useEffect(() => {
    if (loading) return;
    if (!companyId) return;
    if (!hasPermission('whatsapp', 'read')) return;

    const channel = supabase
      .channel(`whatsapp_incoming:${companyId}:${channelIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'whatsapp_messages',
          filter: `company_id=eq.${companyId}`,
        },
        async (payload) => {
          const row = payload.new as WhatsappMessageRow | null;
          if (!row) return;
          if (row.from_me) return;

          // Ignorar mensajes históricos (cuando hacemos backfill desde Waha)
          const ts = row.timestamp ? new Date(row.timestamp).getTime() : Date.now();
          if (Date.now() - ts > RECENT_THRESHOLD_MS) return;

          // Si el usuario YA está en la pestaña de WhatsApp visible, dejamos
          // que la propia UI muestre el mensaje, no spammeamos.
          const isInWhatsappTab = inAppRef.current.startsWith('/whatsapp');
          const isVisible =
            typeof document !== 'undefined' && document.visibilityState === 'visible';
          if (isInWhatsappTab && isVisible) return;

          // Resolver nombre legible (chat.name o cliente vinculado)
          let displayName = jidToName(row.chat_id);
          try {
            const { data: chat } = await supabase
              .from('whatsapp_chats')
              .select('name, customer_id, marketing_lead_id')
              .eq('company_id', companyId)
              .eq('chat_id', row.chat_id)
              .maybeSingle();
            if (chat?.name) {
              displayName = chat.name;
            } else if (chat?.customer_id) {
              const { data: c } = await supabase
                .from('customers')
                .select('name')
                .eq('id', chat.customer_id)
                .maybeSingle();
              if (c?.name) displayName = c.name;
            } else if (chat?.marketing_lead_id) {
              const { data: l } = await supabase
                .from('marketing_leads')
                .select('first_name, last_name')
                .eq('id', chat.marketing_lead_id)
                .maybeSingle();
              const full = [l?.first_name, l?.last_name].filter(Boolean).join(' ').trim();
              if (full) displayName = full;
            }
          } catch {
            // ignoramos: dejamos el fallback al jid
          }

          const preview = bestPreview(row);

          // 1) Toast in-app
          toast({
            title: `WhatsApp · ${displayName}`,
            description: preview,
            duration: 6000,
          });

          // 2) Notificación del sistema si el usuario lo ha autorizado
          if (
            typeof window !== 'undefined' &&
            'Notification' in window &&
            Notification.permission === 'granted' &&
            !isVisible
          ) {
            try {
              // `renotify` no está tipado en lib.dom pero algunos navegadores
              // (Chrome desktop) sí lo soportan: lo añadimos como cast a un
              // tipo extendido para no perder el tipado del resto.
              const options = {
                body: preview,
                tag: `wa:${row.chat_id}`,
                renotify: true,
              } as NotificationOptions & { renotify?: boolean };
              const n = new Notification(`WhatsApp · ${displayName}`, options);
              n.onclick = () => {
                window.focus();
                navigate(`/whatsapp?phone=${encodeURIComponent(row.chat_id)}`);
                n.close();
              };
            } catch {
              // Algunos navegadores rechazan algunas opciones (renotify, …)
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // No incluimos `navigate` ni `toast` para no rebindear el canal por cambios
    // de referencia. inAppRef se sincroniza con un ref.
  }, [companyId, loading, hasPermission]); // eslint-disable-line react-hooks/exhaustive-deps
};
