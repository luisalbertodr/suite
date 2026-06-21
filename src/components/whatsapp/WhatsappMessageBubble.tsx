import React from 'react';
import {
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  FileText,
  Download,
  Reply,
  Forward,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import type { WhatsappMessageRow } from '@/hooks/useWhatsappMessages';
import {
  formatMessageTime,
  ackLabel,
  extractBodyFromWahaMessageRaw,
  extractEmbeddedMediaBase64,
  extractMediaUrlFromWahaMessageRaw,
  extractPushNameFromRaw,
  extractReplyToFromRaw,
  formatGroupSenderLabel,
  isExternalWhatsappCdnUrl,
  messagePreviewText,
  lookupGroupSenderLabel,
  resolveGroupSenderJidFromRaw,
  isMessageRevoked,
  resolveWhatsappMessageType,
  resolveWhatsappMediaMessageId,
  resolveMediaDownloadChatId,
  resolveSupabasePublicStorageUrl,
  revokedMessageLabel,
  base64ToBlob,
} from './whatsappUtils';
import { useWhatsappTheme } from './WhatsappThemeContext';
import { downloadWhatsappMedia } from '@/hooks/useWhatsappConfig';
import {
  getCachedWhatsappMediaUrl,
  invalidateWhatsappMediaCache,
  loadWhatsappMediaCached,
  whatsappMediaCacheKey,
} from './whatsappMediaCache';
import { useWhatsappChatContext } from './WhatsappChatContext';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';

interface Props {
  message: WhatsappMessageRow;
  isGroupChat?: boolean;
  senderDirectory?: Record<string, string>;
  quotedMessage?: WhatsappMessageRow | null;
  quotedPreview?: string | null;
  /** Mensaje entrante aún no leído al abrir el chat. */
  isUnread?: boolean;
  onReply?: (message: WhatsappMessageRow) => void;
  onForward?: (message: WhatsappMessageRow) => void;
  onDeleteForEveryone?: (message: WhatsappMessageRow) => void;
}

const AckIcon: React.FC<{ ack: number }> = ({ ack }) => {
  if (ack <= 0) return <Clock className="h-3.5 w-3.5 text-emerald-50/70" aria-label="Pendiente" />;
  if (ack === 1) return <Check className="h-3.5 w-3.5 text-emerald-50/80" aria-label="Enviado" />;
  if (ack === 2) return <CheckCheck className="h-3.5 w-3.5 text-emerald-50/80" aria-label="Entregado" />;
  if (ack === 3 || ack === 4)
    return <CheckCheck className="h-3.5 w-3.5 text-sky-300" aria-label="Leído" />;
  return <AlertCircle className="h-3.5 w-3.5 text-rose-200" aria-label="Error" />;
};

function QuoteBlock({ preview, isOut }: { preview: string; isOut: boolean }) {
  return (
    <div
      className={`mb-1 rounded border-l-4 px-2 py-1 text-xs ${
        isOut
          ? 'border-emerald-600 bg-emerald-700/10 text-emerald-900 dark:text-emerald-100'
          : 'border-sky-500 bg-black/5 text-zinc-700 dark:text-zinc-200'
      }`}
    >
      <p className="line-clamp-2 whitespace-pre-wrap break-words opacity-90">{preview}</p>
    </div>
  );
}

function MessageActions({
  message,
  canForward,
  canDeleteForEveryone,
  onReply,
  onForward,
  onDeleteForEveryone,
  className,
}: {
  message: WhatsappMessageRow;
  canForward: boolean;
  canDeleteForEveryone: boolean;
  onReply?: (message: WhatsappMessageRow) => void;
  onForward?: (message: WhatsappMessageRow) => void;
  onDeleteForEveryone?: (message: WhatsappMessageRow) => void;
  className?: string;
}) {
  if (!onReply && !onForward && !onDeleteForEveryone) return null;
  return (
    <div className={`flex items-center gap-0.5 ${className ?? ''}`}>
      {onReply ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full text-[#54656f] hover:bg-black/5 dark:text-zinc-300"
          title="Responder"
          onClick={() => onReply(message)}
        >
          <Reply className="h-3.5 w-3.5" />
        </Button>
      ) : null}
      {onForward ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full text-[#54656f] hover:bg-black/5 disabled:opacity-40 dark:text-zinc-300"
          title="Reenviar"
          disabled={!canForward}
          onClick={() => onForward(message)}
        >
          <Forward className="h-3.5 w-3.5" />
        </Button>
      ) : null}
      {onDeleteForEveryone ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-full text-[#54656f] hover:bg-black/5 hover:text-destructive disabled:opacity-40 dark:text-zinc-300"
          title="Eliminar para todos"
          disabled={!canDeleteForEveryone}
          onClick={() => onDeleteForEveryone(message)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

function MediaPlaceholder({
  label,
  className,
  onRetry,
}: {
  label: string;
  className?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 rounded-md bg-black/10 text-xs text-muted-foreground ${className ?? ''}`}
    >
      <span>{label}</span>
      {onRetry ? (
        <button
          type="button"
          className="text-emerald-700 underline hover:text-emerald-800 dark:text-emerald-400"
          onClick={onRetry}
        >
          Reintentar
        </button>
      ) : null}
    </div>
  );
}

function isInScrollViewport(
  node: HTMLElement,
  root: HTMLElement | null,
  marginPx = 240,
): boolean {
  const n = node.getBoundingClientRect();
  if (!root) {
    return n.top < window.innerHeight + marginPx && n.bottom > -marginPx;
  }
  const r = root.getBoundingClientRect();
  return n.bottom >= r.top - marginPx && n.top <= r.bottom + marginPx;
}

function MediaContent({ message }: { message: WhatsappMessageRow }) {
  const {
    activeChatId,
    relatedChatIds,
    scrollRootRef,
    prefetchLoading,
    prefetchReady,
    getPrefetchMedia,
  } = useWhatsappChatContext();
  const type = resolveWhatsappMessageType(message);
  const rawStickerUrl = extractMediaUrlFromWahaMessageRaw(message.raw);
  const storedUrl = resolveSupabasePublicStorageUrl(message.media_url || rawStickerUrl || null);
  const isStorageUrl = !!storedUrl?.includes('/storage/v1/object/public/whatsapp-media/');
  const wahaDirectUrl =
    storedUrl && !isExternalWhatsappCdnUrl(storedUrl) && !isStorageUrl
      ? storedUrl
      : null;
  const mediaMessageId = resolveWhatsappMediaMessageId(message);
  const downloadChatId = resolveMediaDownloadChatId(
    message,
    activeChatId,
    relatedChatIds,
  );
  const cacheKey =
    mediaMessageId && downloadChatId
      ? whatsappMediaCacheKey(downloadChatId, mediaMessageId)
      : null;
  const embedded = React.useMemo(
    () => extractEmbeddedMediaBase64(message.raw),
    [message.raw],
  );
  const canDownload =
    !!embedded || !!wahaDirectUrl || !!(mediaMessageId && downloadChatId);

  const prefetched = mediaMessageId ? getPrefetchMedia(mediaMessageId) : null;

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [visible, setVisible] = React.useState(false);
  const [objectUrl, setObjectUrl] = React.useState<string | null>(() => {
    if (storedUrl?.includes('/storage/v1/object/public/whatsapp-media/')) return storedUrl;
    return cacheKey ? getCachedWhatsappMediaUrl(cacheKey) : null;
  });
  const [loadFailed, setLoadFailed] = React.useState(false);
  const [expiredMedia, setExpiredMedia] = React.useState(false);
  const [retryTick, setRetryTick] = React.useState(0);

  React.useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const root = scrollRootRef.current;
    if (isInScrollViewport(node, root)) {
      setVisible(true);
      return;
    }
    if (objectUrl) {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { root, rootMargin: '240px 0px' },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [objectUrl, scrollRootRef, cacheKey, message.id]);

  // Prefetch → URL pública en Storage (sin base64 ni blob).
  React.useEffect(() => {
    const url = resolveSupabasePublicStorageUrl(prefetched?.url ?? null);
    if (!url || objectUrl) return;
    setObjectUrl(url);
    setLoadFailed(false);
  }, [prefetched, objectUrl]);

  // media_url persistida en BD (Storage).
  React.useEffect(() => {
    if (objectUrl || prefetched?.url) return;
    if (isStorageUrl && storedUrl) {
      setObjectUrl(storedUrl);
    }
  }, [storedUrl, isStorageUrl, objectUrl, prefetched]);

  React.useEffect(() => {
    if (!visible || !canDownload || !cacheKey || objectUrl || prefetched) return;
    if (isStorageUrl && storedUrl) return;
    if (embedded) {
      let cancelled = false;
      (async () => {
        try {
          const url = await loadWhatsappMediaCached(cacheKey, async () =>
            base64ToBlob(embedded.data, embedded.mime),
          );
          if (!cancelled) setObjectUrl(url);
        } catch {
          if (!cancelled) setLoadFailed(true);
        }
      })();
      return () => {
        cancelled = true;
      };
    }
    if (!prefetchReady) return;

    let cancelled = false;
    setLoadFailed(false);

    const load = async () => {
      try {
        const url = await loadWhatsappMediaCached(cacheKey, async () => {
          const altIds = [message.chat_id, activeChatId, ...relatedChatIds]
            .filter((id, i, arr) => !!id && id !== downloadChatId && arr.indexOf(id) === i)
            .slice(0, 2) as string[];
          return downloadWhatsappMedia({
            url: wahaDirectUrl,
            chat_id: downloadChatId,
            message_id: mediaMessageId,
            alt_chat_ids: altIds,
          });
        });
        if (!cancelled) setObjectUrl(url);
      } catch (e) {
        if (!cancelled) {
          const msg = e instanceof Error ? e.message : '';
          setLoadFailed(true);
          setExpiredMedia(/expirad|410|gone/i.test(msg));
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [
    visible,
    canDownload,
    cacheKey,
    wahaDirectUrl,
    downloadChatId,
    mediaMessageId,
    embedded,
    prefetched,
    prefetchReady,
    retryTick,
    message.chat_id,
    activeChatId,
    relatedChatIds,
    objectUrl,
    isStorageUrl,
    storedUrl,
  ]);

  const retry = () => {
    if (expiredMedia) return;
    if (cacheKey) invalidateWhatsappMediaCache(cacheKey);
    setObjectUrl(null);
    setLoadFailed(false);
    setExpiredMedia(false);
    setRetryTick((n) => n + 1);
  };

  if (type === 'image' || type === 'sticker') {
    return (
      <div ref={containerRef} className="overflow-hidden rounded-md">
        {objectUrl ? (
          <img
            src={objectUrl}
            alt={type === 'sticker' ? 'sticker' : message.media_filename ?? 'imagen'}
            loading="lazy"
            decoding="async"
            className={
              type === 'sticker'
                ? 'h-32 w-32 object-contain'
                : 'max-h-80 w-auto max-w-full rounded-md'
            }
          />
        ) : !canDownload && type === 'sticker' ? (
          <div
            className="flex h-32 w-32 items-center justify-center rounded-md bg-black/10 text-4xl"
            title="Sticker (sin vista previa)"
          >
            🎭
          </div>
        ) : loadFailed ? (
          <MediaPlaceholder
            label={expiredMedia ? 'Media no disponible' : 'No se pudo cargar'}
            className={type === 'sticker' ? 'h-32 w-32' : 'h-40 w-60'}
            onRetry={expiredMedia ? undefined : retry}
          />
        ) : (
          <MediaPlaceholder
            label={prefetchLoading && visible ? 'Cargando…' : 'Cargando…'}
            className={type === 'sticker' ? 'h-32 w-32' : 'h-40 w-60'}
          />
        )}
      </div>
    );
  }

  if (type === 'video') {
    return (
      <div ref={containerRef} className="overflow-hidden rounded-md">
        {objectUrl ? (
          <video
            src={objectUrl}
            controls
            preload="metadata"
            className="max-h-80 w-auto max-w-full rounded-md"
          />
        ) : loadFailed ? (
          <MediaPlaceholder label="No se pudo cargar el vídeo" className="h-40 w-60" onRetry={retry} />
        ) : (
          <MediaPlaceholder label="Cargando vídeo…" className="h-40 w-60" />
        )}
      </div>
    );
  }

  if (type === 'audio' || type === 'voice' || type === 'ptt') {
    return (
      <div ref={containerRef}>
        {objectUrl ? (
          <audio src={objectUrl} controls preload="metadata" className="w-64" />
        ) : loadFailed ? (
          <MediaPlaceholder label="No se pudo cargar el audio" className="h-10 w-64" onRetry={retry} />
        ) : (
          <MediaPlaceholder label="Cargando audio…" className="h-10 w-64" />
        )}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex items-center gap-2 rounded-md bg-black/5 p-2 text-xs">
      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {message.media_filename ?? 'documento'}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {message.media_mime_type ?? 'archivo'}
          {message.media_size
            ? ` · ${(message.media_size / 1024).toFixed(0)} KB`
            : ''}
        </p>
      </div>
      {objectUrl ? (
        <a
          href={objectUrl}
          download={message.media_filename ?? 'archivo'}
          className="text-emerald-700 hover:underline"
          title="Descargar archivo"
          aria-label="Descargar archivo"
        >
          <Download className="h-4 w-4" />
        </a>
      ) : loadFailed ? (
        <button type="button" className="text-emerald-700 hover:underline" onClick={retry}>
          Reintentar
        </button>
      ) : null}
    </div>
  );
}

function senderLabel(
  message: WhatsappMessageRow,
  isGroupChat?: boolean,
  senderDirectory?: Record<string, string>,
): string | null {
  if (message.from_me) return null;
  const pushName = extractPushNameFromRaw(message.raw);
  const jid = isGroupChat
    ? resolveGroupSenderJidFromRaw(message.raw, message.from_jid) ?? message.from_jid
    : message.from_jid;
  const fromDirectory = lookupGroupSenderLabel(senderDirectory ?? {}, jid, message.raw);
  if (fromDirectory) return fromDirectory;
  return formatGroupSenderLabel(jid, pushName);
}

function resolveQuotedPreview(
  message: WhatsappMessageRow,
  quotedMessage?: WhatsappMessageRow | null,
  quotedPreview?: string | null,
): string | null {
  if (quotedMessage) return messagePreviewText(quotedMessage);
  if (quotedPreview?.trim()) return quotedPreview.trim();
  const fromRaw = extractReplyToFromRaw(message.raw);
  if (fromRaw?.body?.trim()) return fromRaw.body.trim();
  if (message.quoted_message_id) return 'Mensaje citado';
  return null;
}

export const WhatsappMessageBubble: React.FC<Props> = ({
  message,
  isGroupChat,
  senderDirectory,
  quotedMessage,
  quotedPreview,
  isUnread = false,
  onReply,
  onForward,
  onDeleteForEveryone,
}) => {
  const theme = useWhatsappTheme();
  const isOut = message.from_me;
  const type = resolveWhatsappMessageType(message);
  const revoked = isMessageRevoked(message);
  const isMedia = !revoked && type !== 'text' && type !== 'chat';
  const time = formatMessageTime(message.timestamp);
  const rawText = extractBodyFromWahaMessageRaw(message.raw);
  const textLine =
    message.body?.trim() ||
    message.caption?.trim() ||
    rawText ||
    '';
  const groupSender = isGroupChat && !isOut
    ? senderLabel(message, isGroupChat, senderDirectory)
    : null;
  const quoteText = resolveQuotedPreview(message, quotedMessage, quotedPreview);
  const canForward = !!message.waha_message_id;
  const canDeleteForEveryone =
    isOut && !!message.waha_message_id && !revoked;
  const hasActions = !!(onReply || onForward || onDeleteForEveryone);

  const bubble = (
    <div
      className={`group/bubble relative max-w-[65%] rounded-lg p-2 text-sm shadow-sm ${
        isOut
          ? `rounded-tr-none ${theme.bubbleOut} text-[#111b21] dark:text-emerald-50`
          : `rounded-tl-none ${theme.bubbleIn} text-[#111b21] dark:text-zinc-100${
              isUnread
                ? ' ring-2 ring-emerald-500/50 bg-emerald-50/90 dark:bg-emerald-950/50'
                : ''
            }`
      }`}
      onDoubleClick={() => onReply?.(message)}
    >
      {hasActions ? (
        <>
          <MessageActions
            message={message}
            canForward={canForward}
            canDeleteForEveryone={canDeleteForEveryone}
            onReply={onReply}
            onForward={onForward}
            onDeleteForEveryone={onDeleteForEveryone}
            className={`absolute top-1 flex md:hidden ${
              isOut ? 'left-0 -translate-x-full pr-1' : 'right-0 translate-x-full pl-1'
            }`}
          />
          <MessageActions
            message={message}
            canForward={canForward}
            canDeleteForEveryone={canDeleteForEveryone}
            onReply={onReply}
            onForward={onForward}
            onDeleteForEveryone={onDeleteForEveryone}
            className={`absolute top-1 hidden group-hover/bubble:md:flex ${
              isOut ? 'left-0 -translate-x-full pr-1' : 'right-0 translate-x-full pl-1'
            }`}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={`absolute top-0.5 h-6 w-6 rounded-full opacity-70 hover:opacity-100 group-hover/bubble:opacity-100 md:hidden ${
                  isOut ? 'left-0.5' : 'right-0.5'
                }`}
                title="Acciones"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isOut ? 'end' : 'start'}>
              {onReply ? (
                <DropdownMenuItem onSelect={() => onReply(message)}>
                  <Reply className="mr-2 h-4 w-4" />
                  Responder
                </DropdownMenuItem>
              ) : null}
              {onForward ? (
                <DropdownMenuItem
                  disabled={!canForward}
                  onSelect={() => onForward(message)}
                >
                  <Forward className="mr-2 h-4 w-4" />
                  Reenviar
                </DropdownMenuItem>
              ) : null}
              {onDeleteForEveryone ? (
                <DropdownMenuItem
                  disabled={!canDeleteForEveryone}
                  className="text-destructive focus:text-destructive"
                  onSelect={() => onDeleteForEveryone(message)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar para todos
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      ) : null}

      {groupSender ? (
        <p className="mb-0.5 text-[11px] font-semibold text-sky-600 dark:text-sky-400">
          {groupSender}
        </p>
      ) : null}
      {quoteText ? <QuoteBlock preview={quoteText} isOut={isOut} /> : null}
      {revoked ? (
        <p
          className={`whitespace-pre-wrap pr-12 text-sm italic ${
            isOut
              ? 'text-[#667781] dark:text-emerald-100/70'
              : 'text-[#667781] dark:text-zinc-400'
          }`}
        >
          {revokedMessageLabel(isOut)}
        </p>
      ) : isMedia ? (
        <div className="mb-1">
          <MediaContent message={message} />
          {message.caption ? (
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">
              {message.caption}
            </p>
          ) : rawText ? (
            <p className="mt-1 whitespace-pre-wrap break-words text-sm">{rawText}</p>
          ) : null}
        </div>
      ) : (
        <p className="whitespace-pre-wrap break-words pr-12">
          {textLine ? (
            textLine
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500 italic">
              Sin texto (revisa que el webhook esté actualizado)
            </span>
          )}
        </p>
      )}
      <div
        className={`pointer-events-none float-right ml-2 mt-0.5 flex items-center gap-1 text-[10px] ${
          isOut
            ? 'text-[#667781] dark:text-emerald-100/70'
            : 'text-[#667781] dark:text-zinc-400'
        }`}
      >
        <span>{time}</span>
        {isOut ? (
          <span title={ackLabel(message.ack)}>
            <AckIcon ack={message.ack} />
          </span>
        ) : null}
      </div>
    </div>
  );

  if (!hasActions) {
    return (
      <div className={`flex w-full ${isOut ? 'justify-end' : 'justify-start'}`}>
        {bubble}
      </div>
    );
  }

  return (
    <div className={`flex w-full ${isOut ? 'justify-end' : 'justify-start'}`}>
      <ContextMenu>
        <ContextMenuTrigger asChild>{bubble}</ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          {onReply ? (
            <ContextMenuItem onSelect={() => onReply(message)}>
              <Reply className="mr-2 h-4 w-4" />
              Responder
            </ContextMenuItem>
          ) : null}
          {onForward ? (
            <ContextMenuItem
              disabled={!canForward}
              onSelect={() => onForward(message)}
            >
              <Forward className="mr-2 h-4 w-4" />
              Reenviar
            </ContextMenuItem>
          ) : null}
          {onDeleteForEveryone ? (
            <ContextMenuItem
              disabled={!canDeleteForEveryone}
              className="text-destructive focus:text-destructive"
              onSelect={() => onDeleteForEveryone(message)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Eliminar para todos
            </ContextMenuItem>
          ) : null}
        </ContextMenuContent>
      </ContextMenu>
    </div>
  );
};
