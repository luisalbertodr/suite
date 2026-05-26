import React from 'react';
import { Check, CheckCheck, Clock, AlertCircle, FileText, Download } from 'lucide-react';
import type { WhatsappMessageRow } from '@/hooks/useWhatsappMessages';
import {
  formatMessageTime,
  ackLabel,
  extractBodyFromWahaMessageRaw,
  extractMediaUrlFromWahaMessageRaw,
  jidToDisplay,
} from './whatsappUtils';
import { supabase } from '@/lib/supabase';

interface Props {
  message: WhatsappMessageRow;
  /** Si el chat es grupo, mostramos remitente en mensajes entrantes. */
  isGroupChat?: boolean;
}

const AckIcon: React.FC<{ ack: number }> = ({ ack }) => {
  if (ack <= 0) return <Clock className="h-3.5 w-3.5 text-emerald-50/70" aria-label="Pendiente" />;
  if (ack === 1) return <Check className="h-3.5 w-3.5 text-emerald-50/80" aria-label="Enviado" />;
  if (ack === 2) return <CheckCheck className="h-3.5 w-3.5 text-emerald-50/80" aria-label="Entregado" />;
  if (ack === 3 || ack === 4)
    return <CheckCheck className="h-3.5 w-3.5 text-sky-300" aria-label="Leído" />;
  return <AlertCircle className="h-3.5 w-3.5 text-rose-200" aria-label="Error" />;
};

function MediaContent({ message }: { message: WhatsappMessageRow }) {
  const type = (message.type ?? 'text').toLowerCase();
  const rawStickerUrl = extractMediaUrlFromWahaMessageRaw(message.raw);
  const effectiveUrl = message.media_url || rawStickerUrl || null;
  const hasUrl = !!effectiveUrl;
  const proxyUrl =
    hasUrl && effectiveUrl
      ? // Proxy via edge function; el frontend hace fetch con su Authorization
        effectiveUrl
      : null;

  // Como `media_url` desde Waha NO es accesible directamente desde el browser
  // (suele ser local al server Waha), el componente usa un loader que descarga
  // vía supabase.functions.invoke. Pero para imagen/video conviene un <img>
  // con un objectURL ya resuelto. Lo hacemos lazy: si media_url contiene el
  // host de Waha, lo cargamos por proxy; si no, lo usamos como está.
  const [objectUrl, setObjectUrl] = React.useState<string | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    let revoke: string | null = null;
    const load = async () => {
      if (!proxyUrl) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const res = await supabase.functions.invoke('whatsapp-proxy', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: { action: 'media.download', url: proxyUrl },
        });
        if (cancelled) return;
        if (res.error || !res.data) return;
        const blob =
          res.data instanceof Blob
            ? res.data
            : new Blob([res.data as ArrayBuffer], {
                type: message.media_mime_type ?? 'application/octet-stream',
              });
        const url = URL.createObjectURL(blob);
        revoke = url;
        setObjectUrl(url);
      } catch {
        // ignoramos: dejamos el placeholder
      }
    };
    load();
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [proxyUrl, message.media_mime_type]);

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
            {type === 'sticker' && !proxyUrl ? (
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

  // Document u otros: tarjeta con icono y nombre.
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

function senderLabel(message: WhatsappMessageRow): string | null {
  if (message.from_me) return null;
  const raw = message.raw as Record<string, unknown> | null | undefined;
  const pn = raw && typeof raw.pushName === 'string' ? raw.pushName.trim() : '';
  if (pn) return pn;
  return message.from_jid ? jidToDisplay(message.from_jid) : null;
}

export const WhatsappMessageBubble: React.FC<Props> = ({ message, isGroupChat }) => {
  const isOut = message.from_me;
  const type = (message.type ?? 'text').toLowerCase();
  const isMedia = type !== 'text' && type !== 'chat';
  const time = formatMessageTime(message.timestamp);
  const rawText = extractBodyFromWahaMessageRaw(message.raw);
  const textLine =
    message.body?.trim() ||
    message.caption?.trim() ||
    rawText ||
    '';
  const groupSender = isGroupChat && !isOut ? senderLabel(message) : null;

  return (
    <div className={`flex w-full ${isOut ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`group relative max-w-[78%] rounded-xl px-2.5 py-1.5 text-sm shadow-sm md:max-w-[65%] ${
          isOut
            ? 'rounded-tr-sm bg-[#d9fdd3] text-zinc-900 dark:bg-emerald-900 dark:text-emerald-50'
            : 'rounded-tl-sm bg-white text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100'
        }`}
      >
        {groupSender ? (
          <p className="mb-0.5 text-[11px] font-semibold text-sky-600 dark:text-sky-400">
            {groupSender}
          </p>
        ) : null}
        {isMedia ? (
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
              ? 'text-emerald-900/60 dark:text-emerald-100/70'
              : 'text-zinc-500 dark:text-zinc-400'
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
    </div>
  );
};
