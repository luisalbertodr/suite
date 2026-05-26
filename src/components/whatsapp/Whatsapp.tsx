import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, Settings as SettingsIcon } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useWhatsappConfig } from '@/hooks/useWhatsappConfig';
import { useWhatsappChats } from '@/hooks/useWhatsappChats';
import { useWhatsappChatLink } from '@/hooks/useWhatsappChatLink';
import { useWhatsappLinkLookup } from '@/hooks/useWhatsappLinkLookup';
import { WhatsappChatList } from './WhatsappChatList';
import { WhatsappChatView } from './WhatsappChatView';
import { WhatsappSessionGate } from './WhatsappSessionGate';
import { WhatsappNewChatDialog } from './WhatsappNewChatDialog';

function normalizePhoneToJid(
  raw: string,
  defaultCountryCode: string | null | undefined,
): string {
  let s = raw.trim();
  if (!s) return s;
  if (s.includes('@')) return s;
  s = s.replace(/[^0-9]/g, '');
  if (!s) return raw;
  if (defaultCountryCode && s.length <= 9) s = `${defaultCountryCode}${s}`;
  return `${s}@c.us`;
}

export const Whatsapp: React.FC = () => {
  const { config, isLoading: isConfigLoading } = useWhatsappConfig();
  const { chats, refreshFromWaha, markRead } = useWhatsappChats();
  const { ensureChat } = useWhatsappChatLink();
  const { customerNameById, leadNameById } = useWhatsappLinkLookup(chats);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const phoneParamProcessed = useRef<string | null>(null);

  // Soporte de ?phone=... (&name=...) para abrir un chat concreto desde otras
  // pestañas (cliente, lead de marketing…).
  useEffect(() => {
    if (!config?.session_name) return;
    const phone = searchParams.get('phone');
    if (!phone) return;
    const key = `${phone}|${searchParams.get('name') ?? ''}`;
    if (phoneParamProcessed.current === key) return;
    phoneParamProcessed.current = key;
    const jid = normalizePhoneToJid(phone, config?.default_country_code);
    if (!jid) return;
    const name = searchParams.get('name');
    ensureChat.mutate(
      { chat_id: jid, name: name || null },
      {
        onSuccess: (res) => {
          const finalJid = res.chat_id ?? jid;
          setSelectedChatId(finalJid);
          // Limpia los params para no re-abrir el chat al refrescar
          const next = new URLSearchParams(searchParams);
          next.delete('phone');
          next.delete('name');
          setSearchParams(next, { replace: true });
        },
      },
    );
  }, [searchParams, config?.session_name, config?.default_country_code]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-selecciona el primer chat con mensajes recientes la primera vez.
  useEffect(() => {
    if (selectedChatId) return;
    if (chats.length === 0) return;
    setSelectedChatId(chats[0].chat_id);
  }, [chats, selectedChatId]);

  // Si el chat seleccionado fue "migrado" en el backend (p.ej. de @c.us a @lid
  // después de enviar el primer mensaje), nos quedamos huérfanos: detectamos
  // que ya no existe la fila con ese chat_id y buscamos la "sucesora" que
  // comparte número de teléfono.
  useEffect(() => {
    if (!selectedChatId) return;
    if (chats.length === 0) return;
    if (chats.some((c) => c.chat_id === selectedChatId)) return;
    // El chat seleccionado ya no existe. Intentamos encontrar un chat nuevo
    // recién creado (last_message_at más reciente) que pueda ser su sucesor.
    const candidate = chats[0];
    if (candidate) setSelectedChatId(candidate.chat_id);
  }, [chats, selectedChatId]);

  const selectedChat = useMemo(
    () => chats.find((c) => c.chat_id === selectedChatId) ?? null,
    [chats, selectedChatId],
  );

  if (isConfigLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (!config || !config.base_url) {
    return (
      <div className="mx-auto flex h-[70vh] max-w-md flex-col items-center justify-center gap-3 text-center">
        <MessageCircle className="h-12 w-12 text-emerald-500" />
        <h2 className="text-lg font-semibold">WhatsApp aún no está configurado</h2>
        <p className="text-sm text-muted-foreground">
          Configura la URL y la API key de tu instancia de Waha desde la
          pestaña de Configuración → WhatsApp para empezar a enviar y recibir
          mensajes.
        </p>
        <Button asChild>
          <Link to="/configuracion?tab=whatsapp">
            <SettingsIcon className="mr-2 h-4 w-4" />
            Ir a configuración
          </Link>
        </Button>
      </div>
    );
  }

  const isConnected = (config.last_status ?? '').toUpperCase() === 'WORKING';

  return (
    <div className="mx-auto h-[calc(100vh-9rem)] max-w-[1400px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      {isConnected ? (
        <div className="grid h-full grid-cols-[minmax(280px,360px)_1fr]">
          <WhatsappChatList
            chats={chats}
            selectedChatId={selectedChatId}
            onSelect={(id) => setSelectedChatId(id)}
            onRefresh={() => refreshFromWaha.mutate()}
            isRefreshing={refreshFromWaha.isPending}
            onStartNew={() => setNewChatOpen(true)}
            customerNameById={customerNameById}
            leadNameById={leadNameById}
          />
          <div className="min-h-0">
            {selectedChat ? (
              <WhatsappChatView
                chat={selectedChat}
                customerName={
                  selectedChat.customer_id
                    ? customerNameById[selectedChat.customer_id]
                    : undefined
                }
                leadName={
                  selectedChat.marketing_lead_id
                    ? leadNameById[selectedChat.marketing_lead_id]
                    : undefined
                }
                onMarkRead={(id) => markRead.mutate(id)}
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-[#efeae2] dark:bg-zinc-900">
                <div className="max-w-sm text-center">
                  <MessageCircle className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
                  <h3 className="text-lg font-semibold">Selecciona un chat</h3>
                  <p className="text-sm text-muted-foreground">
                    Elige una conversación de la lista o empieza una nueva con
                    el botón
                    <span className="mx-1 inline-block align-middle">
                      <span className="rounded bg-zinc-100 px-1 py-0.5 text-xs dark:bg-zinc-800">
                        ＋
                      </span>
                    </span>
                    de arriba.
                  </p>
                </div>
              </div>
            )}
          </div>
          <WhatsappNewChatDialog
            open={newChatOpen}
            onOpenChange={setNewChatOpen}
            defaultCountryCode={config.default_country_code}
            onCreated={(jid) => {
              setSelectedChatId(jid);
              refreshFromWaha.mutate();
            }}
          />
        </div>
      ) : (
        <WhatsappSessionGate
          config={config}
          onConnected={() => refreshFromWaha.mutate()}
        />
      )}
    </div>
  );
};
