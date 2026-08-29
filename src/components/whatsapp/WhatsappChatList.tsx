import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, RefreshCw, MessageSquarePlus, Users, Megaphone, UserPlus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { WhatsappAvatar } from './WhatsappAvatar';
import {
  formatChatListTime,
  formatMetaLeadLabel,
  isGroupJid,
  isMetaMarketingLead,
  isRecentMetaLead,
  isSystemChatJid,
  jidToDisplay,
  displayNameForChat,
  resolvePhoneLabelForChat,
  customerProfilePath,
  type MetaLeadInfo,
} from './whatsappUtils';
import { useWhatsappTheme } from './WhatsappThemeContext';
import { Check, CheckCheck } from 'lucide-react';
import type { WhatsappChatRow } from '@/hooks/useWhatsappChats';
import { WHATSAPP_CHAT_LIST_COLUMNS } from '@/hooks/useWhatsappChats';
import { useWhatsappCompanyId } from '@/hooks/useWhatsappCompanyId';
import { supabase } from '@/lib/supabase';

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function chatMatchesSearch(
  c: WhatsappChatRow,
  qNorm: string,
  qDigits: string,
  opts: {
    customerNameById?: Record<string, string>;
    customerIdByChatId?: Record<string, string>;
    customerNameByChatId?: Record<string, string>;
    phoneLabelByChatId?: Record<string, string>;
    leadNameById?: Record<string, string>;
  },
): boolean {
  const linkedCustomerId = c.customer_id ?? opts.customerIdByChatId?.[c.chat_id] ?? null;
  const customerName = linkedCustomerId
    ? opts.customerNameById?.[linkedCustomerId] ?? opts.customerNameByChatId?.[c.chat_id]
    : opts.customerNameByChatId?.[c.chat_id];
  const leadName = c.marketing_lead_id ? opts.leadNameById?.[c.marketing_lead_id] : undefined;
  const phoneLabel =
    (!isGroupJid(c.chat_id) &&
      (resolvePhoneLabelForChat(c.chat_id) || opts.phoneLabelByChatId?.[c.chat_id] || '')) ||
    '';
  const displayName = displayNameForChat(
    c.chat_id,
    customerName || c.name || leadName,
    leadName,
  );
  const haystack = normalizeSearchText(
    [
      displayName,
      customerName ?? '',
      leadName ?? '',
      c.name ?? '',
      jidToDisplay(c.chat_id),
      phoneLabel,
      c.chat_id,
      c.last_message_preview ?? '',
    ].join(' '),
  );
  if (qNorm && haystack.includes(qNorm)) return true;
  if (qDigits.length >= 3) {
    const digitHay = [
      c.chat_id,
      phoneLabel,
      jidToDisplay(c.chat_id),
      c.last_message_preview ?? '',
    ]
      .join('')
      .replace(/\D/g, '');
    if (digitHay.includes(qDigits)) return true;
  }
  return false;
}

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

type ChatFilter = 'all' | 'unread' | 'groups';

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
  const theme = useWhatsappTheme();
  const { companyId } = useWhatsappCompanyId();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ChatFilter>('all');

  const searchTrim = search.trim();
  const searchReady = searchTrim.length >= 2;

  /** Búsqueda en BD: la lista local solo trae los ~N más recientes. */
  const remoteSearchQuery = useQuery({
    queryKey: ['whatsapp-chats-search', companyId, searchTrim],
    enabled: !!companyId && searchReady,
    staleTime: 15_000,
    queryFn: async (): Promise<WhatsappChatRow[]> => {
      if (!companyId) return [];
      const q = searchTrim;
      const digits = q.replace(/\D/g, '');
      const safe = q.replace(/[%_,."'\\]/g, '');
      if (!safe && digits.length < 3) return [];
      const pattern = safe ? `%${safe}%` : `%${digits}%`;
      const quoted = `"${pattern}"`;

      const { data: byChat, error: chatErr } = await supabase
        .from('whatsapp_chats')
        .select(WHATSAPP_CHAT_LIST_COLUMNS)
        .eq('company_id', companyId)
        .eq('archived', false)
        .or(`name.ilike.${quoted},chat_id.ilike.${quoted},last_message_preview.ilike.${quoted}`)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(80);
      if (chatErr) throw chatErr;

      const byCustomerIds = new Set<string>();
      // Clientes pueden estar en el catálogo (otra company_id); buscar por nombre/tel y luego por customer_id en chats.
      const customerOr = [
        `name.ilike.${quoted}`,
        digits.length >= 3
          ? `phone.ilike."%${digits}%",phone_mobile.ilike."%${digits}%",phone_home.ilike."%${digits}%"`
          : null,
      ]
        .filter(Boolean)
        .join(',');
      const { data: customers } = await supabase
        .from('customers')
        .select('id')
        .is('archived_at', null)
        .or(customerOr)
        .limit(40);
      for (const row of customers ?? []) byCustomerIds.add(row.id);

      const leadOr = [
        `first_name.ilike.${quoted}`,
        `last_name.ilike.${quoted}`,
        digits.length >= 3 ? `phone.ilike."%${digits}%"` : null,
      ]
        .filter(Boolean)
        .join(',');
      const { data: leads } = await supabase
        .from('marketing_leads')
        .select('id')
        .eq('company_id', companyId)
        .or(leadOr)
        .limit(40);

      const leadIds = (leads ?? []).map((l) => l.id);
      const extra: WhatsappChatRow[] = [];

      if (byCustomerIds.size > 0) {
        const { data } = await supabase
          .from('whatsapp_chats')
          .select(WHATSAPP_CHAT_LIST_COLUMNS)
          .eq('company_id', companyId)
          .eq('archived', false)
          .in('customer_id', [...byCustomerIds])
          .order('last_message_at', { ascending: false, nullsFirst: false })
          .limit(80);
        extra.push(...((data ?? []) as WhatsappChatRow[]));
      }
      if (leadIds.length > 0) {
        const { data } = await supabase
          .from('whatsapp_chats')
          .select(WHATSAPP_CHAT_LIST_COLUMNS)
          .eq('company_id', companyId)
          .eq('archived', false)
          .in('marketing_lead_id', leadIds)
          .order('last_message_at', { ascending: false, nullsFirst: false })
          .limit(80);
        extra.push(...((data ?? []) as WhatsappChatRow[]));
      }

      const map = new Map<string, WhatsappChatRow>();
      for (const row of [...(byChat ?? []), ...extra] as WhatsappChatRow[]) {
        if (isSystemChatJid(row.chat_id)) continue;
        map.set(row.chat_id, row);
      }
      return [...map.values()];
    },
  });

  const filtered = useMemo(() => {
    const remote = remoteSearchQuery.data ?? [];
    const byId = new Map<string, WhatsappChatRow>();
    for (const c of chats) byId.set(c.chat_id, c);
    for (const c of remote) {
      if (!byId.has(c.chat_id)) byId.set(c.chat_id, c);
    }
    let list = [...byId.values()];

    if (filter === 'unread') {
      list = list.filter((c) => (c.unread_count ?? 0) > 0);
    } else if (filter === 'groups') {
      list = list.filter((c) => c.is_group || isGroupJid(c.chat_id));
    }

    const qNorm = normalizeSearchText(searchTrim);
    const qDigits = searchTrim.replace(/\D/g, '');
    if (!qNorm && qDigits.length < 3) {
      return list.sort((a, b) => {
        const ta = a.last_message_at ? Date.parse(a.last_message_at) : 0;
        const tb = b.last_message_at ? Date.parse(b.last_message_at) : 0;
        return tb - ta;
      });
    }

    const lookup = {
      customerNameById,
      customerIdByChatId,
      customerNameByChatId,
      phoneLabelByChatId,
      leadNameById,
    };
    return list
      .filter((c) => chatMatchesSearch(c, qNorm, qDigits, lookup))
      .sort((a, b) => {
        const ta = a.last_message_at ? Date.parse(a.last_message_at) : 0;
        const tb = b.last_message_at ? Date.parse(b.last_message_at) : 0;
        return tb - ta;
      });
  }, [
    chats,
    remoteSearchQuery.data,
    searchTrim,
    filter,
    customerNameById,
    customerIdByChatId,
    customerNameByChatId,
    phoneLabelByChatId,
    leadNameById,
  ]);

  const clinicLabel = sessionPushName?.trim() || 'WhatsApp clínica';
  const clinicPhone = sessionPhone?.trim() || '';

  return (
    <div
      className={`flex h-full min-h-0 w-full flex-col overflow-hidden border-r ${theme.border} ${theme.sidebarBg}`}
    >
      {/* Header de sesión (estilo WhatsApp Web) */}
      <div
        className={`flex h-[60px] shrink-0 items-center justify-between px-4 ${theme.headerBg} border-b ${theme.border}`}
      >
        <div className="flex min-w-0 items-center gap-3">
          <WhatsappAvatar name={clinicLabel} className="h-10 w-10" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-[#111b21] dark:text-zinc-100">
              {clinicLabel}
              {clinicPhone ? (
                <span className={`font-normal ${theme.textMuted}`}> · {clinicPhone}</span>
              ) : null}
            </p>
            <p className={`truncate text-xs ${theme.textMuted}`}>
              {sessionStatusLabel(sessionStatus)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={`h-9 w-9 ${theme.textIcon}`}
            onClick={onStartNew}
            title="Nuevo chat"
          >
            <MessageSquarePlus className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={`h-9 w-9 ${theme.textIcon}`}
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Sincronizar chats e histórico desde Waha"
          >
            <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Buscador */}
      <div className={`shrink-0 border-b p-2 ${theme.border} ${theme.sidebarBg}`}>
        <div className={`flex items-center gap-3 rounded-lg p-2 ${theme.searchBg}`}>
          <Search className={`h-4 w-4 shrink-0 ${theme.textIcon}`} />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Busca un chat o inicia uno nuevo"
            className="h-auto border-0 bg-transparent p-0 text-sm text-[#111b21] shadow-none placeholder:text-[#667781] focus-visible:ring-0 dark:text-zinc-100 dark:placeholder:text-zinc-400"
          />
        </div>
      </div>

      <div className={`flex shrink-0 gap-1.5 border-b px-2 py-2 ${theme.border}`}>
        {(
          [
            ['all', 'Todos'],
            ['unread', 'No leídos'],
            ['groups', 'Grupos'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === id
                ? 'bg-emerald-600 text-white'
                : `${theme.searchBg} ${theme.textMuted} hover:opacity-90`
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y [-webkit-overflow-scrolling:touch]">
        <ul className="divide-y divide-[#f0f2f5] dark:divide-zinc-800">
          {filtered.length === 0 ? (
            <li className={`px-4 py-10 text-center text-xs ${theme.textMuted}`}>
              {remoteSearchQuery.isFetching && searchReady
                ? 'Buscando…'
                : chats.length === 0
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
              const hasUnread = (c.unread_count ?? 0) > 0 && !isActive;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.chat_id)}
                    className={`flex w-full items-center gap-3 p-3 text-left transition ${
                      isActive
                        ? theme.chatActive
                        : theme.chatHover
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
                        <p
                          className={`flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm ${
                            hasUnread
                              ? 'font-semibold text-[#111b21] dark:text-zinc-50'
                              : 'font-medium text-[#111b21] dark:text-zinc-100'
                          }`}
                        >
                          {isGroup ? (
                            <Users
                              className="h-3.5 w-3.5 shrink-0 text-sky-600 dark:text-sky-400"
                              aria-hidden
                            />
                          ) : null}
                          {isCustomer && linkedCustomerId ? (
                            <Link
                              to={customerProfilePath(linkedCustomerId)}
                              onClick={(e) => e.stopPropagation()}
                              className="truncate hover:underline"
                              title="Abrir ficha del cliente"
                            >
                              {displayName}
                            </Link>
                          ) : (
                            <span className="truncate">{displayName}</span>
                          )}
                          {showPhoneInline ? (
                            <span className={`truncate font-normal ${theme.textMuted}`}>
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
                          <span className={`text-xs ${theme.textMuted}`}>
                            {formatChatListTime(c.last_message_at)}
                          </span>
                        </div>
                      </div>
                      {leadMeta ? (
                        <span
                          className={`mb-0.5 inline-flex max-w-full items-center gap-0.5 truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            isMetaMarketingLead(leadMeta) &&
                            isRecentMetaLead(leadMeta.externalCreatedAt)
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
                              : isMetaMarketingLead(leadMeta)
                                ? 'bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                                : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                          }`}
                          title={formatMetaLeadLabel(leadMeta)}
                        >
                          {isMetaMarketingLead(leadMeta) ? (
                            <Megaphone className="h-2.5 w-2.5 shrink-0" />
                          ) : (
                            <UserPlus className="h-2.5 w-2.5 shrink-0" />
                          )}
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
                        <p className={`truncate text-[10px] ${theme.textMuted}`}>
                          Grupo de WhatsApp
                        </p>
                      ) : null}
                      <div className="mt-0.5 flex items-center gap-1.5">
                        {c.last_message_from_me ? (
                          <CheckCheck
                            className={`h-3 w-3 shrink-0 ${
                              hasUnread ? theme.textMuted : 'text-sky-500 dark:text-sky-400'
                            }`}
                            aria-hidden
                          />
                        ) : hasUnread ? (
                          <span
                            className="h-2 w-2 shrink-0 rounded-full bg-[#25d366]"
                            aria-label="No leído"
                          />
                        ) : null}
                        <p
                          className={`flex-1 truncate text-xs ${
                            hasUnread
                              ? 'font-medium text-[#111b21] dark:text-zinc-200'
                              : theme.textMuted
                          }`}
                        >
                          {c.last_message_preview ?? ' '}
                        </p>
                        {hasUnread ? (
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
