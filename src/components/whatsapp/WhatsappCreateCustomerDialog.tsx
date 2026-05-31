import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWhatsappChatLink } from '@/hooks/useWhatsappChatLink';
import {
  displayNameForChat,
  extractPhoneDigitsFromJid,
  jidToDisplay,
  type MetaLeadInfo,
} from './whatsappUtils';
import type { WhatsappChatRow } from '@/hooks/useWhatsappChats';

interface Props {
  chat: WhatsappChatRow | null;
  leadName?: string;
  leadMeta?: MetaLeadInfo;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const WhatsappCreateCustomerDialog: React.FC<Props> = ({
  chat,
  leadName,
  leadMeta,
  open,
  onOpenChange,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyFilter();
  const { setLink } = useWhatsappChatLink();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [existingCustomer, setExistingCustomer] = useState<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  } | null>(null);

  useEffect(() => {
    if (!chat || !open) return;

    const load = async () => {
      const display = displayNameForChat(
        chat.chat_id,
        chat.name,
        leadName,
      );
      let initialPhone = extractPhoneDigitsFromJid(chat.chat_id) ?? '';
      let initialEmail = '';
      let initialNotes = '';

      if (chat.marketing_lead_id) {
        const { data: lead } = await supabase
          .from('marketing_leads')
          .select('first_name, last_name, phone, email, campaign, form_name, notes')
          .eq('id', chat.marketing_lead_id)
          .maybeSingle();
        if (lead) {
          const full = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim();
          if (full && (!chat.name || chat.name === display)) {
            // prefer lead name if chat name empty
          }
          if (lead.phone) initialPhone = lead.phone.replace(/\D/g, '') || initialPhone;
          if (lead.email) initialEmail = lead.email;
          const noteParts: string[] = [];
          if (leadMeta?.campaign) noteParts.push(`Campaña: ${leadMeta.campaign}`);
          if (leadMeta?.formName) noteParts.push(`Formulario: ${leadMeta.formName}`);
          if (lead.notes) noteParts.push(lead.notes);
          initialNotes = noteParts.join('\n');
        }
      }

      const phoneDisplay = jidToDisplay(chat.chat_id);
      setName(display);
      setPhone(initialPhone || phoneDisplay.replace(/^\+/, '') || '');
      setEmail(initialEmail);
      setNotes(initialNotes);
      setExistingCustomer(null);
    };

    void load();
  }, [chat, open, leadName, leadMeta]);

  useEffect(() => {
    const lookup = async () => {
      if (!companyId || !open) return;
      const normalized = phone.trim().replace(/\D/g, '');
      if (normalized.length < 6) {
        setExistingCustomer(null);
        return;
      }
      const { data, error } = await supabase
        .from('customers')
        .select('id, name, phone, phone_mobile, phone_home, email')
        .eq('company_id', companyId)
        .or(
          `phone.ilike.%${normalized.slice(-9)}%,phone_mobile.ilike.%${normalized.slice(-9)}%,phone_home.ilike.%${normalized.slice(-9)}%`,
        )
        .limit(1);
      if (error || !data?.length) {
        setExistingCustomer(null);
        return;
      }
      const c = data[0];
      setExistingCustomer({
        id: c.id,
        name: c.name,
        phone: c.phone ?? c.phone_mobile ?? c.phone_home,
        email: c.email,
      });
    };
    const t = setTimeout(() => void lookup(), 300);
    return () => clearTimeout(t);
  }, [companyId, open, phone]);

  const linkToExisting = async () => {
    if (!chat || !existingCustomer) return;
    try {
      await setLink.mutateAsync({
        chat_id: chat.chat_id,
        customer_id: existingCustomer.id,
      });
      toast({ title: 'Chat vinculado al cliente existente' });
      onOpenChange(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo vincular';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !chat) throw new Error('Sin empresa o chat');
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error('El nombre es obligatorio');

      const { data: created, error } = await supabase
        .from('customers')
        .insert({
          company_id: companyId,
          name: trimmedName,
          phone: phone.trim() || null,
          email: email.trim() || null,
          notes: notes.trim() || null,
        } as never)
        .select('id, name')
        .single();
      if (error) throw error;

      await setLink.mutateAsync({
        chat_id: chat.chat_id,
        customer_id: created.id,
      });

      if (chat.marketing_lead_id) {
        await supabase
          .from('marketing_leads')
          .update({ customer_id: created.id })
          .eq('id', chat.marketing_lead_id);
      }

      return created;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-chats', companyId] });
      queryClient.invalidateQueries({ queryKey: ['whatsapp-link-customers', companyId] });
      toast({ title: 'Cliente creado', description: created?.name });
      onOpenChange(false);
    },
    onError: (e) => {
      const any = e as { code?: string; message?: string };
      if (any?.code === '23505') {
        toast({
          title: 'Ya existe un cliente con este teléfono',
          description: 'Usa «Vincular a cliente existente» si aparece arriba.',
          variant: 'destructive',
        });
        return;
      }
      const msg = e instanceof Error ? e.message : 'Error al crear cliente';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    },
  });

  if (!chat) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-emerald-600" />
            Crear cliente
          </DialogTitle>
          <DialogDescription>
            Se creará un cliente con los datos del chat y quedará vinculado a esta conversación.
          </DialogDescription>
        </DialogHeader>

        {existingCustomer ? (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <div>
                  <p className="font-semibold">Este teléfono ya está en un cliente</p>
                  <p>
                    <strong>{existingCustomer.name}</strong>
                    {existingCustomer.phone ? ` · ${existingCustomer.phone}` : ''}
                  </p>
                </div>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={linkToExisting}>
                Vincular existente
              </Button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="wa-cust-name">Nombre</Label>
            <Input
              id="wa-cust-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa-cust-phone">Teléfono</Label>
            <Input
              id="wa-cust-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa-cust-email">Email</Label>
            <Input
              id="wa-cust-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa-cust-notes">Notas</Label>
            <Textarea
              id="wa-cust-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !name.trim()}
          >
            {createMutation.isPending ? 'Creando…' : 'Crear y vincular'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
