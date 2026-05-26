import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { invokeWhatsappProxy } from '@/hooks/useWhatsappConfig';
import { useToast } from '@/hooks/use-toast';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCountryCode?: string | null;
  onCreated: (chatId: string) => void;
}

function buildJid(input: string, defaultCountryCode: string | null | undefined) {
  let s = input.trim();
  if (!s) return null;
  if (s.includes('@')) return s;
  s = s.replace(/[^0-9]/g, '');
  if (!s) return null;
  if (defaultCountryCode && s.length <= 9) s = `${defaultCountryCode}${s}`;
  return `${s}@c.us`;
}

export const WhatsappNewChatDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  defaultCountryCode,
  onCreated,
}) => {
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setPhone('');
    setName('');
    setText('');
  };

  const handleSubmit = async () => {
    const jid = buildJid(phone, defaultCountryCode);
    if (!jid) {
      toast({ title: 'Introduce un número válido', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      if (text.trim()) {
        await invokeWhatsappProxy({
          action: 'messages.send',
          chat_id: jid,
          type: 'text',
          text: text.trim(),
        });
      } else {
        // Sin mensaje inicial: igualmente creamos el chat localmente para
        // poder abrirlo. El webhook actualizará cuando el destinatario responda.
      }
      onCreated(jid);
      onOpenChange(false);
      reset();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo crear el chat';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nuevo chat</DialogTitle>
          <DialogDescription>
            Introduce el número de teléfono al que quieres escribir. Si no
            incluyes prefijo se usará +{defaultCountryCode ?? '34'}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="wa-new-phone">Teléfono</Label>
            <Input
              id="wa-new-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+34 666 777 888"
              inputMode="tel"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wa-new-name">Nombre (opcional)</Label>
            <Input
              id="wa-new-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="María García"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="wa-new-text">Mensaje inicial (opcional)</Label>
            <Input
              id="wa-new-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Hola María, te escribo desde…"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Creando…' : text.trim() ? 'Enviar y abrir' : 'Abrir chat'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
