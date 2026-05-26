import React, { useEffect, useState } from 'react';
import { Phone, Mail, MessageCircle, Trash2, Archive, UserCheck, CalendarClock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '@/hooks/usePermissions';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { MarketingLead } from '@/hooks/useMarketingLeads';
import { useMarketingLeads } from '@/hooks/useMarketingLeads';
import type { MarketingLeadStage } from '@/hooks/useMarketingStages';
import type { CustomerLookupRow } from '@/hooks/useCustomerLookup';
import { formatLeadFieldValue, humanizeFieldKey } from './marketingFormatters';
import { MarketingLeadNotesPanel } from './MarketingLeadNotesPanel';
import { resolveLeadAppointmentParts } from '@/lib/marketingLeadAppointment';

interface MarketingLeadDetailDialogProps {
  lead: MarketingLead | null;
  stages: MarketingLeadStage[];
  matchedCustomer: CustomerLookupRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MarketingLeadDetailDialog: React.FC<MarketingLeadDetailDialogProps> = ({
  lead,
  stages,
  matchedCustomer,
  open,
  onOpenChange,
}) => {
  const { toast } = useToast();
  const { updateLead, deleteLead, archiveLead } = useMarketingLeads();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const canUseWhatsapp = hasPermission('whatsapp', 'read');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [value, setValue] = useState('');
  const [stageId, setStageId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (lead) {
      setFirstName(lead.first_name ?? '');
      setLastName(lead.last_name ?? '');
      setPhone(lead.phone ?? '');
      setEmail(lead.email ?? '');
      setValue(lead.value != null ? String(lead.value) : '0');
      setStageId(lead.stage_id ?? null);
      setNotes(lead.notes ?? '');
    }
  }, [lead]);

  if (!lead) return null;

  const extraFields = Array.isArray(lead.field_data)
    ? (lead.field_data as Array<{ name: string; values?: string[] }>)
    : [];

  const phoneHref = phone ? `tel:${phone.replace(/\s+/g, '')}` : undefined;
  const emailHref = email ? `mailto:${email}` : undefined;
  const waExternalHref = phone ? `https://wa.me/${phone.replace(/\D/g, '')}` : undefined;
  const fullLeadName = [firstName, lastName].filter(Boolean).join(' ').trim();

  const { atIso: resolvedApptIso, label: resolvedApptLabel } = resolveLeadAppointmentParts(lead);
  const hasFictitiousAppointment = !!(resolvedApptIso || resolvedApptLabel);
  const fictitiousAppointmentText =
    resolvedApptIso
      ? new Intl.DateTimeFormat('es-ES', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }).format(new Date(resolvedApptIso))
      : resolvedApptLabel ?? '';
  const handleOpenWhatsapp = () => {
    if (!phone) return;
    if (canUseWhatsapp) {
      const params = new URLSearchParams();
      params.set('phone', phone);
      if (fullLeadName) params.set('name', fullLeadName);
      onOpenChange(false);
      navigate(`/whatsapp?${params.toString()}`);
    } else if (waExternalHref) {
      window.open(waExternalHref, '_blank', 'noreferrer');
    }
  };

  const handleSave = async () => {
    try {
      await updateLead.mutateAsync({
        id: lead.id,
        values: {
          first_name: firstName.trim() || null,
          last_name: lastName.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          value: Number(value) || 0,
          stage_id: stageId,
          notes: notes.trim() || null,
        },
      });
      toast({ title: 'Lead actualizado' });
      onOpenChange(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error al guardar';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleArchive = async () => {
    try {
      await archiveLead.mutateAsync(lead.id);
      toast({ title: 'Lead archivado' });
      onOpenChange(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error al archivar';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('¿Eliminar este lead permanentemente? Esta acción no se puede deshacer.')) {
      return;
    }
    try {
      await deleteLead.mutateAsync(lead.id);
      toast({ title: 'Lead eliminado' });
      onOpenChange(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error al eliminar';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalle del lead</DialogTitle>
          <DialogDescription>
            {lead.source ? `Origen: ${lead.source}` : null}
            {lead.form_name ? ` · Formulario: ${lead.form_name}` : null}
          </DialogDescription>
        </DialogHeader>

        {hasFictitiousAppointment ? (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-800 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100">
            <div className="flex items-center gap-2 min-w-0">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-600 text-white">
                <CalendarClock className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide">
                  Cita marcada en el formulario (ficticia)
                </p>
                <p className="truncate text-[11px] font-medium" title={fictitiousAppointmentText}>
                  {fictitiousAppointmentText || 'Sin texto de franja horaria'}
                </p>
              </div>
            </div>
            <p className="hidden sm:block text-[10px] text-sky-900/80 dark:text-sky-100/80 max-w-[220px] text-right">
              Esta cita indica la preferencia del lead en Meta. Las citas reales se gestionan desde la agenda y pueden tener otro horario.
            </p>
          </div>
        ) : null}

        {matchedCustomer ? (
          <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            <UserCheck className="h-4 w-4" />
            <span>
              Vinculado al cliente:{' '}
              <span className="font-semibold">{matchedCustomer.name}</span>
              {matchedCustomer.phone ? ` · ${matchedCustomer.phone}` : ''}
            </span>
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="lead-first-name">Nombre</Label>
            <Input id="lead-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead-last-name">Apellidos</Label>
            <Input id="lead-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead-phone">Teléfono</Label>
            <div className="flex gap-1">
              <Input id="lead-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
              {phoneHref ? (
                <Button asChild variant="outline" size="icon">
                  <a href={phoneHref} title="Llamar" aria-label="Llamar">
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                </Button>
              ) : null}
              {phone ? (
                <Button
                  variant="outline"
                  size="icon"
                  type="button"
                  title={canUseWhatsapp ? 'Abrir conversación de WhatsApp' : 'WhatsApp (wa.me)'}
                  aria-label="WhatsApp"
                  onClick={handleOpenWhatsapp}
                  className="text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-emerald-950"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead-email">Email</Label>
            <div className="flex gap-1">
              <Input id="lead-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              {emailHref ? (
                <Button asChild variant="outline" size="icon">
                  <a href={emailHref} title="Enviar email" aria-label="Enviar email">
                    <Mail className="h-3.5 w-3.5" />
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead-value">Valor del cliente (€)</Label>
            <Input
              id="lead-value"
              type="number"
              step="0.01"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Etapa</Label>
            <Select value={stageId ?? ''} onValueChange={(v) => setStageId(v || null)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona etapa" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="lead-notes">Notas internas</Label>
            <Textarea
              id="lead-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotaciones, recordatorios, etc."
            />
          </div>
        </div>

        {extraFields.length > 0 ? (
          <div className="mt-4 rounded-lg border bg-muted/30 p-3">
            <h4 className="mb-2 text-sm font-semibold">Respuestas del formulario</h4>
            <dl className="space-y-2 text-xs">
              {extraFields.map((f) => (
                <div key={f.name} className="grid gap-1 md:grid-cols-[1fr_2fr] md:gap-3">
                  <dt className="text-muted-foreground">{humanizeFieldKey(f.name)}</dt>
                  <dd className="font-medium text-foreground break-words">
                    {formatLeadFieldValue(f.values ?? [], 'string')}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}

        <div className="mt-4">
          <h4 className="mb-2 text-sm font-semibold">Actividad y notas</h4>
          <MarketingLeadNotesPanel leadId={lead.id} compact />
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleArchive} disabled={archiveLead.isPending}>
              <Archive className="mr-2 h-3.5 w-3.5" /> Archivar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={deleteLead.isPending}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Eliminar
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={updateLead.isPending}>
              Guardar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
