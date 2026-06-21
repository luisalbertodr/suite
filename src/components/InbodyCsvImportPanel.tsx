import React, { useMemo, useState } from 'react';
import { Activity, FileUp, Loader2, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { useQueryClient } from '@tanstack/react-query';
import { InbodyCustomerLinkWizard } from '@/components/InbodyCustomerLinkWizard';
import {
  collectUnmatchedInbodyUsers,
  enrichInbodyRowsWithCustomerMap,
  loadCustomerTaxMap,
  parseInbodyCsv,
  upsertInbodyCsvRows,
  type InbodyCsvImportRow,
  type InbodyCustomerLinkStats,
  type UnmatchedInbodyUser,
} from '@/lib/inbodyCsvImport';

type PendingImport = {
  rows: InbodyCsvImportRow[];
  result: ReturnType<typeof parseInbodyCsv>;
  customerMap: Map<string, string>;
};

interface InbodyCsvImportPanelProps {
  /** En ficha de cliente: UI más compacta al final de la pestaña InBody */
  embedded?: boolean;
  customerId?: string;
  taxId?: string | null;
  customerName?: string | null;
}

export const InbodyCsvImportPanel: React.FC<InbodyCsvImportPanelProps> = ({
  embedded = false,
  customerId,
  taxId,
  customerName,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyFilter();
  const { catalogHostCompanyId } = useWorkCenter();
  const catalogCompanyId = catalogHostCompanyId ?? companyId;
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<InbodyCsvImportRow[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [skippedBlank, setSkippedBlank] = useState(0);
  const [busy, setBusy] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [unmatchedItems, setUnmatchedItems] = useState<UnmatchedInbodyUser[]>([]);
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);

  const applyParseResult = (result: ReturnType<typeof parseInbodyCsv>) => {
    setPreview(result.rows);
    setParseErrors(result.errors.slice(0, 30));
    setSkipped(result.skipped);
    setSkippedBlank(result.skippedBlank);
    return result;
  };

  const importSummary = (imported: number, result: ReturnType<typeof parseInbodyCsv>) => {
    const parts = [`${imported} mediciones importadas o actualizadas.`];
    if (result.suspicious > 0) {
      parts.push(
        `${result.suspicious} medición(es) con datos incoherentes — conviene repetir el escaneo InBody.`,
      );
    }
    if (result.skipped > 0) {
      parts.push(`${result.skipped} fila(s) omitida(s) por datos inválidos.`);
    }
    return parts.join(' ');
  };

  const linkedCount = useMemo(
    () => preview?.filter((r) => r.customer_id).length ?? 0,
    [preview],
  );
  const suspiciousCount = useMemo(
    () => preview?.filter((r) => r.data_quality?.needs_repeat).length ?? 0,
    [preview],
  );

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setCsvText(text);
    setPreview(null);
    setParseErrors([]);
    setSkipped(0);
    setSkippedBlank(0);
  };

  const handlePreview = async () => {
    if (!companyId) {
      toast({ title: 'Empresa no seleccionada', variant: 'destructive' });
      return;
    }
    if (!csvText.trim()) {
      toast({ title: 'Selecciona un archivo CSV', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const customerMap = await loadCustomerTaxMap(companyId);
      const batch = `lookinbody_csv_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
      const result = applyParseResult(parseInbodyCsv(csvText, companyId, customerMap, batch));
      toast({
        title: 'Vista previa lista',
        description: `${result.rows.length} mediciones válidas (${result.rows.filter((r) => r.customer_id).length} con ficha).${
          result.skipped > 0 ? ` ${result.skipped} omitida(s).` : ''
        }`,
        variant: result.skipped > 0 && result.rows.length > 0 ? 'default' : undefined,
      });
      if (result.skipped > 0 && result.rows.length > 0) {
        toast({
          title: 'Algunas filas no se importarán',
          description: result.errors[0] ?? `${result.skipped} filas con DNI o fecha inválidos.`,
        });
      }
    } catch (e) {
      toast({
        title: 'Error al leer CSV',
        description: e instanceof Error ? e.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const finishImport = async (
    rows: InbodyCsvImportRow[],
    result: ReturnType<typeof parseInbodyCsv>,
    linkStats?: InbodyCustomerLinkStats,
  ) => {
    const count = await upsertInbodyCsvRows(rows);
    await queryClient.invalidateQueries({ queryKey: ['inbody_measurements'] });
    await queryClient.invalidateQueries({ queryKey: ['customers-search'] });

    const extras: string[] = [];
    if (linkStats) {
      if (linkStats.linked > 0) extras.push(`${linkStats.linked} ficha(s) vinculada(s).`);
      if (linkStats.created > 0) extras.push(`${linkStats.created} ficha(s) nueva(s).`);
      if (linkStats.skipped > 0) extras.push(`${linkStats.skipped} DNI sin ficha (solo InBody).`);
    }

    toast({
      title:
        result.suspicious > 0 || result.skipped > 0
          ? 'Importación completada con avisos'
          : 'Importación completada',
      description: [importSummary(count, result), ...extras].filter(Boolean).join(' '),
    });

    if (result.skipped > 0) {
      toast({
        title: 'Filas omitidas',
        description: result.errors.slice(0, 3).join(' ') || `${result.skipped} filas no importadas.`,
      });
    }

    setPreview(null);
    setCsvText('');
    setFileName(null);
    setParseErrors([]);
    setSkipped(0);
    setSkippedBlank(0);
    setPendingImport(null);
    setUnmatchedItems([]);
    setWizardOpen(false);
  };

  const handleImport = async () => {
    if (!companyId) {
      toast({ title: 'Empresa no seleccionada', variant: 'destructive' });
      return;
    }
    if (!csvText.trim()) {
      toast({ title: 'Selecciona un archivo CSV', variant: 'destructive' });
      return;
    }

    setBusy(true);
    try {
      const customerMap = await loadCustomerTaxMap(companyId);
      const batch = `lookinbody_csv_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
      const result = applyParseResult(parseInbodyCsv(csvText, companyId, customerMap, batch));
      const rows = result.rows;

      if (!rows.length) {
        toast({
          title: 'No hay filas válidas para importar',
          description: result.errors[0] ?? 'Revisa DNI y fecha en el CSV.',
          variant: 'destructive',
        });
        return;
      }

      const unmatched = await collectUnmatchedInbodyUsers(rows, customerMap);

      if (unmatched.length > 0) {
        setPendingImport({ rows, result, customerMap });
        setUnmatchedItems(unmatched);
        setWizardOpen(true);
        toast({
          title: 'Vincular clientes',
          description: `${unmatched.length} DNI sin ficha por DNI. Indica el nombre para buscar o crear cada uno.`,
        });
        return;
      }

      const enriched = enrichInbodyRowsWithCustomerMap(rows, customerMap);
      await finishImport(enriched, result);
    } catch (e) {
      toast({
        title: 'Error al importar',
        description: e instanceof Error ? e.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleWizardComplete = async (
    customerMap: Map<string, string>,
    linkStats: InbodyCustomerLinkStats,
  ) => {
    if (!pendingImport || !companyId) return;
    setBusy(true);
    try {
      const enriched = enrichInbodyRowsWithCustomerMap(pendingImport.rows, customerMap);
      await finishImport(enriched, pendingImport.result, linkStats);
    } catch (e) {
      toast({
        title: 'Error al importar',
        description: e instanceof Error ? e.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleWizardCancel = () => {
    setWizardOpen(false);
    setPendingImport(null);
    setUnmatchedItems([]);
    toast({
      title: 'Importación cancelada',
      description: 'No se guardaron mediciones. Vuelve a pulsar Importar cuando quieras continuar.',
    });
  };

  return (
    <>
      <Card className={embedded ? 'border-dashed' : undefined}>
        <CardHeader className={embedded ? 'pb-2' : undefined}>
          <CardTitle className={`flex items-center gap-2 ${embedded ? 'text-sm' : 'text-base'}`}>
            <Activity className="h-4 w-4 text-emerald-600" />
            {embedded ? 'Importar mediciones InBody (CSV)' : "InBody / Lookin'Body — Importar CSV"}
          </CardTitle>
          <CardDescription className={embedded ? 'text-xs' : undefined}>
            {embedded ? (
              <>
                Sube un CSV de Lookin&apos;Body para añadir mediciones
                {taxId ? (
                  <>
                    {' '}
                    (se vincularán por DNI <strong>{taxId}</strong>
                    {customerName ? ` — ${customerName}` : ''}).
                  </>
                ) : (
                  '. Añade el DNI del cliente para vincular automáticamente.'
                )}
              </>
            ) : (
              <>
                Sube un CSV exportado desde Lookin&apos;Body. Si el DNI no tiene ficha, te pediremos el
                nombre para buscar la ficha existente (aunque no tenga DNI) o crear una nueva.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className={`space-y-4 ${embedded ? 'pt-0' : ''}`}>
          {!embedded && (
            <Alert>
              <Upload className="h-4 w-4" />
              <AlertTitle>Columnas reconocidas</AlertTitle>
              <AlertDescription className="text-xs space-y-1">
                <p>
                  Obligatorias: <code className="rounded bg-muted px-1">ID</code> / USER_ID (DNI),{' '}
                  <code className="rounded bg-muted px-1">Date&amp;Times</code> (o Fecha).
                </p>
                <p>
                  Soporta <strong>dbbackup.CSV</strong> de Lookin&apos;Body (65 columnas numeradas) y CSV
                  genérico con WEIGHT, SMM, BFM, TBW, FFM, BMI, PBF, WHR, BMR, segmentos e impedancia.
                </p>
                <p>Soporta delimitador coma, punto y coma o tabulador.</p>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="gap-2" size={embedded ? 'sm' : 'default'} asChild disabled={busy}>
              <label>
                <FileUp className="h-4 w-4" />
                {fileName || 'Seleccionar CSV'}
                <input
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="hidden"
                  onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </Button>
            <Button
              variant="secondary"
              size={embedded ? 'sm' : 'default'}
              onClick={() => void handlePreview()}
              disabled={busy || !csvText}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Vista previa
            </Button>
            <Button size={embedded ? 'sm' : 'default'} onClick={() => void handleImport()} disabled={busy || !csvText || wizardOpen}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Importar
            </Button>
          </div>

          {preview && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
              <p>
                <span className="font-medium">{preview.length}</span> mediciones listas
              </p>
              <p>
                <span className="font-medium">{linkedCount}</span> vinculadas a ficha por DNI
              </p>
              <p>
                <span className="font-medium">{preview.length - linkedCount}</span> pedirán vincular
                por nombre al importar
              </p>
              {suspiciousCount > 0 && (
                <p className="text-amber-700 dark:text-amber-400">
                  {suspiciousCount} medición(es) con datos incoherentes — se marcarán para repetir escaneo
                </p>
              )}
              {skipped > 0 && (
                <p className="text-amber-700 dark:text-amber-400">
                  {skipped} fila(s) omitida(s) por DNI o fecha inválidos (el resto se importará)
                </p>
              )}
            </div>
          )}

          {parseErrors.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs space-y-1 max-h-40 overflow-y-auto">
              <p className="font-medium text-amber-900 dark:text-amber-100 mb-1">
                Avisos (filas no importadas)
              </p>
              {parseErrors.map((err, idx) => (
                <p key={`${err}-${idx}`} className="text-amber-900 dark:text-amber-100">
                  {err}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {companyId && catalogCompanyId && pendingImport && (
        <InbodyCustomerLinkWizard
          open={wizardOpen}
          items={unmatchedItems}
          companyId={companyId}
          catalogCompanyId={catalogCompanyId}
          customerByTax={pendingImport.customerMap}
          onComplete={(map, stats) => void handleWizardComplete(map, stats)}
          onCancel={handleWizardCancel}
        />
      )}
    </>
  );
};
