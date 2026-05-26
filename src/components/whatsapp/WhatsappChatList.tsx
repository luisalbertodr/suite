import React, { useMemo, useState } from 'react';
import { Search, RefreshCw, MessageSquarePlus, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WhatsappAvatar } from './WhatsappAvatar';
import {
  formatChatListTime,
  isGroupJid,
  jidToDisplay,
} from './whatsappUtils';
import { Check, CheckCheck, UserCheck, UserPlus } from 'lucide-react';
import type { WhatsappChatRow } from '@/hooks/useWhatsappChats';

interface Props {
  chats: WhatsappChatRow[];
  selectedChatId: string | null;
  onSelect: (chatId: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onStartNew: () => void;
  customerNameById?: Record<string, string>;
  leadNameById?: Record<string, string>;
}

export const WhatsappChatList: React.FC<Props> = ({
  chats,
  selectedChatId,
  onSelect,
  onRefresh,
  isRefreshing,
  onStartNew,
  customerNameById,
  leadNameById,
}) => {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return chats;
    return chats.filter((c) => {
      const haystack = [c.name ?? '', jidToDisplay(c.chat_id), c.last_message_preview ?? '']
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [chats, search]);

  return (
    <div className="flex h-full flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">Chats</h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onStartNew}
            title="Nuevo chat"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Sincronizar con Waha"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar o empezar nuevo chat"
            className="h-9 rounded-full bg-zinc-100 pl-9 text-sm dark:bg-zinc-900"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <ul className="px-1 pb-2">
          {filtered.length === 0 ? (
            <li className="px-4 py-10 text-center text-xs text-muted-foreground">
              {chats.length === 0
                ? 'No hay chats todavía. Pulsa el botón de sincronizar para traerlos desde WhatsApp.'
                : 'No hay resultados.'}
            </li>
          ) : (
            filtered.map((c) => {
              const isActive = c.chat_id === selectedChatId;
              const isGroup = c.is_group || isGroupJid(c.chat_id);
              const customerName = c.customer_id
                ? customerNameById?.[c.customer_id]
                : undefined;
              const leadName = c.marketing_lead_id
                ? leadNameById?.[c.marketing_lead_id]
                : undefined;
              const displayName =
                customerName || c.name || leadName || jidToDisplay(c.chat_id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.chat_id)}
                    className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition ${
                      isActive
                        ? 'bg-zinc-100 dark:bg-zinc-800'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'
                    }`}
                  >
                    <WhatsappAvatar
                      name={displayName}
                      pictureUrl={c.profile_picture_url}
                      isGroup={isGroup}
                      className="h-12 w-12"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {isGroup ? (
                            <Users
                              className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400"
                              aria-hidden
                            />
                          ) : null}
                          <span className="truncate">{displayName}</span>
                        </p>
                        <span className="shrink-0 text-[10px] text-zinc-500 dark:text-zinc-400">
                          {formatChatListTime(c.last_message_at)}
                        </span>
                      </div>
                      {isGroup ? (
                        <p className="truncate text-[10px] text-zinc-400 dark:text-zinc-500">
                          Grupo · {jidToDisplay(c.chat_id)}
                        </p>
                      ) : null}
                      {customerName || leadName ? (
                        <div className="-mt-0.5 mb-0.5 flex items-center gap-1 text-[10px]">
                          {customerName ? (
                            <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                              <UserCheck className="h-2.5 w-2.5" />
                              {customerName !== displayName ? customerName : 'Cliente'}
                            </span>
                          ) : leadName ? (
                            <span className="inline-flex items-center gap-0.5 text-sky-600 dark:text-sky-400">
                              <UserPlus className="h-2.5 w-2.5" />
                              {leadName !== displayName ? leadName : 'Lead'}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="mt-0.5 flex items-center gap-1.5">
                        {c.last_message_from_me ? (
                          <CheckCheck className="h-3 w-3 shrink-0 text-zinc-400" />
                        ) : null}
                        <p className="flex-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                          {c.last_message_preview ?? ' '}
                        </p>
                        {c.unread_count > 0 && !isActive ? (
                          <span className="ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-semibold text-white">
                            {c.unread_count > 99 ? '99+' : c.unread_count}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </ScrollArea>
    </div>
  );
};

// Re-export para que el componente principal pueda mostrar ticks en preview.
export { Check, CheckCheck };
