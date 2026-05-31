import React, { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { WhatsappAvatar } from './WhatsappAvatar';
import {
  displayNameForChat,
  isSystemChatJid,
  jidToDisplay,
  waTheme,
} from './whatsappUtils';
import type { WhatsappChatRow } from '@/hooks/useWhatsappChats';
import type { WhatsappMessageRow } from '@/hooks/useWhatsappMessages';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: WhatsappMessageRow | null;
  chats: WhatsappChatRow[];
  currentChatId: string;
  leadNameById?: Record<string, string>;
  forwarding?: boolean;
  onForward: (destinationChatId: string) => Promise<void>;
}

export const WhatsappForwardDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  message,
  chats,
  currentChatId,
  leadNameById = {},
  forwarding,
  onForward,
}) => {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chats
      .filter((c) => !isSystemChatJid(c.chat_id))
      .filter((c) => c.chat_id !== currentChatId)
      .filter((c) => {
        if (!q) return true;
        const leadName = c.marketing_lead_id
          ? leadNameById[c.marketing_lead_id]
          : undefined;
        const name = displayNameForChat(c.chat_id, c.name, leadName).toLowerCase();
        const phone = jidToDisplay(c.chat_id).toLowerCase();
        return name.includes(q) || phone.includes(q) || c.chat_id.toLowerCase().includes(q);
      })
      .slice(0, 80);
  }, [chats, currentChatId, leadNameById, query]);

  const reset = () => {
    setQuery('');
    setSelectedId(null);
  };

  const handleForward = async () => {
    if (!selectedId) return;
    await onForward(selectedId);
    onOpenChange(false);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reenviar mensaje</DialogTitle>
          <DialogDescription>
            Elige el chat al que quieres reenviar
            {message?.waha_message_id ? '' : ' (mensaje sin ID de Waha)'}.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar chat…"
          disabled={!message?.waha_message_id || forwarding}
        />
        <ScrollArea className="h-64 rounded-md border">
          <div className="p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                No hay chats disponibles.
              </p>
            ) : (
              filtered.map((c) => {
                const leadName = c.marketing_lead_id
                  ? leadNameById[c.marketing_lead_id]
                  : undefined;
                const name = displayNameForChat(c.chat_id, c.name, leadName);
                const active = selectedId === c.chat_id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={!message?.waha_message_id || forwarding}
                    onClick={() => setSelectedId(c.chat_id)}
                    className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors ${
                      active ? waTheme.chatActive : waTheme.chatHover
                    }`}
                  >
                    <WhatsappAvatar
                      name={name}
                      pictureUrl={c.profile_picture_url}
                      isGroup={c.is_group}
                      className="h-9 w-9 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{name}</p>
                      <p className={`truncate text-xs ${waTheme.textMuted}`}>
                        {jidToDisplay(c.chat_id) || c.chat_id}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </ScrollArea>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={forwarding}>
            Cancelar
          </Button>
          <Button
            onClick={handleForward}
            disabled={!selectedId || !message?.waha_message_id || forwarding}
          >
            {forwarding ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Reenviando…
              </>
            ) : (
              'Reenviar'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
