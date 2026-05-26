import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UserPlus, ExternalLink, AlertTriangle } from 'lucide-react';
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
  const [existingCustomer, setExistingCustomer] = useState<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  } | null>(null);

  useEffect(() => {
    if (lead && open) {
      const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim();
      setName(fullName || lead.email || lead.phone || '');
      setPhone(lead.phone ?? '');
      setEmail(lead.email ?? '');
      setTaxId('');
      setCity('');
      setNotes(buildNotes(lead));
      setExistingCustomer(null);
    }
  }, [lead, open]);

  useEffect(() => {
    const lookup = async () => {
      if (!companyId || !open) return;
      const normalized = phone.trim().replace(/\D/g, '');
      if (!normalized) {
        setExistingCustomer(null);
        return;
      }
      const { data, error } = await supabase
        .from('customers')
        .select('id,name,phone,phone_mobile,phone_home,email')
        .eq('company_id', companyId)
        .or(
          [
            'phone',
            'phone_mobile',
            'phone_home',
          ]
            .map((col) => `${col}.ilike.%${normalized.slice(-7)}%`)
            .join(','),
        );
      if (error) {
        console.warn('Error buscando cliente por teléfono', error);
        setExistingCustomer(null);
        return;
      }
      const first = (data ?? [])[0] as
        | { id: string; name: string; phone?: string | null; phone_mobile?: string | null; phone_home?: string | null; email?: string | null }
        | undefined;
      if (!first) {
        setExistingCustomer(null);
        return;
      }
      setExistingCustomer({
        id: first.id,
        name: first.name,
        phone: first.phone_mobile || first.phone || first.phone_home || null,
        email: first.email ?? null,
      });
    };
    void lookup();
  }, [companyId, open, phone]);

  const linkToExistingCustomer = async () => {
    if (!lead || !existingCustomer) return;
    try {
      const { error } = await supabase
        .from('marketing_leads')
        .update({ customer_id: existingCustomer.id })
        .eq('id', lead.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-lookup', companyId] });
      queryClient.invalidateQueries({ queryKey: ['marketing-leads', companyId] });
      toast({
        title: 'Lead vinculado a cliente existente',
        description: existingCustomer.name,
      });
      onOpenChange(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error al vincular con cliente existente';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

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
      const any = e as { code?: string; message?: string };
      if (any?.code === '23505') {
        toast({
          title: 'Ya existe un cliente con este teléfono',
          description:
            'Si ves el aviso de arriba, usa «Vincular lead a este cliente». Si no, revisa que el número no esté ya en la base.',
          variant: 'destructive',
        });
        return;
      }
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

        {existingCustomer ? (
          <div className="mb-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
                <div>
                  <p className="font-semibold text-[11px] uppercase tracking-wide">
                    Este teléfono ya está asociado a un cliente
                  </p>
                  <p className="text-[11px]">
                    <strong>{existingCustomer.name}</strong>
                    {existingCustomer.phone ? ` · ${existingCustomer.phone}` : ''}
                    {existingCustomer.email ? ` · ${existingCustomer.email}` : ''}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex gap-2 sm:mt-0 sm:flex-shrink-0">
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={linkToExistingCustomer}
                >
                  Vincular lead a este cliente
                </Button>
              </div>
            </div>
          </div>
        ) : null}

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
