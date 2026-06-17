import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Search } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  useMarketingWhatsappQueue,
  type EligibleQueueLead,
} from '@/hooks/useMarketingWhatsappQueue';

function leadLabel(lead: EligibleQueueLead): string {
  const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ').trim();
  return name || lead.phone || 'Sin nombre';
}

function leadDate(lead: EligibleQueueLead): string {
  const iso = lead.external_created_at ?? lead.created_at;
  try {
    return format(new Date(iso), 'd MMM yyyy', { locale: es });
  } catch {
    return '';
  }
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
};

export const MarketingWhatsappEnqueueDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  companyId,
}) => {
  const { toast } = useToast();
  const { fetchEligibleLeads, enqueueLeads } = useMarketingWhatsappQueue(companyId);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelected(new Set());
      return;
    }
    void fetchEligibleLeads.refetch();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const leads = fetchEligibleLeads.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter((lead) => {
      const haystack = [
        lead.first_name ?? '',
        lead.last_name ?? '',
        lead.phone ?? '',
        lead.form_name ?? '',
        lead.campaign ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [leads, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleFiltered = () => {
    const filteredIds = filtered.map((l) => l.id);
    const allSelected = filteredIds.length > 0 && filteredIds.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const id of filteredIds) next.delete(id);
      } else {
        for (const id of filteredIds) next.add(id);
      }
      return next;
    });
  };

  const handleEnqueue = async () => {
    if (selected.size === 0) {
      toast({
        title: 'Selecciona al menos un lead',
        variant: 'destructive',
      });
      return;
    }
    try {
      const res = await enqueueLeads.mutateAsync([...selected]);
      toast({
        title: 'Leads encolados',
        description:
          res.skipped > 0
            ? `${res.enqueued} encolado(s). ${res.skipped} omitido(s) (ya no elegibles).`
            : `${res.enqueued} lead(s) añadidos a la cola.`,
      });
      onOpenChange(false);
    } catch (e) {
      toast({
        title: 'No se pudo encolar',
        description: e instanceof Error ? e.message : 'Error desconocido',
        variant: 'destructive',
      });
    }
  };

  const filteredAllSelected =
    filtered.length > 0 && filtered.every((l) => selected.has(l.id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-lg flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
          <DialogTitle>Encolar leads</DialogTitle>
          <DialogDescription>
            Elige los leads sin mensaje inicial de WhatsApp. Solo aparecen los que tienen
            automatización activa en su formulario Meta y aún no están en cola.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-2 shrink-0 space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, teléfono, formulario…"
              className="h-9 pl-8"
            />
          </div>
          {filtered.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-0"
              onClick={toggleFiltered}
            >
              {filteredAllSelected ? 'Desmarcar visibles' : 'Marcar visibles'}
              {search.trim() ? ` (${filtered.length})` : ''}
            </Button>
          ) : null}
        </div>

        <ScrollArea className="h-[min(52vh,460px)] w-full px-6">
          {fetchEligibleLeads.isLoading || fetchEligibleLeads.isFetching ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : leads.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No hay leads pendientes de encolar.
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              Sin resultados para «{search}».
            </p>
          ) : (
            <ul className="space-y-1 pb-4">
              {filtered.map((lead) => {
                const checked = selected.has(lead.id);
                return (
                  <li key={lead.id}>
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                        checked ? 'border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/20' : 'hover:bg-muted/50'
                      }`}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggle(lead.id)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-medium truncate">{leadLabel(lead)}</span>
                          {lead.form_name ? (
                            <Badge variant="secondary" className="text-[10px] shrink-0">
                              {lead.form_name}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {lead.phone ?? ''}
                          {leadDate(lead) ? ` · ${leadDate(lead)}` : ''}
                        </p>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>

        <DialogFooter className="px-6 py-4 border-t shrink-0 gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleEnqueue}
            disabled={enqueueLeads.isPending || selected.size === 0}
          >
            {enqueueLeads.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Encolando…
              </>
            ) : (
              `Encolar${selected.size > 0 ? ` (${selected.size})` : ''}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
