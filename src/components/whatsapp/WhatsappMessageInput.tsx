import React, { useEffect, useRef, useState } from 'react';
import {
  Send,
  Paperclip,
  Smile,
  Image as ImageIcon,
  FileText,
  Loader2,
  Mic,
  X,
  Music,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { assertWhatsappVoiceNoteFile, fileToBase64, mediaKindFromMime, messagePreviewText, resolveWhatsappFileMime } from './whatsappUtils';
import { useWhatsappTheme } from './WhatsappThemeContext';
import { WHATSAPP_EMOJI_GRID } from './whatsappEmojis';
import type { SendMessageInput, WhatsappMessageRow } from '@/hooks/useWhatsappMessages';

interface Props {
  disabled?: boolean;
  sending?: boolean;
  replyTo?: WhatsappMessageRow | null;
  onClearReply?: () => void;
  onSend: (input: SendMessageInput) => Promise<void> | void;
}

const MAX_FILE_BYTES = 15 * 1024 * 1024;

function formatRecordingTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const WhatsappMessageInput: React.FC<Props> = ({
  disabled,
  sending,
  replyTo,
  onClearReply,
  onSend,
}) => {
  const theme = useWhatsappTheme();
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      mediaRecorderRef.current?.stop();
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const replyId = replyTo?.waha_message_id ?? undefined;

  const buildSendPayload = (
    base: Omit<SendMessageInput, 'chat_id' | 'reply_to_message_id'>,
  ): SendMessageInput =>
    ({
      chat_id: '__current__',
      ...base,
      ...(replyId ? { reply_to_message_id: replyId } : {}),
    }) as SendMessageInput;

  const sendText = async () => {
    const value = text.trim();
    if (!value || disabled) return;
    try {
      await onSend(buildSendPayload({ type: 'text', text: value }));
      setText('');
      onClearReply?.();
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo enviar';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendText();
    }
  };

  const insertAtCursor = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) {
      setText((t) => t + emoji);
      setEmojiOpen(false);
      return;
    }
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    setEmojiOpen(false);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast({
        title: 'Archivo demasiado grande',
        description: 'El máximo permitido son 15 MB.',
        variant: 'destructive',
      });
      return;
    }
    try {
      await assertWhatsappVoiceNoteFile(file);
      const base64 = await fileToBase64(file);
      const mime = resolveWhatsappFileMime(file.name, file.type);
      const kind = mediaKindFromMime(mime);
      await onSend(
        buildSendPayload({
          type: kind,
          media_base64: base64,
          mime_type: mime,
          filename: file.name,
          caption: text.trim() || undefined,
        }),
      );
      setText('');
      onClearReply?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo enviar el archivo';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  const stopRecordingTracks = () => {
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    mediaStreamRef.current = null;
  };

  const stopRecordingTimer = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = async () => {
    if (disabled || sending || isRecording) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      toast({
        title: 'Micrófono no disponible',
        description: 'Tu navegador no permite grabar audio.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      chunksRef.current = [];
      const mimeType = [
        'audio/ogg;codecs=opus',
        'audio/webm;codecs=opus',
        'audio/webm',
      ].find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.start(250);
      setRecordingSeconds(0);
      setIsRecording(true);
      timerRef.current = window.setInterval(() => {
        setRecordingSeconds((s) => s + 1);
      }, 1000);
    } catch {
      stopRecordingTracks();
      toast({
        title: 'No se pudo acceder al micrófono',
        variant: 'destructive',
      });
    }
  };

  const cancelRecording = () => {
    stopRecordingTimer();
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    stopRecordingTracks();
    chunksRef.current = [];
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const finishRecording = async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      cancelRecording();
      return;
    }
    const blob = await new Promise<Blob>((resolve, reject) => {
      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm';
        resolve(new Blob(chunksRef.current, { type }));
      };
      recorder.onerror = () => reject(new Error('Error al grabar'));
      recorder.stop();
    }).finally(() => {
      stopRecordingTimer();
      stopRecordingTracks();
      mediaRecorderRef.current = null;
      chunksRef.current = [];
      setIsRecording(false);
      setRecordingSeconds(0);
    });

    if (blob.size < 1) {
      toast({ title: 'Grabación vacía', variant: 'destructive' });
      return;
    }
    if (blob.size > MAX_FILE_BYTES) {
      toast({
        title: 'Nota de voz demasiado larga',
        description: 'El máximo permitido son 15 MB.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const ext = blob.type.includes('ogg') || blob.type.includes('opus') ? 'ogg' : 'webm';
      const base64 = await fileToBase64(
        new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type }),
      );
      if (
        ext === 'webm' &&
        !blob.type.includes('ogg') &&
        !blob.type.includes('opus')
      ) {
        toast({
          title: 'Formato no compatible con OpenWA',
          description:
            'La grabación del navegador es WebM. Adjunta un archivo .ogg o usa Firefox para grabar notas de voz.',
          variant: 'destructive',
        });
        return;
      }
      await onSend(
        buildSendPayload({
          type: 'voice',
          media_base64: base64,
          mime_type: blob.type || 'audio/ogg',
          filename: `voice-${Date.now()}.${ext}`,
        }),
      );
      onClearReply?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo enviar la nota de voz';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  return (
    <footer
      className={`z-10 flex shrink-0 flex-col border-t pb-[env(safe-area-inset-bottom)] ${theme.headerBg} ${theme.border}`}
    >
      {replyTo ? (
        <div className="flex items-center gap-2 border-b border-[#e9edef] px-4 py-2 dark:border-zinc-800">
          <div className="min-w-0 flex-1 border-l-4 border-emerald-600 pl-2">
            <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              Respondiendo
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {messagePreviewText(replyTo)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onClearReply}
            title="Cancelar respuesta"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : null}

      <div className="wa-send-bar mx-3 mb-2 mt-1 flex h-[52px] items-center gap-3 px-3">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*,video/*"
          aria-label="Seleccionar imagen o vídeo"
          title="Seleccionar imagen o vídeo"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            handleFile(f ?? undefined);
            if (e.target) e.target.value = '';
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,application/*"
          aria-label="Seleccionar documento"
          title="Seleccionar documento"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            handleFile(f ?? undefined);
            if (e.target) e.target.value = '';
          }}
        />
        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*,.ogg,.opus,application/ogg"
          aria-label="Seleccionar audio"
          title="Seleccionar audio (OGG, MP3, M4A…)"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            handleFile(f ?? undefined);
            if (e.target) e.target.value = '';
          }}
        />

        {isRecording ? (
          <div className="flex flex-1 items-center gap-3">
            <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <span className="text-sm tabular-nums text-red-600">
              {formatRecordingTime(recordingSeconds)}
            </span>
            <span className="flex-1 text-sm text-muted-foreground">Grabando nota de voz…</span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={cancelRecording}
              title="Cancelar"
            >
              <X className="h-5 w-5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-emerald-700"
              onClick={finishRecording}
              disabled={sending}
              title="Enviar nota de voz"
            >
              {sending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        ) : (
          <div className="flex flex-1 items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={`h-9 w-9 shrink-0 rounded-full ${theme.textIcon}`}
                  disabled={disabled || sending}
                >
                  <Paperclip className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start">
                <DropdownMenuItem onSelect={() => imageInputRef.current?.click()}>
                  <ImageIcon className="mr-2 h-4 w-4" /> Imagen o vídeo
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
                  <FileText className="mr-2 h-4 w-4" /> Documento
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => audioInputRef.current?.click()}>
                  <Music className="mr-2 h-4 w-4" /> Audio / nota de voz (.ogg)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={`h-9 w-9 shrink-0 rounded-full ${theme.textIcon}`}
                  disabled={disabled || sending}
                  title="Emojis"
                >
                  <Smile className="h-5 w-5" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="start"
                className="w-[min(100vw-2rem,22rem)] p-2"
              >
                <p className="mb-2 px-1 text-[11px] font-medium text-muted-foreground">
                  Emojis
                </p>
                <ScrollArea className="h-[min(40vh,16rem)]">
                  <div className="grid grid-cols-8 gap-0.5 pr-2">
                    {WHATSAPP_EMOJI_GRID.map((e) => (
                      <button
                        key={e}
                        type="button"
                        className="flex h-9 w-9 items-center justify-center rounded-md text-xl hover:bg-zinc-100 dark:hover:bg-zinc-800"
                        onClick={() => insertAtCursor(e)}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>

            <Textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={disabled ? 'Selecciona un chat…' : 'Escribe un mensaje'}
              disabled={disabled || sending}
              rows={1}
              className={`min-h-[42px] max-h-32 flex-1 resize-none rounded-lg border-0 px-3 py-2 text-sm shadow-none outline-none placeholder:text-[#667781] focus-visible:ring-1 focus-visible:ring-[#25d366] ${theme.inputBg}`}
            />

            {text.trim() ? (
              <Button
                type="button"
                onClick={sendText}
                disabled={disabled || sending}
                variant="ghost"
                size="icon"
                className={`h-9 w-9 shrink-0 rounded-full ${theme.textIcon} hover:bg-black/5`}
                title="Enviar"
              >
                {sending ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Send className="h-5 w-5" />
                )}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={startRecording}
                disabled={disabled || sending}
                variant="ghost"
                size="icon"
                className={`h-9 w-9 shrink-0 rounded-full ${theme.textIcon} hover:bg-black/5`}
                title="Grabar nota de voz"
              >
                <Mic className="h-5 w-5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </footer>
  );
};
