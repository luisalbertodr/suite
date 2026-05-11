import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, ExternalLink } from 'lucide-react';
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
import type { MarketingLead } from '@/hooks/useMarketingLeads';
import { humanizeFieldKey } from './marketingFormatters';

interface MarketingPromoteToCustomerDialogProps {
  lead: MarketingLead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const buildNotes = (lead: MarketingLead): string => {
  const parts: string[] = [];
  if (lead.form_name) parts.push(`Formulario: ${lead.form_name}`);
  if (lead.campaign) parts.push(`Campaña: ${lead.campaign}`);
  if (lead.source) parts.push(`Origen: ${lead.source}`);
  if (lead.external_created_at) {
    parts.push(`Creado en Meta: ${new Date(lead.external_created_at).toLocaleString('es-ES')}`);
  }
  const fd = Array.isArray(lead.field_data)
    ? (lead.field_data as Array<{ name: string; values?: string[] }>)
    : [];
  if (fd.length > 0) {
    parts.push('');
    parts.push('— Respuestas del formulario —');
    for (const f of fd) {
      const value = (f.values ?? []).filter(Boolean).join(', ');
      if (value) parts.push(`• ${humanizeFieldKey(f.name)}: ${value}`);
    }
  }
  if (lead.notes) {
    parts.push('');
    parts.push('— Notas del lead —');
    parts.push(lead.notes);
  }
  return parts.join('\n');
};

export const MarketingPromoteToCustomerDialog: React.FC<MarketingPromoteToCustomerDialogProps> = ({
  lead,
  open,
  onOpenChange,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyFilter();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [taxId, setTaxId] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (lead && open) {
      const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim();
      setName(fullName || lead.email || lead.phone || '');
      setPhone(lead.phone ?? '');
      setEmail(lead.email ?? '');
      setTaxId('');
      setCity('');
      setNotes(buildNotes(lead));
    }
  }, [lead, open]);

  const createCustomerMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('Sin empresa');
      if (!lead) throw new Error('Sin lead');
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error('El nombre es obligatorio');

      const insertPayload = {
        company_id: companyId,
        name: trimmedName,
        phone: phone.trim() || null,
        email: email.trim() || null,
        tax_id: taxId.trim() || null,
        address_city: city.trim() || null,
        notes: notes.trim() || null,
      };

      const { data: created, error } = await supabase
        .from('customers')
        .insert(insertPayload as never)
        .select('id, name')
        .single();
      if (error) throw error;

      const { error: linkError } = await supabase
        .from('marketing_leads')
        .update({ customer_id: created.id })
        .eq('id', lead.id);
      if (linkError) {
        console.warn('No se pudo vincular el lead al cliente', linkError);
      }

      return created;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-lookup', companyId] });
      queryClient.invalidateQueries({ queryKey: ['marketing-leads', companyId] });
      toast({ title: 'Cliente creado', description: created?.name });
      onOpenChange(false);
    },
    onError: (e) => {
      const message = e instanceof Error ? e.message : 'Error al crear cliente';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    },
  });

  if (!lead) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-emerald-600" />
            Crear cliente desde lead
          </DialogTitle>
          <DialogDescription>
            Revisa y completa los datos. Al guardar, el lead quedará vinculado al nuevo cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="promote-name">Nombre completo *</Label>
            <Input
              id="promote-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre y apellidos"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="promote-phone">Teléfono</Label>
            <Input id="promote-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="promote-email">Email</Label>
            <Input
              id="promote-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="promote-taxid">DNI / NIF</Label>
            <Input id="promote-taxid" value={taxId} onChange={(e) => setTaxId(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="promote-city">Ciudad</Label>
            <Input id="promote-city" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="promote-notes">Notas (origen del lead + respuestas)</Label>
            <Textarea
              id="promote-notes"
              rows={6}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="text-xs font-mono"
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            <ExternalLink className="mr-1 inline h-3 w-3" />
            Si necesitas más campos (dirección, facturación…), edita el cliente después en la pestaña Clientes.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createCustomerMutation.mutate()}
              disabled={createCustomerMutation.isPending || !name.trim()}
            >
              {createCustomerMutation.isPending ? 'Creando…' : 'Crear cliente y vincular'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
