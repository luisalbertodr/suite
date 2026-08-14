import React, { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Upload, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  CONTRIBUTION_RETURN_CONCEPT,
  importBankMovements,
  listBankMovements,
  parseBankMovementsCsv,
  summarizeBankExpenses,
  type BankEntity,
} from '@/lib/bankExpenses';
import { MEDICINA_COMPANY_ID } from '@/lib/workCenterBilling';

function euro(n: number): string {
  return `€${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const GastosBancarios: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<BankEntity | 'all'>('all');
  const medicinaInputRef = useRef<HTMLInputElement>(null);
  const esteticaInputRef = useRef<HTMLInputElement>(null);
  const [importingEntity, setImportingEntity] = useState<BankEntity | null>(null);

  const listQuery = useQuery({
    queryKey: ['bank-movements', filter],
    queryFn: () => listBankMovements(filter, 250),
  });

  const summaryQuery = useQuery({
    queryKey: ['bank-movements-summary', filter],
    queryFn: () => summarizeBankExpenses(filter),
  });

  const importMutation = useMutation({
    mutationFn: async (params: { entity: BankEntity; file: File }) => {
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
        description: `${result.inserted} nuevos · ${result.skipped} ya existían · gastos ${euro(result.expenseTotal)} (${result.parsedCount} filas leídas${result.parseErrors ? `, ${result.parseErrors} avisos` : ''}).`,
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
    setImportingEntity(entity);
    importMutation.mutate({ entity, file });
  };

  const rows = listQuery.data ?? [];
  const summary = summaryQuery.data;

  const entityLabel = useMemo(
    () =>
      ({
        all: 'Todas',
        medicina: 'Medicina',
        estetica: 'Estética',
      }) as const,
    [],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5" />
            Gastos bancarios
          </CardTitle>
          <CardDescription>
            Importa extractos CSV de Medicina y Estética. Los movimientos negativos cuentan como
            gasto (se restan del beneficio), excepto «{CONTRIBUTION_RETURN_CONCEPT}» (devolución de
            aportaciones).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
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
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Movimientos recientes</h2>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as BankEntity | 'all')}>
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="medicina">Medicina</TabsTrigger>
            <TabsTrigger value="estetica">Estética</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {listQuery.isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Cargando movimientos…
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Aún no hay movimientos importados ({entityLabel[filter]}).
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
                <th className="px-3 py-2 font-medium">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const area = row.company_id === MEDICINA_COMPANY_ID ? 'Medicina' : 'Estética';
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
                    <td className="px-3 py-2">
                      {row.is_expense ? (
                        <Badge variant="destructive">Gasto</Badge>
                      ) : row.is_contribution_return ? (
                        <Badge variant="outline">Devolución</Badge>
                      ) : (
                        <Badge variant="secondary">Otros</Badge>
                      )}
                    </td>
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
