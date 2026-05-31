import React, { useMemo, useState } from 'react';
import { Search, RefreshCw, MessageSquarePlus, Users, Megaphone, UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { WhatsappAvatar } from './WhatsappAvatar';
import {
  formatChatListTime,
  formatMetaLeadLabel,
  isGroupJid,
  isRecentMetaLead,
  jidToDisplay,
  displayNameForChat,
  resolvePhoneLabelForChat,
  waTheme,
  type MetaLeadInfo,
} from './whatsappUtils';
import { Check, CheckCheck } from 'lucide-react';
import type { WhatsappChatRow } from '@/hooks/useWhatsappChats';

interface Props {
  chats: WhatsappChatRow[];
  selectedChatId: string | null;
  onSelect: (chatId: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onStartNew: () => void;
  customerNameById?: Record<string, string>;
  customerIdByChatId?: Record<string, string>;
  customerNameByChatId?: Record<string, string>;
  phoneLabelByChatId?: Record<string, string>;
  leadNameById?: Record<string, string>;
  leadMetaById?: Record<string, MetaLeadInfo>;
  sessionPushName?: string | null;
  sessionStatus?: string | null;
  sessionPhone?: string | null;
  onCreateCustomer?: (chat: WhatsappChatRow) => void;
}

function sessionStatusLabel(status: string | null | undefined): string {
  const s = (status ?? '').toUpperCase();
  if (s === 'WORKING') return 'Conectado';
  if (s === 'STARTING') return 'Iniciando…';
  if (s === 'SCAN_QR_CODE') return 'Escanea el QR';
  if (s === 'STOPPED') return 'Detenido';
  return status ?? 'Sin sesión';
}

export const WhatsappChatList: React.FC<Props> = ({
  chats,
  selectedChatId,
  onSelect,
  onRefresh,
  isRefreshing,
  onStartNew,
  customerNameById,
  customerIdByChatId,
  customerNameByChatId,
  phoneLabelByChatId = {},
  leadNameById,
  leadMetaById,
  sessionPushName,
  sessionStatus,
  sessionPhone,
  onCreateCustomer,
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

  const clinicLabel = sessionPushName?.trim() || 'WhatsApp clínica';
  const clinicPhone = sessionPhone?.trim() || '';

  return (
    <div
      className={`flex h-full min-h-0 min-w-[340px] max-w-[400px] flex-col overflow-hidden border-r ${waTheme.border} ${waTheme.sidebarBg}`}
    >
      {/* Header de sesión (estilo WhatsApp Web) */}
      <div
        className={`flex h-[60px] shrink-0 items-center justify-between px-4 ${waTheme.headerBg} border-b ${waTheme.border}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <WhatsappAvatar name={clinicLabel} className="h-10 w-10" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[#111b21] dark:text-zinc-100">
              {clinicLabel}
              {clinicPhone ? (
                <span className={`font-normal ${waTheme.textMuted}`}> · {clinicPhone}</span>
              ) : null}
            </p>
            <p className={`truncate text-xs ${waTheme.textMuted}`}>
              {sessionStatusLabel(sessionStatus)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={`h-9 w-9 ${waTheme.textIcon}`}
            onClick={onStartNew}
            title="Nuevo chat"
          >
            <MessageSquarePlus className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-9 w-9 ${waTheme.textIcon}`}
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Sincronizar chats e histórico desde Waha"
          >
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Buscador */}
      <div className={`shrink-0 border-b p-2 ${waTheme.border} ${waTheme.sidebarBg}`}>
        <div className={`flex items-center gap-3 rounded-lg p-2 ${waTheme.searchBg}`}>
          <Search className={`h-4 w-4 shrink-0 ${waTheme.textIcon}`} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Busca un chat o inicia uno nuevo"
            className="h-auto border-0 bg-transparent p-0 text-sm text-[#111b21] shadow-none placeholder:text-[#667781] focus-visible:ring-0 dark:text-zinc-100 dark:placeholder:text-zinc-400"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <ul className="divide-y divide-[#f0f2f5] dark:divide-zinc-800">
          {filtered.length === 0 ? (
            <li className={`px-4 py-10 text-center text-xs ${waTheme.textMuted}`}>
              {chats.length === 0
                ? 'No hay chats todavía. Pulsa el botón de sincronizar para traerlos desde WhatsApp.'
                : 'No hay resultados.'}
            </li>
          ) : (
            filtered.map((c) => {
              const isActive = c.chat_id === selectedChatId;
              const isGroup = c.is_group || isGroupJid(c.chat_id);
              const linkedCustomerId =
                c.customer_id ?? customerIdByChatId?.[c.chat_id] ?? null;
              const customerName = linkedCustomerId
                ? customerNameById?.[linkedCustomerId] ??
                  customerNameByChatId?.[c.chat_id]
                : undefined;
              const leadName = c.marketing_lead_id
                ? leadNameById?.[c.marketing_lead_id]
                : undefined;
              const leadMeta = c.marketing_lead_id
                ? leadMetaById?.[c.marketing_lead_id]
                : undefined;
              const displayName = displayNameForChat(
                c.chat_id,
                customerName || c.name || leadName,
                leadName,
                c.raw,
              );
              const phoneLabel = isGroup
                ? ''
                : resolvePhoneLabelForChat(c.chat_id) ||
                  phoneLabelByChatId[c.chat_id] ||
                  '';
              const showPhoneInline =
                phoneLabel &&
                phoneLabel !== displayName &&
                !displayName.includes(phoneLabel);
              const isCustomer = !!linkedCustomerId;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.chat_id)}
                    className={`flex w-full items-center gap-3 p-3 text-left transition ${
                      isActive
                        ? waTheme.chatActive
                        : waTheme.chatHover
                    }`}
                  >
                    <WhatsappAvatar
                      name={displayName}
                      pictureUrl={c.profile_picture_url}
                      isGroup={isGroup}
                      className="h-12 w-12"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm font-medium text-[#111b21] dark:text-zinc-100">
                          {isGroup ? (
                            <Users
                              className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400"
                              aria-hidden
                            />
                          ) : null}
                          <span className="truncate">{displayName}</span>
                          {showPhoneInline ? (
                            <span className={`truncate font-normal ${waTheme.textMuted}`}>
                              · {phoneLabel}
                            </span>
                          ) : null}
                        </p>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {!isGroup && !isCustomer && onCreateCustomer ? (
                            <span
                              role="button"
                              tabIndex={0}
                              title="Crear cliente"
                              className="inline-flex h-5 cursor-pointer items-center rounded border border-input bg-background px-1.5 text-[9px] font-medium leading-none text-emerald-700 shadow-sm hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950"
                              onClick={(e) => {
                                e.stopPropagation();
                                onCreateCustomer(c);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  onCreateCustomer(c);
                                }
                              }}
                            >
                              <UserPlus className="h-2.5 w-2.5" />
                            </span>
                          ) : null}
                          <span className={`text-xs ${waTheme.textMuted}`}>
                            {formatChatListTime(c.last_message_at)}
                          </span>
                        </div>
                      </div>
                      {leadMeta ? (
                        <span
                          className={`mb-0.5 inline-flex max-w-full items-center gap-0.5 truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            isRecentMetaLead(leadMeta.externalCreatedAt)
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
                              : 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                          }`}
                          title={formatMetaLeadLabel(leadMeta)}
                        >
                          <Megaphone className="h-2.5 w-2.5 shrink-0" />
                          <span className="truncate">{formatMetaLeadLabel(leadMeta)}</span>
                        </span>
                      ) : leadName ? (
                        <div className="mb-0.5 flex items-center gap-1 text-[10px]">
                          <span className="inline-flex items-center gap-0.5 text-sky-600 dark:text-sky-400">
                            <UserPlus className="h-2.5 w-2.5" />
                            {leadName !== displayName ? leadName : 'Lead'}
                          </span>
                        </div>
                      ) : null}
                      {isGroup ? (
                        <p className={`truncate text-[10px] ${waTheme.textMuted}`}>
                          Grupo de WhatsApp
                        </p>
                      ) : null}
                      <div className="mt-0.5 flex items-center gap-1.5">
                        {c.last_message_from_me ? (
                          <CheckCheck className={`h-3 w-3 shrink-0 ${waTheme.textMuted}`} />
                        ) : null}
                        <p className={`flex-1 truncate text-xs ${waTheme.textMuted}`}>
                          {c.last_message_preview ?? ' '}
                        </p>
                        {c.unread_count > 0 && !isActive ? (
                          <span className="ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#25d366] px-1.5 text-[10px] font-semibold text-white">
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
      </div>
    </div>
  );
};

// Re-export para que el componente principal pueda mostrar ticks en preview.
export { Check, CheckCheck };
