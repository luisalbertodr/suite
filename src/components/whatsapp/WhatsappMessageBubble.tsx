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
  extractMediaUrlFromWahaMessageRaw,
  extractPushNameFromRaw,
  extractReplyToFromRaw,
  formatGroupSenderLabel,
  isExternalWhatsappCdnUrl,
  messagePreviewText,
  lookupGroupSenderLabel,
  resolveGroupSenderJidFromRaw,
  isMessageRevoked,
  revokedMessageLabel,
  waTheme,
} from './whatsappUtils';
import { downloadWhatsappMedia } from '@/hooks/useWhatsappConfig';
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

function MediaContent({ message }: { message: WhatsappMessageRow }) {
  const type = (message.type ?? 'text').toLowerCase();
  const rawStickerUrl = extractMediaUrlFromWahaMessageRaw(message.raw);
  const storedUrl = message.media_url || rawStickerUrl || null;
  const wahaDirectUrl =
    storedUrl && !isExternalWhatsappCdnUrl(storedUrl) ? storedUrl : null;
  const canDownload =
    !!wahaDirectUrl || !!(message.waha_message_id && message.chat_id);

  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    let revoke: string | null = null;
    const load = async () => {
      if (!canDownload) return;
      try {
        const blob = await downloadWhatsappMedia({
          url: wahaDirectUrl,
          chat_id: message.chat_id,
          message_id: message.waha_message_id,
        });
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        revoke = url;
        setObjectUrl(url);
      } catch {
        // placeholder
      }
    };
    load();
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [canDownload, wahaDirectUrl, message.chat_id, message.waha_message_id]);

  if (type === 'image' || type === 'sticker') {
    return (
      <div className="overflow-hidden rounded-md">
        {objectUrl ? (
          <img
            src={objectUrl}
            alt={type === 'sticker' ? 'sticker' : message.media_filename ?? 'imagen'}
            className={
              type === 'sticker'
                ? 'h-32 w-32 object-contain'
                : 'max-h-80 w-auto max-w-full rounded-md'
            }
          />
        ) : (
          <div
            className={`flex items-center justify-center rounded-md bg-black/10 text-xs text-muted-foreground ${
              type === 'sticker' ? 'h-32 w-32' : 'h-40 w-60'
            }`}
          >
            {type === 'sticker' && !canDownload ? (
              <span className="text-4xl" title="Sticker (sin vista previa en servidor)">
                🎭
              </span>
            ) : (
              'Cargando…'
            )}
          </div>
        )}
      </div>
    );
  }

  if (type === 'video') {
    return (
      <div className="overflow-hidden rounded-md">
        {objectUrl ? (
          <video
            src={objectUrl}
            controls
            className="max-h-80 w-auto max-w-full rounded-md"
          />
        ) : (
          <div className="flex h-40 w-60 items-center justify-center rounded-md bg-black/10 text-xs text-muted-foreground">
            Cargando vídeo…
          </div>
        )}
      </div>
    );
  }

  if (type === 'audio' || type === 'voice' || type === 'ptt') {
    return objectUrl ? (
      <audio src={objectUrl} controls className="w-64" />
    ) : (
      <div className="flex h-10 w-64 items-center justify-center rounded-md bg-black/5 text-xs text-muted-foreground">
        Cargando audio…
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md bg-black/5 p-2 text-xs">
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
  const isOut = message.from_me;
  const type = (message.type ?? 'text').toLowerCase();
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
          ? `rounded-tr-none ${waTheme.bubbleOut} text-[#111b21] dark:text-emerald-50`
          : `rounded-tl-none ${waTheme.bubbleIn} text-[#111b21] dark:text-zinc-100${
              isUnread
                ? ' ring-2 ring-emerald-500/50 bg-emerald-50/90 dark:bg-emerald-950/50'
                : ''
            }`
      }`}
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
            className={`absolute top-1 hidden group-hover/bubble:flex ${
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
