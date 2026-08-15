import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Upload, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useBankMovementsAccess } from '@/hooks/useBankMovementsAccess';
import {
  CONTRIBUTION_RETURN_CONCEPT,
  SL_INTERNAL_TRANSFER_CONCEPT,
  bankMovementKind,
  fillMissingBankBalances,
  importBankMovements,
  listBankMovements,
  parseBankAmount,
  parseBankMovementsCsv,
  summarizeBankExpenses,
  type BankEntity,
  type BankMovementKind,
} from '@/lib/bankExpenses';
import { MEDICINA_COMPANY_ID } from '@/lib/workCenterBilling';

function euro(n: number): string {
  return `€${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function kindBadge(kind: BankMovementKind) {
  switch (kind) {
    case 'expense':
      return <Badge variant="destructive">Gasto</Badge>;
    case 'contribution_return':
      return <Badge variant="outline">Devolución aportación</Badge>;
    case 'internal_transfer':
      return <Badge variant="outline">Traspaso / interno</Badge>;
    case 'income':
      return <Badge variant="secondary">Ingreso</Badge>;
    default:
      return <Badge variant="secondary">Otros</Badge>;
  }
}

function parseOptionalAmount(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  return parseBankAmount(t);
}

export const MovimientosBancarios: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    loading: accessLoading,
    canAccess,
    canMedicina,
    canEstetica,
    canImportEntity,
    defaultEntity,
  } = useBankMovementsAccess();
  const [entityFilter, setEntityFilter] = useState<BankEntity | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [amountMinRaw, setAmountMinRaw] = useState('');
  const [amountMaxRaw, setAmountMaxRaw] = useState('');
  const [conceptFilter, setConceptFilter] = useState('');
  const [applied, setApplied] = useState({
    dateFrom: '',
    dateTo: '',
    amountMinRaw: '',
    amountMaxRaw: '',
    concept: '',
  });
  const medicinaInputRef = useRef<HTMLInputElement>(null);
  const esteticaInputRef = useRef<HTMLInputElement>(null);
  const [importingEntity, setImportingEntity] = useState<BankEntity | null>(null);

  useEffect(() => {
    if (accessLoading) return;
    setEntityFilter((prev) => {
      if (prev === 'all' && canMedicina && canEstetica) return 'all';
      if (prev === 'all') return defaultEntity;
      if (prev === 'medicina' && !canMedicina) return defaultEntity;
      if (prev === 'estetica' && !canEstetica) return defaultEntity;
      return prev;
    });
  }, [accessLoading, canMedicina, canEstetica, defaultEntity]);

  const amountMin = useMemo(() => parseOptionalAmount(applied.amountMinRaw), [applied.amountMinRaw]);
  const amountMax = useMemo(() => parseOptionalAmount(applied.amountMaxRaw), [applied.amountMaxRaw]);

  const listQuery = useQuery({
    queryKey: [
      'bank-movements',
      entityFilter,
      applied.dateFrom,
      applied.dateTo,
      applied.amountMinRaw,
      applied.amountMaxRaw,
      applied.concept,
      canMedicina,
      canEstetica,
    ],
    queryFn: () =>
      listBankMovements({
        entity: entityFilter,
        dateFrom: applied.dateFrom || null,
        dateTo: applied.dateTo || null,
        amountMin,
        amountMax,
        concept: applied.concept || null,
        limit: 3000,
      }),
    enabled: canAccess && !accessLoading,
  });

  const summaryQuery = useQuery({
    queryKey: ['bank-movements-summary', entityFilter, canMedicina, canEstetica],
    queryFn: () => summarizeBankExpenses(entityFilter),
    enabled: canAccess && !accessLoading,
  });

  const importMutation = useMutation({
    mutationFn: async (params: { entity: BankEntity; file: File }) => {
      if (!canImportEntity(params.entity)) {
        throw new Error('No tienes permiso para importar movimientos de esa empresa.');
      }
      const text = await params.file.text();
      const parsed = parseBankMovementsCsv(text);
      if (!parsed.rows.length) {
        throw new Error(parsed.errors[0] ?? 'No se encontraron movimientos válidos.');
      }
      const result = await importBankMovements({
        entity: params.entity,
        rows: parsed.rows,
        sourceFilename: params.file.name,
      });
      return { ...result, parsedCount: parsed.rows.length, parseErrors: parsed.errors.length };
    },
    onSuccess: (result, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['bank-movements'] });
      void queryClient.invalidateQueries({ queryKey: ['bank-movements-summary'] });
      void queryClient.invalidateQueries({
        predicate: (query) => {
          const root = query.queryKey[0];
          return typeof root === 'string' && root.startsWith('dashboard');
        },
      });
      toast({
        title: `Importación ${vars.entity === 'medicina' ? 'Medicina' : 'Estética'}`,
        description: `${result.inserted} sincronizados · gastos ${euro(result.expenseTotal)} (${result.parsedCount} filas leídas${result.parseErrors ? `, ${result.parseErrors} avisos` : ''}).`,
      });
    },
    onError: (err: Error) => {
      toast({
        title: 'Error al importar',
        description: err.message || 'No se pudo importar el extracto.',
        variant: 'destructive',
      });
    },
    onSettled: () => setImportingEntity(null),
  });

  const onPickFile = (entity: BankEntity, file: File | undefined) => {
    if (!file) return;
    if (!canImportEntity(entity)) {
      toast({
        title: 'Sin permiso',
        description: 'No estás autorizado para esa empresa.',
        variant: 'destructive',
      });
      return;
    }
    setImportingEntity(entity);
    importMutation.mutate({ entity, file });
  };

  const applyFilters = () => {
    if (amountMinRaw.trim() && parseOptionalAmount(amountMinRaw) == null) {
      toast({ title: 'Importe mínimo inválido', variant: 'destructive' });
      return;
    }
    if (amountMaxRaw.trim() && parseOptionalAmount(amountMaxRaw) == null) {
      toast({ title: 'Importe máximo inválido', variant: 'destructive' });
      return;
    }
    setApplied({
      dateFrom,
      dateTo,
      amountMinRaw,
      amountMaxRaw,
      concept: conceptFilter.trim(),
    });
  };

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setAmountMinRaw('');
    setAmountMaxRaw('');
    setConceptFilter('');
    setApplied({
      dateFrom: '',
      dateTo: '',
      amountMinRaw: '',
      amountMaxRaw: '',
      concept: '',
    });
  };

  const rows = useMemo(
    () => fillMissingBankBalances(listQuery.data ?? []),
    [listQuery.data],
  );
  const summary = summaryQuery.data;
  const hasActiveFilters = Boolean(
    applied.dateFrom ||
      applied.dateTo ||
      applied.amountMinRaw ||
      applied.amountMaxRaw ||
      applied.concept,
  );

  const entityLabel = useMemo(
    () =>
      ({
        all: 'Todas',
        medicina: 'Medicina',
        estetica: 'Estética',
      }) as const,
    [],
  );

  if (accessLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Comprobando permisos…
      </div>
    );
  }

  if (!canAccess) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No tienes permiso para ver movimientos bancarios.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5" />
            Movimientos bancarios
          </CardTitle>
          <CardDescription>
            Importa extractos CSV de Santander One
            {canMedicina && canEstetica
              ? ' (Medicina y Estética)'
              : canMedicina
                ? ' (Medicina)'
                : ' (Estética)'}
            . Se muestra el <strong>saldo</strong> de la cuenta tras cada movimiento (columna SALDO
            del extracto). Los negativos cuentan como gasto, excepto devoluciones de aportación («
            {CONTRIBUTION_RETURN_CONCEPT}»), transferencias a la SL («{SL_INTERNAL_TRANSFER_CONCEPT}»)
            y conceptos «Traspaso…» a cuenta particular.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {canMedicina ? (
              <>
                <input
                  ref={medicinaInputRef}
                  type="file"
                  accept=".csv,text/csv,text/plain,.txt"
                  className="hidden"
                  onChange={(e) => {
                    onPickFile('medicina', e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                <Button
                  type="button"
                  onClick={() => medicinaInputRef.current?.click()}
                  disabled={importMutation.isPending}
                >
                  {importingEntity === 'medicina' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Importar Medicina
                </Button>
              </>
            ) : null}
            {canEstetica ? (
              <>
                <input
                  ref={esteticaInputRef}
                  type="file"
                  accept=".csv,text/csv,text/plain,.txt"
                  className="hidden"
                  onChange={(e) => {
                    onPickFile('estetica', e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => esteticaInputRef.current?.click()}
                  disabled={importMutation.isPending}
                >
                  {importingEntity === 'estetica' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Importar Estética
                </Button>
              </>
            ) : null}
          </div>

          <div className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Desde</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Hasta</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Importe mín.</label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="-500,00"
                value={amountMinRaw}
                onChange={(e) => setAmountMinRaw(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Importe máx.</label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={amountMaxRaw}
                onChange={(e) => setAmountMaxRaw(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1 sm:col-span-2 lg:col-span-2">
              <label className="text-xs font-medium text-muted-foreground">Concepto</label>
              <Input
                type="text"
                placeholder="Buscar en concepto…"
                value={conceptFilter}
                onChange={(e) => setConceptFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyFilters();
                }}
                className="h-9"
              />
            </div>
            <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-6">
              <Button type="button" size="sm" onClick={applyFilters}>
                Filtrar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={clearFilters}
                disabled={!hasActiveFilters && !dateFrom && !dateTo && !amountMinRaw && !amountMaxRaw && !conceptFilter}
              >
                Limpiar
              </Button>
              <Tabs
                value={entityFilter}
                onValueChange={(v) => setEntityFilter(v as BankEntity | 'all')}
                className="ml-auto"
              >
                <TabsList>
                  {canMedicina && canEstetica ? (
                    <TabsTrigger value="all">Todas</TabsTrigger>
                  ) : null}
                  {canMedicina ? <TabsTrigger value="medicina">Medicina</TabsTrigger> : null}
                  {canEstetica ? <TabsTrigger value="estetica">Estética</TabsTrigger> : null}
                </TabsList>
              </Tabs>
            </div>
          </div>

          {summary ? (
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span>
                Movimientos: <strong className="text-foreground">{summary.movementCount}</strong>
              </span>
              <span>
                Gastos: <strong className="text-foreground">{summary.expenseCount}</strong> (
                {euro(summary.expenseTotal)})
              </span>
              <span>
                Devoluciones aportación:{' '}
                <strong className="text-foreground">{summary.contributionReturnCount}</strong>
              </span>
              {hasActiveFilters ? (
                <span>
                  Filtrados: <strong className="text-foreground">{rows.length}</strong>
                </span>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {listQuery.isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Cargando movimientos…
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {hasActiveFilters
            ? 'Ningún movimiento coincide con los filtros.'
            : `Aún no hay movimientos importados (${entityLabel[entityFilter]}).`}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Fecha</th>
                <th className="px-3 py-2 font-medium">Área</th>
                <th className="px-3 py-2 font-medium">Concepto</th>
                <th className="px-3 py-2 font-medium text-right">Importe</th>
                <th className="px-3 py-2 font-medium text-right">Saldo</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const area = row.company_id === MEDICINA_COMPANY_ID ? 'Medicina' : 'Estética';
                const kind = bankMovementKind(row);
                return (
                  <tr key={row.id} className="border-t">
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                      {format(new Date(`${row.movement_date}T12:00:00`), 'dd MMM yyyy', {
                        locale: es,
                      })}
                    </td>
                    <td className="px-3 py-2">{area}</td>
                    <td className="max-w-[420px] truncate px-3 py-2" title={row.concept}>
                      {row.concept || '—'}
                    </td>
                    <td
                      className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${
                        row.amount < 0 ? 'text-destructive' : 'text-emerald-600'
                      }`}
                    >
                      {euro(row.amount)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {row.balance != null ? euro(row.balance) : '—'}
                    </td>
                    <td className="px-3 py-2">{kindBadge(kind)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/** @deprecated alias */
export const GastosBancarios = MovimientosBancarios;
