import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { MessageCircle, Settings as SettingsIcon } from 'lucide-react';

import { Link, useSearchParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';

import { useWhatsappConfig } from '@/hooks/useWhatsappConfig';

import { useWhatsappChats } from '@/hooks/useWhatsappChats';

import { useWhatsappChatLink } from '@/hooks/useWhatsappChatLink';

import { useWhatsappLinkLookup } from '@/hooks/useWhatsappLinkLookup';

import { useWhatsappCustomerMatch } from '@/hooks/useWhatsappCustomerMatch';

import { useWhatsappAutoRelink } from '@/hooks/useWhatsappAutoRelink';

import { useToast } from '@/hooks/use-toast';

import { WhatsappChatList } from './WhatsappChatList';

import { WhatsappChatView } from './WhatsappChatView';

import { WhatsappSessionPanel } from './WhatsappSessionPanel';

import { WhatsappNewChatDialog } from './WhatsappNewChatDialog';

import { WhatsappCreateCustomerDialog } from './WhatsappCreateCustomerDialog';

import { waTheme, jidsSameContact, jidToDisplay } from './whatsappUtils';

import { WhatsappUiProvider } from './WhatsappThemeContext';

import type { WhatsappChatRow } from '@/hooks/useWhatsappChats';

import './whatsapp.css';



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

  const { toast } = useToast();

  const {

    config,

    isLoading: isConfigLoading,

    sessionStatus,

    configureWebhook,

  } = useWhatsappConfig();

  const { chats, refreshAllFromWaha, refreshFromWaha, markRead } = useWhatsappChats();

  const { ensureChat } = useWhatsappChatLink();

  const { customerNameById, leadNameById, leadMetaById } = useWhatsappLinkLookup(chats);

  const { customerIdByChatId, customerNameByChatId, phoneLabelByChatId } =

    useWhatsappCustomerMatch(chats);

  useWhatsappAutoRelink(chats);



  const resolveCustomerId = (chat: WhatsappChatRow) =>

    chat.customer_id ?? customerIdByChatId[chat.chat_id] ?? null;



  const resolveCustomerName = (chat: WhatsappChatRow) => {

    const id = resolveCustomerId(chat);

    if (!id) return undefined;

    return customerNameById[id] ?? customerNameByChatId[chat.chat_id];

  };

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  const [newChatOpen, setNewChatOpen] = useState(false);

  const [createCustomerChat, setCreateCustomerChat] = useState<WhatsappChatRow | null>(null);

  const [stickyConnected, setStickyConnected] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();

  const phoneParamProcessed = useRef<string | null>(null);

  const webhookFixAttempted = useRef(false);



  const handleMarkRead = useCallback(

    (id: string) => {

      markRead.mutate(id);

    },

    [markRead],

  );



  const handleRefreshFromWaha = useCallback(() => {

    refreshFromWaha.mutate();

  }, [refreshFromWaha]);



  useEffect(() => {

    if (webhookFixAttempted.current) return;

    if (!config?.base_url || !config.webhook_secret) return;

    if ((config.last_status ?? '').toUpperCase() !== 'WORKING') return;

    webhookFixAttempted.current = true;

    const isOpenwa = config.provider === 'openwa';

    sessionStatus.mutate(undefined, {

      onSuccess: (res) => {

        const needsWebhook = isOpenwa

          ? !res.webhooks_configured

          : !res.webhooks_configured || !res.noweb_store_enabled;

        if (!needsWebhook) return;

        configureWebhook.mutate(undefined, {

          onSuccess: () => {

            toast({

              title: 'Recepción de mensajes activada',

              description: isOpenwa

                ? 'Se configuró el webhook en OpenWA. Los mensajes entrantes deberían aparecer ya.'

                : 'Se configuró el webhook en WAHA. Los mensajes entrantes deberían aparecer ya.',

            });

          },

          onError: (e) => {

            toast({

              title: 'Webhook no configurado',

              description:

                e instanceof Error

                  ? e.message

                  : `Ve a Configuración → WhatsApp y pulsa «Aplicar webhook en ${isOpenwa ? 'OpenWA' : 'WAHA'}».`,

              variant: 'destructive',

            });

          },

        });

      },

    });

  }, [config?.base_url, config?.webhook_secret, config?.last_status, config?.provider]); // eslint-disable-line react-hooks/exhaustive-deps



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

          const next = new URLSearchParams(searchParams);

          next.delete('phone');

          next.delete('name');

          setSearchParams(next, { replace: true });

        },

      },

    );

  }, [searchParams, config?.session_name, config?.default_country_code]); // eslint-disable-line react-hooks/exhaustive-deps



  useEffect(() => {

    if (selectedChatId) return;

    if (chats.length === 0) return;

    setSelectedChatId(chats[0].chat_id);

  }, [chats, selectedChatId]);



  useEffect(() => {

    if (!selectedChatId) return;

    if (chats.length === 0) return;

    if (chats.some((c) => c.chat_id === selectedChatId)) return;

    const successor =

      chats.find((c) => jidsSameContact(c.chat_id, selectedChatId)) ?? chats[0];

    if (successor) setSelectedChatId(successor.chat_id);

  }, [chats, selectedChatId]);



  const selectedChat = useMemo(

    () => chats.find((c) => c.chat_id === selectedChatId) ?? null,

    [chats, selectedChatId],

  );



  const statusUpper = (config?.last_status ?? '').toUpperCase();



  useEffect(() => {

    if (!config?.base_url) return;

    sessionStatus.mutate(undefined, { onError: () => undefined });

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, [config?.base_url]);



  useEffect(() => {

    if (statusUpper === 'WORKING' || statusUpper === 'STARTING') setStickyConnected(true);

    if (statusUpper === 'STOPPED' || statusUpper === 'FAILED') setStickyConnected(false);

    if (config?.me_jid && statusUpper !== 'STOPPED' && statusUpper !== 'FAILED') {

      setStickyConnected(true);

    }

  }, [statusUpper, config?.me_jid]);



  const showConnectionPanel = useMemo(() => {

    if (!config) return false;

    if (statusUpper === 'SCAN_QR_CODE') return true;

    if (statusUpper === 'WORKING' || statusUpper === 'STARTING') return false;

    if (chats.length > 0 || config.me_jid) return false;

    if (stickyConnected && statusUpper !== 'STOPPED' && statusUpper !== 'FAILED') return false;

    return true;

  }, [statusUpper, chats.length, config?.me_jid, stickyConnected, config]);



  const showChatOnMobile = !!selectedChat && !showConnectionPanel;



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

          Configura la URL y la API key de tu instancia desde Configuración → WhatsApp

          para empezar a enviar y recibir mensajes.

        </p>

        <Button asChild>

          <Link to="/configuracion?tab=marketing&subtab=whatsapp-conexion">

            <SettingsIcon className="mr-2 h-4 w-4" />

            Ir a configuración

          </Link>

        </Button>

      </div>

    );

  }



  const shell = (

    <div
      className={`flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden border-y md:border-x-0 md:border-y-0 md:border ${waTheme.border} ${waTheme.appBg} dark:bg-zinc-950`}
    >

      <div className="grid h-full min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[minmax(300px,32%)_minmax(0,1fr)]">

        <div className={`min-h-0 h-full ${showChatOnMobile ? 'max-md:hidden' : ''}`}>

          <WhatsappChatList

            chats={chats}

            selectedChatId={selectedChatId}

            onSelect={(id) => setSelectedChatId(id)}

            onRefresh={() => {

              refreshAllFromWaha.mutate(undefined, {

                onSuccess: (res) => {

                  const n = res?.count ?? 0;

                  toast({

                    title: 'Chats actualizados',

                    description:

                      n > 0

                        ? `${n} conversaciones sincronizadas. El historial se importa en segundo plano.`

                        : 'Lista de chats actualizada.',

                  });

                },

                onError: (e) => {

                  toast({

                    title: 'Error al sincronizar',

                    description: e instanceof Error ? e.message : 'Inténtalo de nuevo.',

                    variant: 'destructive',

                  });

                },

              });

            }}

            isRefreshing={refreshAllFromWaha.isPending}

            onStartNew={() => setNewChatOpen(true)}

            onCreateCustomer={(chat) => setCreateCustomerChat(chat)}

            customerNameById={customerNameById}

            customerIdByChatId={customerIdByChatId}

            customerNameByChatId={customerNameByChatId}

            phoneLabelByChatId={phoneLabelByChatId}

            leadNameById={leadNameById}

            leadMetaById={leadMetaById}

            sessionPushName={config.me_pushname}

            sessionStatus={config.last_status}

            sessionPhone={jidToDisplay(config.me_jid)}

          />

        </div>

        <div

          className={`wa-chat-panel flex h-full min-h-0 flex-col overflow-hidden ${showChatOnMobile ? '' : 'max-md:hidden'}`}

        >

          {showConnectionPanel ? (

            <WhatsappSessionPanel

              config={config}

              onConnected={handleRefreshFromWaha}

            />

          ) : selectedChat ? (

            <WhatsappChatView

              chats={chats}

              chat={selectedChat}

              customerName={resolveCustomerName(selectedChat)}

              resolvedCustomerId={resolveCustomerId(selectedChat)}

              isLinkedCustomer={!!resolveCustomerId(selectedChat)}

              leadName={

                selectedChat.marketing_lead_id

                  ? leadNameById[selectedChat.marketing_lead_id]

                  : undefined

              }

              leadMeta={

                selectedChat.marketing_lead_id

                  ? leadMetaById[selectedChat.marketing_lead_id]

                  : undefined

              }

              leadNameById={leadNameById}

              phoneLabelByChatId={phoneLabelByChatId}

              onMarkRead={handleMarkRead}

              onBack={() => setSelectedChatId(null)}

              onCreateCustomer={

                resolveCustomerId(selectedChat)

                  ? undefined

                  : () => setCreateCustomerChat(selectedChat)

              }

            />

          ) : (

            <div className="flex h-full items-center justify-center">

              <div className="max-w-sm text-center">

                <MessageCircle className="mx-auto mb-3 h-12 w-12 text-emerald-500" />

                <h3 className="text-lg font-semibold">Selecciona un chat</h3>

                <p className="text-sm text-muted-foreground">

                  Elige una conversación de la lista o empieza una nueva con el botón ＋.

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

        <WhatsappCreateCustomerDialog

          chat={createCustomerChat}

          leadName={

            createCustomerChat?.marketing_lead_id

              ? leadNameById[createCustomerChat.marketing_lead_id]

              : undefined

          }

          leadMeta={

            createCustomerChat?.marketing_lead_id

              ? leadMetaById[createCustomerChat.marketing_lead_id]

              : undefined

          }

          open={!!createCustomerChat}

          onOpenChange={(open) => {

            if (!open) setCreateCustomerChat(null);

          }}

        />

      </div>

    </div>

  );



  return <WhatsappUiProvider>{shell}</WhatsappUiProvider>;

};


