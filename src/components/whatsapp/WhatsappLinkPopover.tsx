import React, { useEffect, useState } from 'react';
import { Search, UserPlus, UserCheck, UserX, Link as LinkIcon, Loader2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  useWhatsappChatLink,
  type LinkCandidateCustomer,
  type LinkCandidateLead,
} from '@/hooks/useWhatsappChatLink';
import type { WhatsappChatRow } from '@/hooks/useWhatsappChats';

interface Props {
  chat: WhatsappChatRow;
  customerName?: string;
  leadName?: string;
  children: React.ReactNode;
}

export const WhatsappLinkPopover: React.FC<Props> = ({
  chat,
  customerName,
  leadName,
  children,
}) => {
  const { toast } = useToast();
  const { search, setLink } = useWhatsappChatLink();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [customers, setCustomers] = useState<LinkCandidateCustomer[]>([]);
  const [leads, setLeads] = useState<LinkCandidateLead[]>([]);

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      const term = q.trim();
      if (term.length < 2) {
        setCustomers([]);
        setLeads([]);
        return;
      }
      search.mutate(term, {
        onSuccess: (data) => {
          setCustomers(data.customers ?? []);
          setLeads(data.leads ?? []);
        },
        onError: (e) => {
          const msg = e instanceof Error ? e.message : 'Error buscando';
          toast({ title: 'Error', description: msg, variant: 'destructive' });
        },
      });
    }, 250);
    return () => clearTimeout(id);
  }, [q, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = async (
    next: { customer_id?: string | null; marketing_lead_id?: string | null },
    label: string,
  ) => {
    try {
      await setLink.mutateAsync({ chat_id: chat.chat_id, ...next });
      toast({ title: label });
      setOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'No se pudo vincular';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  const hasLink = !!chat.customer_id || !!chat.marketing_lead_id;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0">
        <div className="border-b p-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <LinkIcon className="h-4 w-4 text-emerald-600" />
            Vincular conversación
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Asocia este chat con un cliente o un lead de marketing. Útil para
            ver todo el historial unificado.
          </p>
          {hasLink ? (
            <div className="mt-2 flex items-center justify-between rounded-md bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <span className="flex items-center gap-1">
                <UserCheck className="h-3 w-3" />
                {customerName
                  ? `Cliente: ${customerName}`
                  : leadName
                    ? `Lead: ${leadName}`
                    : 'Vinculado'}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-[11px] text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950"
                onClick={() =>
                  apply(
                    { customer_id: null, marketing_lead_id: null },
                    'Vinculación eliminada',
                  )
                }
              >
                <UserX className="h-3 w-3" />
                Desvincular
              </Button>
            </div>
          ) : null}
        </div>

        <div className="p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, teléfono…"
              className="h-9 pl-8 text-sm"
              autoFocus
            />
          </div>
        </div>

        <ScrollArea className="max-h-[300px]">
          <div className="px-1 pb-2">
            {search.isPending ? (
              <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Buscando…
              </div>
            ) : q.trim().length < 2 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                Empieza a teclear (mínimo 2 caracteres) para buscar.
              </p>
            ) : customers.length === 0 && leads.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                Sin resultados.
              </p>
            ) : (
              <>
                {customers.length > 0 ? (
                  <div className="px-2 pt-1">
                    <p className="px-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Clientes
                    </p>
                    <ul className="space-y-0.5">
                      {customers.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            onClick={() =>
                              apply(
                                { customer_id: c.id, marketing_lead_id: null },
                                `Vinculado a cliente: ${c.name}`,
                              )
                            }
                            className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                          >
                            <UserCheck className="mt-0.5 h-3.5 w-3.5 text-emerald-600" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{c.name}</p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {[c.phone, c.phone_mobile, c.phone_home, c.email]
                                  .filter(Boolean)
                                  .join(' · ') || '—'}
                              </p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {leads.length > 0 ? (
                  <div className="px-2 pt-1">
                    <p className="px-1 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Leads de marketing
                    </p>
                    <ul className="space-y-0.5">
                      {leads.map((l) => {
                        const full = [l.first_name, l.last_name]
                          .filter(Boolean)
                          .join(' ')
                          .trim();
                        return (
                          <li key={l.id}>
                            <button
                              type="button"
                              onClick={() =>
                                apply(
                                  { customer_id: null, marketing_lead_id: l.id },
                                  `Vinculado a lead: ${full || 'Lead'}`,
                                )
                              }
                              className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                            >
                              <UserPlus className="mt-0.5 h-3.5 w-3.5 text-sky-600" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">
                                  {full || 'Lead sin nombre'}
                                </p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {[l.phone, l.email].filter(Boolean).join(' · ') || '—'}
                                </p>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
