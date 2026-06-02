import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from '@/hooks/use-toast';
import {
  incomingMessageNotifyKey,
  isWhatsappRouteActive,
  shouldNotifyIncomingMessage,
} from '@/lib/whatsappActivity';
import { playNotificationSound } from '@/lib/notificationSounds';
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

function shouldSkipIncoming(row: WhatsappMessageRow): boolean {
  if (row.from_me === true) return true;

  const ts = row.timestamp ? new Date(row.timestamp).getTime() : Date.now();
  if (Date.now() - ts > RECENT_THRESHOLD_MS) return true;

  if (isWhatsappRouteActive()) return true;

  return false;
}

async function resolveDisplayName(
  companyId: string,
  row: WhatsappMessageRow,
): Promise<string> {
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
    // fallback al jid
  }
  return displayName;
}

type NotifierChannel = {
  refCount: number;
  channel: ReturnType<typeof supabase.channel>;
};

const channelsByCompany = new Map<string, NotifierChannel>();

// Hook global (lo monta el Layout). Solo avisa fuera de /whatsapp: toast si la
// pestaña está visible, notificación del sistema si está en segundo plano.
export const useWhatsappIncomingNotifier = () => {
  const { companyId, loading } = useCompanyFilter();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const canNotify = hasPermission('whatsapp', 'read');
  const onWhatsappRoute = location.pathname.startsWith('/whatsapp');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!companyId) return;
    if (!canNotify) return;
    // Sin suscripción en WhatsApp: la propia UI ya muestra los mensajes.
    if (onWhatsappRoute) return;

    let entry = channelsByCompany.get(companyId);
    if (!entry) {
      const channel = supabase
        .channel(`whatsapp_incoming:${companyId}`)
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
            if (!row || shouldSkipIncoming(row)) return;
            if (!shouldNotifyIncomingMessage(incomingMessageNotifyKey(row))) return;

            const displayName = await resolveDisplayName(companyId, row);
            if (shouldSkipIncoming(row) || isWhatsappRouteActive()) return;

            const preview = bestPreview(row);
            const isVisible =
              typeof document !== 'undefined' &&
              document.visibilityState === 'visible';

            playNotificationSound('whatsapp');

            if (isVisible) {
              toast({
                title: `WhatsApp · ${displayName}`,
                description: preview,
                duration: 6000,
              });
            } else if (
              typeof window !== 'undefined' &&
              'Notification' in window &&
              Notification.permission === 'granted'
            ) {
              try {
                const options = {
                  body: preview,
                  tag: `wa:${row.chat_id}`,
                  renotify: true,
                } as NotificationOptions & { renotify?: boolean };
                const n = new Notification(`WhatsApp · ${displayName}`, options);
                n.onclick = () => {
                  window.focus();
                  navigateRef.current(
                    `/whatsapp?phone=${encodeURIComponent(row.chat_id)}`,
                  );
                  n.close();
                };
              } catch {
                // Algunos navegadores rechazan opciones como renotify
              }
            }
          },
        )
        .subscribe();
      entry = { refCount: 0, channel };
      channelsByCompany.set(companyId, entry);
    }

    entry.refCount += 1;

    return () => {
      const current = channelsByCompany.get(companyId);
      if (!current) return;
      current.refCount -= 1;
      if (current.refCount <= 0) {
        supabase.removeChannel(current.channel);
        channelsByCompany.delete(companyId);
      }
    };
  }, [companyId, loading, canNotify, onWhatsappRoute]);
};

