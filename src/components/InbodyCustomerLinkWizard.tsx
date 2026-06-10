import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, UserPlus, UserSearch } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useCustomerSearch } from '@/hooks/useCustomerSearch';
import {
  CUSTOMER_SEARCH_MIN_CHARS,
  isCustomerSearchQueryReady,
  type CustomerSearchRow,
} from '@/lib/customerSearch';
import { dniNumericKey } from '@/lib/inbodyMeasurements';
import {
  persistInbodyCustomerLink,
  type InbodyCustomerLinkStats,
  type UnmatchedInbodyUser,
} from '@/lib/inbodyCsvImport';

type Props = {
  open: boolean;
  items: UnmatchedInbodyUser[];
  companyId: string;
  catalogCompanyId: string;
  customerByTax: Map<string, string>;
  onComplete: (customerByTax: Map<string, string>, stats: InbodyCustomerLinkStats) => void;
  onCancel: () => void;
};

function taxIdsConflict(existing: string | null | undefined, inbodyTaxId: string): boolean {
  const a = dniNumericKey(existing);
  const b = dniNumericKey(inbodyTaxId);
  if (!a || !b) return false;
  return a !== b;
}

export const InbodyCustomerLinkWizard: React.FC<Props> = ({
  open,
  items,
  companyId,
  catalogCompanyId,
  customerByTax: initialMap,
  onComplete,
  onCancel,
}) => {
  const { toast } = useToast();
  const [index, setIndex] = useState(0);
  const [customerByTax, setCustomerByTax] = useState(initialMap);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<CustomerSearchRow | null>(null);
  const [createName, setCreateName] = useState('');
  const [busy, setBusy] = useState(false);
  const [stats, setStats] = useState<InbodyCustomerLinkStats>({ linked: 0, created: 0, skipped: 0 });

  const current = items[index] ?? null;
  const remote = useCustomerSearch(catalogCompanyId, search);

  useEffect(() => {
    if (!open) return;
    setIndex(0);
    setCustomerByTax(new Map(initialMap));
    setStats({ linked: 0, created: 0, skipped: 0 });
  }, [open, initialMap, items]);

  useEffect(() => {
    if (!current) return;
    const hint = current.legacyName?.trim() || '';
    setSearch(hint);
    setCreateName(hint);
    setSelected(null);
  }, [current?.inbody_user_id]);

  const taxConflict = useMemo(
    () => (selected ? taxIdsConflict(selected.tax_id, current?.tax_id ?? '') : false),
    [selected, current?.tax_id],
  );

  const advance = (nextMap: Map<string, string>, patch: Partial<InbodyCustomerLinkStats>) => {
    const nextStats = {
      linked: stats.linked + (patch.linked ?? 0),
      created: stats.created + (patch.created ?? 0),
      skipped: stats.skipped + (patch.skipped ?? 0),
    };
    setStats(nextStats);
    setCustomerByTax(nextMap);

    if (index + 1 >= items.length) {
      onComplete(nextMap, nextStats);
      return;
    }
    setIndex((i) => i + 1);
  };

  const runDecision = async (
    decision: Parameters<typeof persistInbodyCustomerLink>[2],
    patch: Partial<InbodyCustomerLinkStats>,
  ) => {
    if (!current) return;
    setBusy(true);
    try {
      const nextMap = new Map(customerByTax);
      await persistInbodyCustomerLink(companyId, current.inbody_user_id, decision, nextMap);
      advance(nextMap, patch);
    } catch (e) {
      toast({
        title: 'No se pudo vincular',
        description: e instanceof Error ? e.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleLinkExisting = async () => {
    if (!selected) return;
    await runDecision({ kind: 'existing', customerId: selected.id }, { linked: 1 });
  };

  const handleCreate = async () => {
    const name = createName.trim();
    if (!name) return;
    await runDecision({ kind: 'create', name }, { created: 1 });
  };

  const handleSkip = async () => {
    await runDecision({ kind: 'skip' }, { skipped: 1 });
  };

  if (!current) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !busy) onCancel();
      }}
    >
      <DialogContent className="max-w-lg" onPointerDownOutside={(e) => busy && e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserSearch className="h-5 w-5 text-emerald-600" />
            Vincular DNI InBody a ficha
          </DialogTitle>
          <DialogDescription>
            DNI {index + 1} de {items.length}. Busca la ficha por nombre (puede existir sin DNI).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="rounded-md border bg-muted/40 p-3 space-y-1">
            <p>
              <span className="text-muted-foreground">DNI InBody:</span>{' '}
              <span className="font-mono font-medium">{current.inbody_user_id}</span>
              {current.tax_id !== current.inbody_user_id && (
                <span className="text-muted-foreground"> → {current.tax_id}</span>
              )}
            </p>
            <p>
              <span className="text-muted-foreground">Mediciones en CSV:</span>{' '}
              <span className="font-medium">{current.measurementCount}</span>
            </p>
            {current.legacyName && (
              <p className="text-emerald-800 dark:text-emerald-300">
                Nombre en Dunasoft: <span className="font-medium">{current.legacyName}</span>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Buscar ficha existente</Label>
            <Command shouldFilter={false} className="rounded-md border">
              <CommandInput
                placeholder={`Mín. ${CUSTOMER_SEARCH_MIN_CHARS} letras o números…`}
                value={search}
                onValueChange={setSearch}
              />
              <CommandList className="max-h-48">
                {!isCustomerSearchQueryReady(search) ? (
                  <p className="py-4 text-center text-xs text-muted-foreground px-3">
                    Escribe al menos {CUSTOMER_SEARCH_MIN_CHARS} caracteres para buscar por nombre.
                  </p>
                ) : remote.isLoading ? (
                  <p className="py-4 text-center text-xs text-muted-foreground">Buscando…</p>
                ) : (
                  <>
                    <CommandEmpty>No se encontraron fichas con ese nombre.</CommandEmpty>
                    <CommandGroup>
                      {remote.customers.map((customer) => (
                        <CommandItem
                          key={customer.id}
                          value={customer.id}
                          onSelect={() => setSelected(customer)}
                          className={cn(selected?.id === customer.id && 'bg-accent')}
                        >
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="truncate font-medium">{customer.name}</span>
                            <span className="text-xs text-muted-foreground truncate">
                              {customer.tax_id
                                ? `DNI ${customer.tax_id}`
                                : 'Sin DNI en ficha'}
                              {customer.phone ? ` · ${customer.phone}` : ''}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </div>

          {selected && (
            <Alert variant={taxConflict ? 'destructive' : 'default'}>
              <AlertDescription className="text-xs">
                {taxConflict ? (
                  <>
                    <strong>{selected.name}</strong> ya tiene DNI{' '}
                    <span className="font-mono">{selected.tax_id}</span>, distinto del InBody. Las
                    mediciones se vincularán a esta ficha pero no se cambiará el DNI guardado.
                  </>
                ) : (
                  <>
                    Vincular a <strong>{selected.name}</strong>
                    {!selected.tax_id
                      ? ` y añadir DNI ${current.tax_id} a la ficha.`
                      : '.'}
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2 border-t pt-3">
            <Label className="flex items-center gap-1.5">
              <UserPlus className="h-3.5 w-3.5" />
              O crear ficha nueva
            </Label>
            <Input
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="Nombre y apellidos del cliente"
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2 sm:space-x-0">
          <div className="flex flex-wrap gap-2 w-full justify-end">
            <Button variant="outline" onClick={() => void handleSkip()} disabled={busy}>
              Omitir (solo InBody)
            </Button>
            <Button
              variant="secondary"
              onClick={() => void handleCreate()}
              disabled={busy || !createName.trim()}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Crear ficha
            </Button>
            <Button onClick={() => void handleLinkExisting()} disabled={busy || !selected}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Vincular ficha
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
