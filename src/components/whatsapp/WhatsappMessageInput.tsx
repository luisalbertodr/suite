import React, { useRef, useState } from 'react';
import { Send, Paperclip, Smile, Image as ImageIcon, FileText, Loader2 } from 'lucide-react';
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
import { fileToBase64, mediaKindFromMime } from './whatsappUtils';
import { WHATSAPP_EMOJI_GRID } from './whatsappEmojis';
import type { SendMessageInput } from '@/hooks/useWhatsappMessages';

interface Props {
  disabled?: boolean;
  sending?: boolean;
  onSend: (input: SendMessageInput) => Promise<void> | void;
}

const MAX_FILE_BYTES = 15 * 1024 * 1024;

export const WhatsappMessageInput: React.FC<Props> = ({
  disabled,
  sending,
  onSend,
}) => {
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const sendText = async () => {
    const value = text.trim();
    if (!value || disabled) return;
    try {
      await onSend({
        chat_id: '__current__',
        type: 'text',
        text: value,
      } as unknown as SendMessageInput);
      setText('');
      requestAnimationFrame(() => textareaRef.current?.focus());
    } catch (e) {
      // El padre ya muestra toast, pero por seguridad
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
      const base64 = await fileToBase64(file);
      const kind = mediaKindFromMime(file.type);
      await onSend({
        chat_id: '__current__',
        type: kind,
        media_base64: base64,
        mime_type: file.type || 'application/octet-stream',
        filename: file.name,
        caption: text.trim() || undefined,
      } as unknown as SendMessageInput);
      setText('');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo enviar el archivo';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  return (
    <div className="border-t border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
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
        aria-label="Seleccionar documento"
        title="Seleccionar documento"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          handleFile(f ?? undefined);
          if (e.target) e.target.value = '';
        }}
      />
      <div className="flex items-end gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full"
              disabled={disabled || sending}
            >
              <Paperclip className="h-5 w-5 text-zinc-500" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start">
            <DropdownMenuItem onSelect={() => imageInputRef.current?.click()}>
              <ImageIcon className="mr-2 h-4 w-4" /> Imagen o vídeo
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => fileInputRef.current?.click()}>
              <FileText className="mr-2 h-4 w-4" /> Documento
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full"
              disabled={disabled || sending}
              title="Emojis"
            >
              <Smile className="h-5 w-5 text-zinc-500" />
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
          className="min-h-[40px] flex-1 resize-none rounded-2xl border-0 bg-white px-4 py-2 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-emerald-500 dark:bg-zinc-800"
        />

        <Button
          type="button"
          onClick={sendText}
          disabled={disabled || sending || !text.trim()}
          className="h-10 w-10 shrink-0 rounded-full bg-emerald-600 p-0 hover:bg-emerald-700"
          title="Enviar"
        >
          {sending ? (
            <Loader2 className="h-5 w-5 animate-spin text-white" />
          ) : (
            <Send className="h-4 w-4 text-white" />
          )}
        </Button>
      </div>
    </div>
  );
};
