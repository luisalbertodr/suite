import React, { useMemo, useState } from 'react';
import { Activity, FileUp, Loader2, Upload } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useQueryClient } from '@tanstack/react-query';
import {
  loadCustomerTaxMap,
  parseInbodyCsv,
  upsertInbodyCsvRows,
  type InbodyCsvImportRow,
} from '@/lib/inbodyCsvImport';

export const InbodyCsvImportPanel: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyFilter();
  const [fileName, setFileName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState('');
  const [preview, setPreview] = useState<InbodyCsvImportRow[] | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [skipped, setSkipped] = useState(0);
  const [busy, setBusy] = useState(false);

  const linkedCount = useMemo(
    () => preview?.filter((r) => r.customer_id).length ?? 0,
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
      const result = parseInbodyCsv(csvText, companyId, customerMap, batch);
      setPreview(result.rows);
      setParseErrors(result.errors.slice(0, 20));
      setSkipped(result.skipped);
      toast({
        title: 'Vista previa lista',
        description: `${result.rows.length} mediciones válidas (${result.rows.filter((r) => r.customer_id).length} con ficha).`,
      });
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
      let rows = preview;
      if (!rows?.length) {
        const customerMap = await loadCustomerTaxMap(companyId);
        const batch = `lookinbody_csv_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
        const result = parseInbodyCsv(csvText, companyId, customerMap, batch);
        rows = result.rows;
        setParseErrors(result.errors.slice(0, 20));
        setSkipped(result.skipped);
      }
      if (!rows.length) {
        toast({ title: 'No hay filas válidas para importar', variant: 'destructive' });
        return;
      }
      const count = await upsertInbodyCsvRows(rows);
      await queryClient.invalidateQueries({ queryKey: ['inbody_measurements'] });
      toast({
        title: 'Importación completada',
        description: `${count} mediciones InBody importadas o actualizadas.`,
      });
      setPreview(null);
      setCsvText('');
      setFileName(null);
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-emerald-600" />
          InBody / Lookin&apos;Body — Importar CSV
        </CardTitle>
        <CardDescription>
          Sube un CSV exportado desde Lookin&apos;Body (conversión a Excel/CSV). Las filas se
          vinculan automáticamente a clientes por DNI / USER_ID.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Upload className="h-4 w-4" />
          <AlertTitle>Columnas reconocidas</AlertTitle>
          <AlertDescription className="text-xs space-y-1">
            <p>
              Obligatorias: <code className="rounded bg-muted px-1">USER_ID</code> (o DNI),{' '}
              <code className="rounded bg-muted px-1">DATETIMES</code> (o Fecha).
            </p>
            <p>
              Opcionales: WEIGHT, SMM, BFM, TBW, FFM, BMI, PBF, WHR, BMR, FC, MC, segmentos
              (LRA, LLA, LT…), impedancia (IRA20, ILA20…).
            </p>
            <p>Soporta delimitador coma, punto y coma o tabulador.</p>
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" className="gap-2" asChild disabled={busy}>
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
          <Button variant="secondary" onClick={() => void handlePreview()} disabled={busy || !csvText}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Vista previa
          </Button>
          <Button onClick={() => void handleImport()} disabled={busy || !csvText}>
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
              <span className="font-medium">{linkedCount}</span> vinculadas a ficha de cliente
            </p>
            <p>
              <span className="font-medium">{preview.length - linkedCount}</span> sin ficha (se
              guardan por DNI InBody)
            </p>
            {skipped > 0 && <p className="text-amber-700 dark:text-amber-400">{skipped} filas omitidas</p>}
          </div>
        )}

        {parseErrors.length > 0 && (
          <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs space-y-1 max-h-40 overflow-y-auto">
            {parseErrors.map((err) => (
              <p key={err} className="text-amber-900 dark:text-amber-100">
                {err}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
