import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { RefreshCw, MoreVertical, UserCheck, UserPlus, Link as LinkIcon, Megaphone, ArrowLeft } from 'lucide-react';
import { WhatsappAvatar } from './WhatsappAvatar';
import { WhatsappMessageBubble } from './WhatsappMessageBubble';
import { WhatsappMessageInput } from './WhatsappMessageInput';
import { WhatsappForwardDialog } from './WhatsappForwardDialog';
import { WhatsappLinkPopover } from './WhatsappLinkPopover';
import { WhatsappSendDepositLinkButton } from './WhatsappSendDepositLinkButton';
import { WhatsappSendCampaignAudioButton } from './WhatsappSendCampaignAudioButton';
import { WhatsappSendNotesButton } from './WhatsappSendNotesButton';
import { WhatsappConfirmDepositPaidButton } from './WhatsappConfirmDepositPaidButton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  useWhatsappMessages,
  type WhatsappMessageRow,
  type SendMessageInput,
} from '@/hooks/useWhatsappMessages';
import { useToast } from '@/hooks/use-toast';
import { useWhatsappCompanyId } from '@/hooks/useWhatsappCompanyId';
import { useWhatsappAutomationSettings } from '@/hooks/useWhatsappAutomationSettings';
import {
  firstUnreadMessageId,
  groupMessagesByDay,
  formatDateHeader,
  unreadMessageIdsFromCount,
  formatMetaLeadLabel,
  displayNameForChat,
  findMessageByWahaId,
  buildGroupSenderDirectory,
  isGroupJid,
  isLidJid,
  isSystemChatJid,
  isRecentMetaLead,
  jidToDisplay,
  jidsSameContact,
  isPhoneJid,
  isWhatsappTestChatId,
  resolveGroupSenderJidFromRaw,
  resolvePhoneLabelForChat,
  customerProfilePath,
  type MetaLeadInfo,
} from './whatsappUtils';
import { useWhatsappTheme } from './WhatsappThemeContext';
import { WhatsappChatProvider } from './WhatsappChatContext';
import type { WhatsappChatRow } from '@/hooks/useWhatsappChats';
import { useWhatsappMediaPrefetch } from '@/hooks/useWhatsappMediaPrefetch';
import { useRoutePanelActive } from '@/contexts/RoutePanelContext';

interface Props {
  chats: WhatsappChatRow[];
  chat: WhatsappChatRow;
  customerName?: string;
  resolvedCustomerId?: string | null;
  isLinkedCustomer?: boolean;
  leadName?: string;
  leadMeta?: MetaLeadInfo;
  /** Lead CRM vinculado (puede venir del chat o del deep link desde Marketing). */
  marketingLeadId?: string | null;
  leadNameById?: Record<string, string>;
  phoneLabelByChatId?: Record<string, string>;
  onMarkRead?: (chatId: string) => void;
  onBack?: () => void;
  onCreateCustomer?: () => void;
}

export const WhatsappChatView: React.FC<Props> = ({
  chats,
  chat,
  customerName,
  resolvedCustomerId,
  isLinkedCustomer,
  leadName,
  leadMeta,
  marketingLeadId,
  leadNameById = {},
  phoneLabelByChatId = {},
  onMarkRead,
  onBack,
  onCreateCustomer,
}) => {
  const theme = useWhatsappTheme();
  const { toast } = useToast();
  const { companyId, loading: companyLoading } = useWhatsappCompanyId();
  const { data: waAutomationSettings } = useWhatsappAutomationSettings();
  const relatedChatIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of chats) {
      if (isSystemChatJid(c.chat_id)) continue;
      if (c.chat_id === chat.chat_id) continue;
      if (jidsSameContact(c.chat_id, chat.chat_id)) ids.add(c.chat_id);
      if (
        chat.customer_id &&
        c.customer_id &&
        c.customer_id === chat.customer_id &&
        (jidsSameContact(c.chat_id, chat.chat_id) || isPhoneJid(c.chat_id) || isPhoneJid(chat.chat_id))
      ) {
        ids.add(c.chat_id);
      }
    }
    return Array.from(ids);
  }, [chats, chat.chat_id, chat.customer_id]);
  const {
    messages,
    isLoading,
    isError,
    error,
    isSyncingHistory,
    refreshFromWaha,
    sendMessage,
    forwardMessage,
    deleteMessage,
  } = useWhatsappMessages(chat.chat_id, relatedChatIds, {
    historySyncedAt: chat.history_synced_at,
    lastMessageAt: chat.last_message_at,
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const firstUnreadDividerRef = useRef<HTMLDivElement>(null);
  const [sessionUnreadCount, setSessionUnreadCount] = useState(0);
  const [replyTo, setReplyTo] = useState<WhatsappMessageRow | null>(null);
  const [forwardMessageRow, setForwardMessageRow] = useState<WhatsappMessageRow | null>(null);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WhatsappMessageRow | null>(null);

  useEffect(() => {
    setReplyTo(null);
    setForwardMessageRow(null);
    setForwardOpen(false);
    setDeleteTarget(null);
    setSessionUnreadCount(chat.unread_count ?? 0);
  }, [chat.chat_id]);

  // Cuando entramos al chat, marcamos como leído (la sync la gestiona useWhatsappMessages).
  const markReadAttemptedRef = useRef<string | null>(null);
  useEffect(() => {
    markReadAttemptedRef.current = null;
  }, [chat.chat_id]);

  useEffect(() => {
    if (!chat.chat_id || companyLoading || !companyId) return;
    if ((chat.unread_count ?? 0) <= 0) return;
    if (markReadAttemptedRef.current === chat.chat_id) return;
    markReadAttemptedRef.current = chat.chat_id;
    onMarkRead?.(chat.chat_id);
  }, [chat.chat_id, chat.unread_count, companyId, companyLoading, onMarkRead]);

  // Auto-scroll al final cuando llegan mensajes
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages.length]);

  const unreadMessageIds = useMemo(
    () => unreadMessageIdsFromCount(messages, sessionUnreadCount),
    [messages, sessionUnreadCount, chat.chat_id],
  );
  const firstUnreadId = useMemo(
    () => firstUnreadMessageId(messages, sessionUnreadCount),
    [messages, sessionUnreadCount, chat.chat_id],
  );

  useEffect(() => {
    if (sessionUnreadCount <= 0 || !firstUnreadDividerRef.current) return;
    const t = window.setTimeout(() => {
      firstUnreadDividerRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 120);
    return () => window.clearTimeout(t);
  }, [chat.chat_id, firstUnreadId, sessionUnreadCount]);

  const grouped = useMemo(() => groupMessagesByDay(messages), [messages]);

  const onSend = async (input: SendMessageInput) => {
    try {
      const real = { ...input, chat_id: chat.chat_id } as SendMessageInput;
      await sendMessage.mutateAsync(real);
      setReplyTo(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo enviar';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
      throw e;
    }
  };

  const handleDeleteForEveryone = async () => {
    if (!deleteTarget?.waha_message_id) return;
    try {
      await deleteMessage.mutateAsync({
        chat_id: chat.chat_id,
        message_id: deleteTarget.waha_message_id,
      });
      toast({ title: 'Mensaje eliminado para todos' });
      setDeleteTarget(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo eliminar el mensaje';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  const handleForward = async (destinationChatId: string) => {
    if (!forwardMessageRow?.waha_message_id) {
      toast({
        title: 'No se puede reenviar',
        description: 'Este mensaje no tiene identificador de Waha.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await forwardMessage.mutateAsync({
        chat_id: destinationChatId,
        message_id: forwardMessageRow.waha_message_id,
      });
      toast({ title: 'Mensaje reenviado' });
      setForwardMessageRow(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo reenviar';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
      throw e;
    }
  };

  const displayName = displayNameForChat(
    chat.chat_id,
    chat.name,
    leadName ?? customerName,
    chat.raw,
  );
  const isGroup = chat.is_group || isGroupJid(chat.chat_id);
  const isTestWaChat = isWhatsappTestChatId(chat.chat_id, waAutomationSettings);
  const effectiveCustomerId =
    isTestWaChat ? (chat.customer_id ?? null) : (chat.customer_id ?? resolvedCustomerId ?? null);
  /** Nombre CRM; en chat de prueba no usar el cliente detectado por teléfono (Luis A.). */
  const crmContactName = isTestWaChat
    ? (leadName ?? null)
    : (customerName ?? leadName ?? null);
  const effectiveMarketingLeadId = marketingLeadId ?? chat.marketing_lead_id;
  const showDepositActions =
    !isGroup &&
    !isSystemChatJid(chat.chat_id) &&
    (!isTestWaChat || effectiveMarketingLeadId);
  const showCampaignAudio = !isGroup && !isSystemChatJid(chat.chat_id);

  const relatedPhoneChatIds = useMemo(() => {
    const ids: string[] = [];
    for (const c of chats) {
      if (c.chat_id === chat.chat_id) continue;
      if (jidsSameContact(c.chat_id, chat.chat_id)) ids.push(c.chat_id);
      if (
        chat.customer_id &&
        c.customer_id === chat.customer_id &&
        (isPhoneJid(c.chat_id) || jidsSameContact(c.chat_id, chat.chat_id))
      ) {
        ids.push(c.chat_id);
      }
    }
    return ids;
  }, [chats, chat.chat_id, chat.customer_id]);

  const messageFromJids = useMemo(
    () =>
      messages
        .filter((m) => !m.from_me)
        .map((m) => resolveGroupSenderJidFromRaw(m.raw, m.from_jid) ?? m.from_jid),
    [messages],
  );

  const phoneLabel = useMemo(() => {
    if (isGroup) return '';
    return (
      resolvePhoneLabelForChat(chat.chat_id, {
        relatedChatIds: relatedPhoneChatIds,
        messageFromJids,
      }) ||
      phoneLabelByChatId[chat.chat_id] ||
      ''
    );
  }, [isGroup, chat.chat_id, relatedPhoneChatIds, messageFromJids, phoneLabelByChatId]);

  const showPhoneInline =
    !!phoneLabel &&
    phoneLabel !== displayName &&
    !displayName.includes(phoneLabel);

  const groupSenderDirectory = useMemo(
    () => (isGroup ? buildGroupSenderDirectory(messages) : {}),
    [isGroup, messages],
  );

  const panelActive = useRoutePanelActive();

  const { loading: prefetchLoading, ready: prefetchReady, getPrefetchMedia } =
    useWhatsappMediaPrefetch(chat.chat_id, relatedChatIds, messages, { enabled: panelActive });

  const isCustomer = isLinkedCustomer ?? !!effectiveCustomerId;

  return (
    <WhatsappChatProvider
      activeChatId={chat.chat_id}
      relatedChatIds={relatedChatIds}
      scrollRootRef={scrollRef}
      prefetchLoading={prefetchLoading}
      prefetchReady={prefetchReady}
      panelActive={panelActive}
      getPrefetchMedia={getPrefetchMedia}
    >
    <div className="relative z-[1] flex h-full min-h-0 flex-col overflow-hidden">
      <div
        className={`z-10 flex h-[60px] shrink-0 items-center justify-between gap-3 border-b px-4 ${theme.headerBg} ${theme.border}`}
      >
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          {onBack ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 md:hidden"
              onClick={onBack}
              title="Volver a chats"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : null}
          <WhatsappAvatar
            name={displayName}
            pictureUrl={chat.profile_picture_url}
            isGroup={isGroup}
            className="h-10 w-10"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[#111b21] dark:text-zinc-100">
              {effectiveCustomerId ? (
                <Link
                  to={customerProfilePath(effectiveCustomerId)}
                  className="hover:underline"
                  title="Abrir ficha del cliente"
                >
                  {displayName}
                </Link>
              ) : (
                displayName
              )}
              {showPhoneInline ? (
                <span className={`font-normal ${theme.textMuted}`}> · {phoneLabel}</span>
              ) : null}
            </p>
            <div className={`flex flex-wrap items-center gap-1.5 text-xs ${theme.textMuted}`}>
              {!isGroup && showPhoneInline ? null : (
                <span className="truncate" title={chat.chat_id}>
                  {isGroup
                    ? 'Grupo de WhatsApp'
                    : phoneLabel || (isLidJid(chat.chat_id) ? null : jidToDisplay(chat.chat_id))}
                </span>
              )}
              {leadMeta ? (
                <span
                  className={`inline-flex max-w-full items-center gap-0.5 truncate rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    isRecentMetaLead(leadMeta.externalCreatedAt)
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
                      : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                  }`}
                  title={formatMetaLeadLabel(leadMeta)}
                >
                  <Megaphone className="h-3 w-3 shrink-0" />
                  {formatMetaLeadLabel(leadMeta)}
                </span>
              ) : customerName && effectiveCustomerId ? (
                <Link
                  to={customerProfilePath(effectiveCustomerId)}
                  className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900"
                >
                  <UserCheck className="h-3 w-3" /> {customerName}
                </Link>
              ) : leadName ? (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                  <UserPlus className="h-3 w-3" /> {leadName}
                </span>
              ) : !isGroup && !isCustomer && onCreateCustomer ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[10px] text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300"
                  onClick={onCreateCustomer}
                >
                  <UserPlus className="mr-1 h-3 w-3" />
                  Crear cliente
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {showCampaignAudio ? (
            <>
              <WhatsappSendNotesButton
                chatDisplayName={crmContactName ?? displayName}
                customerId={effectiveCustomerId}
                onSendText={async (text) => {
                  await onSend({ type: 'text', text });
                }}
              />
              <WhatsappSendCampaignAudioButton
                chatId={chat.chat_id}
                chatDisplayName={crmContactName ?? displayName}
                marketingLeadId={effectiveMarketingLeadId}
                customerId={effectiveCustomerId}
                leadMeta={leadMeta}
                messages={messages}
                onSent={() => refreshFromWaha.mutate('recent')}
              />
            </>
          ) : null}
          {!isGroup && !isSystemChatJid(chat.chat_id) && showDepositActions ? (
            <>
              <WhatsappSendDepositLinkButton
                chatId={chat.chat_id}
                chatDisplayName={crmContactName ?? displayName}
                marketingLeadId={effectiveMarketingLeadId}
                customerId={effectiveCustomerId}
                depositPaid={!!leadMeta?.stripeDepositPaidAt}
                onSendText={async (text) => {
                  await onSend({ text });
                }}
              />
              <WhatsappConfirmDepositPaidButton
                chatId={chat.chat_id}
                chatDisplayName={crmContactName ?? displayName}
                marketingLeadId={effectiveMarketingLeadId}
                customerId={effectiveCustomerId}
                depositPaid={!!leadMeta?.stripeDepositPaidAt}
              />
            </>
          ) : null}
          <WhatsappLinkPopover
            chat={chat}
            customerName={customerName}
            leadName={leadName}
          >
            <Button
              variant="ghost"
              size="icon"
              className={`h-9 w-9 ${theme.textIcon}`}
              title="Vincular con cliente o lead"
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
          </WhatsappLinkPopover>
          <Button
            variant="ghost"
            size="icon"
            className={`h-9 w-9 ${theme.textIcon}`}
            onClick={() => refreshFromWaha.mutate('full')}
            disabled={refreshFromWaha.isPending}
            title="Recargar historial desde Waha"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshFromWaha.isPending ? 'animate-spin' : ''}`}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-9 w-9 ${theme.textIcon}`}
            title="Más opciones"
            disabled
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch]"
      >
          <div className="flex flex-col space-y-3 p-4 pb-6 sm:p-6">
            {isError && messages.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <p className="text-xs text-destructive">
                  {error?.message ?? 'No se pudieron cargar los mensajes.'}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => refreshFromWaha.mutate('full')}
                >
                  Reintentar
                </Button>
              </div>
            ) : isLoading && messages.length === 0 ? (
              <p className="py-10 text-center text-xs text-muted-foreground">
                {isSyncingHistory
                  ? 'Importando historial desde Waha…'
                  : 'Cargando mensajes…'}
              </p>
            ) : grouped.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <p className="text-xs text-muted-foreground">
                  {isSyncingHistory || refreshFromWaha.isPending
                    ? 'Importando historial desde Waha…'
                    : 'Aún no hay mensajes en esta conversación.'}
                </p>
                {!isSyncingHistory && !refreshFromWaha.isPending && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => refreshFromWaha.mutate('full')}
                  >
                    Importar desde Waha
                  </Button>
                )}
              </div>
            ) : (
              grouped.map((g) => (
                <div key={g.day} className="space-y-1">
                  <div className="my-3 flex justify-center">
                    <span className="rounded-md bg-white/80 px-2 py-0.5 text-[11px] font-medium text-zinc-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
                      {formatDateHeader(g.iso)}
                    </span>
                  </div>
                  {g.messages.map((m) => (
                    <React.Fragment key={m.id}>
                      {m.id === firstUnreadId ? (
                        <div
                          ref={firstUnreadDividerRef}
                          className="my-3 flex justify-center"
                          role="separator"
                          aria-label="Mensajes no leídos"
                        >
                          <span className="rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white shadow-md dark:bg-emerald-500">
                            {sessionUnreadCount === 1
                              ? '1 mensaje no leído'
                              : `${sessionUnreadCount} mensajes no leídos`}
                          </span>
                        </div>
                      ) : null}
                      <WhatsappMessageBubble
                        message={m}
                        isGroupChat={isGroup}
                        senderDirectory={groupSenderDirectory}
                        isUnread={unreadMessageIds.has(m.id)}
                        quotedMessage={
                          m.quoted_message_id
                            ? findMessageByWahaId(messages, m.quoted_message_id)
                            : undefined
                        }
                        onReply={(msg) => setReplyTo(msg)}
                        onForward={(msg) => {
                          setForwardMessageRow(msg);
                          setForwardOpen(true);
                        }}
                        onDeleteForEveryone={(msg) => setDeleteTarget(msg)}
                      />
                    </React.Fragment>
                  ))}
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>
      </div>

      <div className="z-10 shrink-0">
        <WhatsappMessageInput
          sending={sendMessage.isPending}
          replyTo={replyTo}
          onClearReply={() => setReplyTo(null)}
          onSend={onSend}
        />
      </div>

      <WhatsappForwardDialog
        open={forwardOpen}
        onOpenChange={setForwardOpen}
        message={forwardMessageRow}
        chats={chats}
        currentChatId={chat.chat_id}
        leadNameById={leadNameById}
        forwarding={forwardMessage.isPending}
        onForward={handleForward}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar para todos?</AlertDialogTitle>
            <AlertDialogDescription>
              El mensaje se borrará en WhatsApp para todos los participantes del chat.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMessage.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMessage.isPending}
              onClick={(e) => {
                e.preventDefault();
                void handleDeleteForEveryone();
              }}
            >
              {deleteMessage.isPending ? 'Eliminando…' : 'Eliminar para todos'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </WhatsappChatProvider>
  );
};
