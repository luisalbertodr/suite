import React, { useEffect, useMemo, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { RefreshCw, MoreVertical, UserCheck, UserPlus, Link as LinkIcon } from 'lucide-react';
import { WhatsappAvatar } from './WhatsappAvatar';
import { WhatsappMessageBubble } from './WhatsappMessageBubble';
import { WhatsappMessageInput } from './WhatsappMessageInput';
import { WhatsappLinkPopover } from './WhatsappLinkPopover';
import {
  useWhatsappMessages,
  type WhatsappMessageRow,
  type SendMessageInput,
} from '@/hooks/useWhatsappMessages';
import { useToast } from '@/hooks/use-toast';
import { dayKey, formatDateHeader, isGroupJid, jidToDisplay } from './whatsappUtils';
import type { WhatsappChatRow } from '@/hooks/useWhatsappChats';

interface Props {
  chat: WhatsappChatRow;
  customerName?: string;
  leadName?: string;
  onMarkRead?: (chatId: string) => void;
}

export const WhatsappChatView: React.FC<Props> = ({
  chat,
  customerName,
  leadName,
  onMarkRead,
}) => {
  const { toast } = useToast();
  const {
    messages,
    isLoading,
    refreshFromWaha,
    sendMessage,
  } = useWhatsappMessages(chat.chat_id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Cuando entramos al chat, marcamos como leído y pedimos mensajes frescos.
  useEffect(() => {
    if (!chat.chat_id) return;
    if ((chat.unread_count ?? 0) > 0) onMarkRead?.(chat.chat_id);
    // Trae mensajes frescos al abrir el chat (refresh silencioso)
    refreshFromWaha.mutate(undefined, { onError: () => undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.chat_id]);

  // Auto-scroll al final cuando llegan mensajes
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' });
  }, [messages.length]);

  const grouped = useMemo(() => {
    const out: Array<{ day: string; iso: string; messages: WhatsappMessageRow[] }> = [];
    for (const m of messages) {
      const k = dayKey(m.timestamp);
      const last = out[out.length - 1];
      if (last && last.day === k) {
        last.messages.push(m);
      } else {
        out.push({ day: k, iso: m.timestamp, messages: [m] });
      }
    }
    return out;
  }, [messages]);

  const onSend = async (input: SendMessageInput) => {
    try {
      const real = { ...input, chat_id: chat.chat_id } as SendMessageInput;
      await sendMessage.mutateAsync(real);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo enviar';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
      throw e;
    }
  };

  const displayName = chat.name ?? jidToDisplay(chat.chat_id);
  const isGroup = chat.is_group || isGroupJid(chat.chat_id);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22 fill=%22none%22><circle cx=%2260%22 cy=%2260%22 r=%221%22 fill=%22%23000%22 opacity=%220.05%22/></svg>')] bg-[#efeae2] dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-2 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex min-w-0 items-center gap-3">
          <WhatsappAvatar
            name={displayName}
            pictureUrl={chat.profile_picture_url}
            isGroup={isGroup}
            className="h-10 w-10"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {displayName}
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span className="truncate" title={chat.chat_id}>
                {isGroup
                  ? `Grupo · ${jidToDisplay(chat.chat_id)}`
                  : jidToDisplay(chat.chat_id)}
              </span>
              {customerName ? (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <UserCheck className="h-3 w-3" /> {customerName}
                </span>
              ) : leadName ? (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                  <UserPlus className="h-3 w-3" /> {leadName}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <WhatsappLinkPopover
            chat={chat}
            customerName={customerName}
            leadName={leadName}
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              title="Vincular con cliente o lead"
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
          </WhatsappLinkPopover>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => refreshFromWaha.mutate()}
            disabled={refreshFromWaha.isPending}
            title="Recargar mensajes"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshFromWaha.isPending ? 'animate-spin' : ''}`}
            />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            title="Más opciones"
            disabled
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1">
        <ScrollArea className="h-full">
          <div className="space-y-2 px-4 py-4">
            {isLoading && messages.length === 0 ? (
              <p className="py-10 text-center text-xs text-muted-foreground">
                Cargando mensajes…
              </p>
            ) : grouped.length === 0 ? (
              <p className="py-10 text-center text-xs text-muted-foreground">
                Aún no hay mensajes en esta conversación.
              </p>
            ) : (
              grouped.map((g) => (
                <div key={g.day} className="space-y-1">
                  <div className="my-3 flex justify-center">
                    <span className="rounded-md bg-white/80 px-2 py-0.5 text-[11px] font-medium text-zinc-600 shadow-sm dark:bg-zinc-800 dark:text-zinc-300">
                      {formatDateHeader(g.iso)}
                    </span>
                  </div>
                  {g.messages.map((m) => (
                    <WhatsappMessageBubble
                      key={m.id}
                      message={m}
                      isGroupChat={isGroup}
                    />
                  ))}
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>
        </ScrollArea>
      </div>

      <WhatsappMessageInput
        sending={sendMessage.isPending}
        onSend={onSend}
      />
    </div>
  );
};
