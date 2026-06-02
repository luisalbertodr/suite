import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { getStoredWhatsappCompanyId, useWhatsappCompanyId } from '@/hooks/useWhatsappCompanyId';
import type { Database } from '@/integrations/supabase/types';

export type WhatsappConfigRow = Database['public']['Tables']['whatsapp_config']['Row'];
export type WhatsappConfigUpdate = Database['public']['Tables']['whatsapp_config']['Update'];

export type WhatsappProxyAction = {
  company_id?: string;
} & (
  | { action: 'session.status' }
  | { action: 'session.start' }
  | { action: 'session.stop' }
  | { action: 'session.logout' }
  | { action: 'session.qr' }
  | { action: 'session.configure_webhook'; webhook_url?: string }
  | { action: 'system.ping' }
  | { action: 'chats.list'; limit?: number; offset?: number }
  | {
      action: 'messages.list';
      chat_id: string;
      limit?: number;
      offset?: number;
      download_media?: boolean;
    }
  | {
      action: 'messages.sync_chat_history';
      chat_id: string;
      force?: boolean;
      offset?: number;
      download_media?: boolean;
    }
  | {
      action: 'messages.sync_history';
      limit_per_chat?: number;
      max_chats?: number;
      offset?: number;
      message_offset?: number;
      refresh_chats?: boolean;
      download_media?: boolean;
    }
  | {
      action: 'messages.send';
      chat_id: string;
      type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'voice';
      text?: string;
      caption?: string;
      media_base64?: string;
      mime_type?: string;
      filename?: string;
      reply_to_message_id?: string;
    }
  | { action: 'messages.forward'; chat_id: string; message_id: string }
  | { action: 'messages.delete'; chat_id: string; message_id: string }
  | { action: 'chat.mark_read'; chat_id: string }
  | { action: 'chat.ensure'; chat_id: string; name?: string | null }
  | {
      action: 'chat.set_link';
      chat_id: string;
      customer_id?: string | null;
      marketing_lead_id?: string | null;
    }
  | { action: 'chat.search_link'; q: string; limit?: number }
  | { action: 'pictures.sync_batch'; chat_ids?: string[]; limit?: number }
  | { action: 'groups.sync_name'; chat_id: string }
  | { action: 'media.download'; url?: string; chat_id?: string; message_id?: string }
  | { action: 'data.purge'; logout_waha?: boolean }
);

export async function invokeWhatsappProxy<T = unknown>(
  payload: WhatsappProxyAction,
): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No hay sesión activa');

  const whatsappCompanyId = getStoredWhatsappCompanyId();
  const requestBody: WhatsappProxyAction =
    payload.company_id || !whatsappCompanyId
      ? payload
      : { ...payload, company_id: whatsappCompanyId };

  // Usamos fetch directo en lugar de supabase.functions.invoke para no perder
  // el cuerpo de la respuesta en códigos 4xx/5xx (algunas versiones de
  // supabase-js solo exponen el mensaje y descartan el body JSON).
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
  if (!url) throw new Error('Falta VITE_SUPABASE_URL');
  const endpoint = `${url.replace(/\/+$/, '')}/functions/v1/whatsapp-proxy`;

  let res: Response;
  try {
    res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey:
          (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '',
      },
      body: JSON.stringify(requestBody),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error de red';
    throw new Error(`No se pudo contactar con WhatsApp: ${msg}`);
  }

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const serverMessage =
      (body && typeof body === 'object' && 'error' in body
        ? String((body as { error?: unknown }).error)
        : typeof body === 'string' && body.length > 0
          ? body
          : `HTTP ${res.status}`) || `HTTP ${res.status}`;
    // Logueamos para diagnóstico: en consola veremos el motivo aunque no
    // hayamos visto el toast.
    console.error(
      `[whatsapp-proxy] ${payload.action} → ${res.status}:`,
      serverMessage,
    );
    throw new Error(serverMessage);
  }
  return body as T;
}

/** Descarga binarios (stickers, imágenes…) vía whatsapp-proxy → Waha. */
export async function downloadWhatsappMedia(input: {
  url?: string | null;
  chat_id?: string;
  message_id?: string | null;
  company_id?: string;
}): Promise<Blob> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('No hay sesión activa');

  const storedCompanyId = sessionStorage.getItem('current_company_id');
  const payload = {
    action: 'media.download' as const,
    url: input.url ?? undefined,
    chat_id: input.chat_id,
    message_id: input.message_id ?? undefined,
    company_id: input.company_id ?? storedCompanyId ?? undefined,
  };

  const baseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
  if (!baseUrl) throw new Error('Falta VITE_SUPABASE_URL');
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/functions/v1/whatsapp-proxy`;

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
      apikey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    let msg = text;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      // ignore
    }
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return res.blob();
}

const DEFAULTS: Omit<WhatsappConfigUpdate, 'company_id'> = {
  base_url: null,
  api_key: null,
  session_name: 'default',
  webhook_secret: null,
  default_country_code: '34',
  enabled: true,
};

export const useWhatsappConfig = () => {
  const queryClient = useQueryClient();
  const { companyId, loading: companyLoading } = useWhatsappCompanyId();

  const configQuery = useQuery({
    queryKey: ['whatsapp-config', companyId],
    enabled: !!companyId && !companyLoading,
    queryFn: async (): Promise<WhatsappConfigRow | null> => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from('whatsapp_config')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['whatsapp-config', companyId] });

  // Realtime: cuando llegue una actualización del estado / QR vía webhook.
  // Usamos un id único por hook para que dos montajes simultáneos del mismo
  // hook NO compartan el mismo Channel (evita el error "cannot add
  // postgres_changes callbacks ... after subscribe()").
  const channelIdRef = useRef<string>('');
  if (!channelIdRef.current) {
    channelIdRef.current = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  }
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`whatsapp_config:${companyId}:${channelIdRef.current}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'whatsapp_config',
          filter: `company_id=eq.${companyId}`,
        },
        () => {
          invalidate();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId]); // eslint-disable-line react-hooks/exhaustive-deps

  const upsertConfig = useMutation({
    mutationFn: async (values: Omit<WhatsappConfigUpdate, 'company_id'>) => {
      if (!companyId) throw new Error('Sin empresa');
      const row = {
        ...DEFAULTS,
        ...values,
        company_id: companyId,
      };
      const { data, error } = await supabase
        .from('whatsapp_config')
        .upsert(row, { onConflict: 'company_id' })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const sessionStatus = useMutation({
    mutationFn: async () =>
      invokeWhatsappProxy<{
        ok: boolean;
        status?: string;
        me?: unknown;
        error?: string;
        webhooks_configured?: boolean;
        noweb_store_enabled?: boolean;
      }>({
        action: 'session.status',
      }),
    onSuccess: invalidate,
  });

  const sessionStart = useMutation({
    mutationFn: async () => invokeWhatsappProxy<{ ok: boolean }>({ action: 'session.start' }),
    onSuccess: invalidate,
  });

  const sessionStop = useMutation({
    mutationFn: async () => invokeWhatsappProxy<{ ok: boolean }>({ action: 'session.stop' }),
    onSuccess: invalidate,
  });

  const sessionLogout = useMutation({
    mutationFn: async () => invokeWhatsappProxy<{ ok: boolean }>({ action: 'session.logout' }),
    onSuccess: invalidate,
  });

  const fetchQr = useMutation({
    mutationFn: async () =>
      invokeWhatsappProxy<{ ok: boolean; qr_data_url?: string }>({ action: 'session.qr' }),
    onSuccess: invalidate,
  });

  const configureWebhook = useMutation({
    mutationFn: async (input?: { webhook_url?: string }) =>
      invokeWhatsappProxy<{
        ok: boolean;
        webhook_url: string;
        events: string[];
        webhooks_configured?: boolean;
        noweb_store_enabled?: boolean;
      }>({
        action: 'session.configure_webhook',
        ...(input?.webhook_url ? { webhook_url: input.webhook_url } : {}),
      }),
    onSuccess: invalidate,
  });

  type PingDiagnostics = {
    base_url: string;
    session_name: string;
    public_ok: boolean;
    public_status?: number;
    public_error?: string;
    public_body_snippet?: string;
    auth_ok: boolean;
    auth_status?: number;
    auth_error?: string;
    auth_server?: string;
    auth_www_auth?: string;
    sessions?: Array<{ name?: string; status?: string }>;
    session_in_list?: boolean;
  };

  const ping = useMutation({
    mutationFn: async () =>
      invokeWhatsappProxy<{ ok: boolean; diagnostics: PingDiagnostics }>({
        action: 'system.ping',
      }),
  });

  const purgeHistory = useMutation({
    mutationFn: async (logoutWaha = true) =>
      invokeWhatsappProxy<{
        ok: boolean;
        messages_deleted: number;
        chats_deleted: number;
        avatars_removed: number;
      }>({
        action: 'data.purge',
        logout_waha: logoutWaha,
      }),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chats'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-messages'] });
    },
  });

  return {
    config: configQuery.data ?? null,
    isLoading: configQuery.isLoading,
    isError: configQuery.isError,
    error: configQuery.error as Error | null,
    refetch: configQuery.refetch,
    upsertConfig,
    sessionStatus,
    sessionStart,
    sessionStop,
    sessionLogout,
    fetchQr,
    configureWebhook,
    ping,
    purgeHistory,
  };
};
