import React, { useMemo, useState } from 'react';
import { Upload, FileJson, Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  parseMetaLeadPayload,
  parseTuPartnerPayload,
  detectImportFormat,
  useMarketingLeads,
  type MetaLeadFormPayload,
  type TuPartnerLeadsPayload,
  type ImportFormat,
} from '@/hooks/useMarketingLeads';
import type { MarketingLeadStage } from '@/hooks/useMarketingStages';
import { convertCsvToTuPartner, looksLikeCsv } from './csvParser';

interface MarketingImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stages: MarketingLeadStage[];
}

type Preview =
  | {
      format: 'tupartner';
      payload: TuPartnerLeadsPayload;
      count: number;
      stages: Array<{ name: string; count: number }>;
      origin: 'json' | 'csv';
      notesCount: number;
      tagsCount: number;
    }
  | { format: 'meta'; payload: MetaLeadFormPayload; count: number }
  | { format: 'unknown'; reason?: string };

const FORMAT_LABEL: Record<ImportFormat | 'tupartner-csv', string> = {
  meta: 'Meta Lead Ads (Graph API)',
  tupartner: 'CRM externo (JSON leads[])',
  'tupartner-csv': 'CSV de CRM externo (HighLevel/TuPartner)',
  unknown: 'Desconocido',
};

export const MarketingImportDialog: React.FC<MarketingImportDialogProps> = ({
  open,
  onOpenChange,
  stages,
}) => {
  const { toast } = useToast();
  const { importLeads, importTuPartner } = useMarketingLeads();
  const [text, setText] = useState('');
  const [stageId, setStageId] = useState<string>('');
  const [mode, setMode] = useState<'upsert' | 'skip-existing'>('upsert');

  const defaultStageId = useMemo(() => {
    if (stageId) return stageId;
    const intake = stages.find((s) => s.is_default_intake);
    return intake?.id ?? stages[0]?.id ?? '';
  }, [stages, stageId]);

  const preview = useMemo<Preview>(() => {
    if (!text.trim()) return { format: 'unknown' };

    const buildTuPartnerPreview = (
      payload: TuPartnerLeadsPayload,
      origin: 'json' | 'csv',
    ): Preview => {
      const stageCounts = new Map<string, number>();
      let notesCount = 0;
      let tagsCount = 0;
      for (const l of payload.leads ?? []) {
        if (l.stage) stageCounts.set(l.stage, (stageCounts.get(l.stage) ?? 0) + 1);
        if (Array.isArray(l.notes)) notesCount += l.notes.length;
        if (Array.isArray(l.tags)) tagsCount += l.tags.length;
      }
      return {
        format: 'tupartner',
        payload,
        count: payload.leads?.length ?? 0,
        origin,
        notesCount,
        tagsCount,
        stages: [...stageCounts.entries()]
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count),
      };
    };

    // 1) JSON
    try {
      const parsed = JSON.parse(text);
      const format = detectImportFormat(parsed);
      if (format === 'tupartner') {
        return buildTuPartnerPreview(parsed as TuPartnerLeadsPayload, 'json');
      }
      if (format === 'meta') {
        const payload = parsed as MetaLeadFormPayload;
        return { format: 'meta', payload, count: payload.data?.length ?? 0 };
      }
    } catch {
      // ignore — probamos CSV
    }

    // 2) CSV
    if (looksLikeCsv(text)) {
      const csv = convertCsvToTuPartner(text);
      if (csv.ok) {
        return buildTuPartnerPreview(csv.payload, 'csv');
      }
      return { format: 'unknown', reason: csv.reason };
    }

    return { format: 'unknown' };
  }, [text]);

  const handleFile = async (file: File) => {
    try {
      const t = await file.text();
      setText(t);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'No se pudo leer el archivo';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleImport = async () => {
    if (!text.trim()) {
      toast({ title: 'Pega un JSON/CSV o sube un archivo', variant: 'destructive' });
      return;
    }

    if (preview.format === 'tupartner') {
      const parsedLeads = parseTuPartnerPayload(preview.payload);
      if (parsedLeads.length === 0) {
        toast({ title: 'No se encontraron leads válidos', variant: 'destructive' });
        return;
      }
      try {
        const result = await importTuPartner.mutateAsync({ parsed: parsedLeads, mode });
        toast({
          title: 'Importación completada',
          description: [
            `${result.inserted} nuevos`,
            `${result.updated} actualizados`,
            result.skipped ? `${result.skipped} omitidos` : null,
            result.stagesCreated ? `${result.stagesCreated} etapas creadas` : null,
            result.notesInserted ? `${result.notesInserted} notas` : null,
            result.errors ? `${result.errors} errores` : null,
          ].filter(Boolean).join(' · '),
        });
        setText('');
        onOpenChange(false);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Error al importar';
        toast({ title: 'Error', description: message, variant: 'destructive' });
      }
      return;
    }

    if (preview.format === 'meta') {
      const parsedLeads = parseMetaLeadPayload(preview.payload);
      if (parsedLeads.length === 0) {
        toast({ title: 'No se encontraron leads en el JSON', variant: 'destructive' });
        return;
      }
      try {
        const result = await importLeads.mutateAsync({
          parsed: parsedLeads,
          defaultStageId: defaultStageId || null,
        });
        toast({
          title: 'Importación completada',
          description: `${result.inserted} nuevos · ${result.skipped} duplicados omitidos${
            result.errors ? ` · ${result.errors} con error` : ''
          }`,
        });
        setText('');
        onOpenChange(false);
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Error al importar';
        toast({ title: 'Error', description: message, variant: 'destructive' });
      }
      return;
    }

    toast({
      title: 'Formato no reconocido',
      description:
        preview.format === 'unknown' && preview.reason
          ? preview.reason
          : 'Se esperaba un export de Meta, un JSON con { "leads": [...] } o un CSV con columnas como "fase", "Nombre del cliente potencial", etc.',
      variant: 'destructive',
    });
  };

  const isPending = importLeads.isPending || importTuPartner.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar leads</DialogTitle>
          <DialogDescription>
            Acepta tres formatos (se detectan automáticamente):
            <span className="mt-1 block text-[11px]">
              • <code className="rounded bg-muted px-1">{`{ data: [...] }`}</code> de Meta Graph API
              <br />• <code className="rounded bg-muted px-1">{`{ leads: [...] }`}</code> de exports CRM
              (HighLevel/TuPartner)
              <br />• <code className="rounded bg-muted px-1">.csv</code> de exports tipo HighLevel con
              columnas <em>fase, Notas, etiquetas, ID de oportunidad…</em>
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lead-file">Archivo JSON o CSV</Label>
              <label
                htmlFor="lead-file"
                className="flex h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input bg-background px-3 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              >
                <Upload className="h-4 w-4" />
                Selecciona o arrastra
                <input
                  id="lead-file"
                  type="file"
                  accept="application/json,.json,text/csv,.csv,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </label>
            </div>

            {preview.format === 'meta' ? (
              <div className="space-y-2">
                <Label>Etapa de destino</Label>
                <Select value={defaultStageId} onValueChange={setStageId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona etapa inicial" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                        {s.is_default_intake ? ' (por defecto)' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {preview.format === 'tupartner' ? (
              <div className="space-y-2">
                <Label>Si el lead ya existe</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upsert">Actualizar (etapa, cita, valor…)</SelectItem>
                    <SelectItem value="skip-existing">Omitir (no tocar)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="lead-json">Contenido (JSON o CSV)</Label>
            <Textarea
              id="lead-json"
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='Pega aquí el JSON o el contenido del CSV…'
              className="font-mono text-xs"
            />
          </div>

          {preview.format !== 'unknown' ? (
            <div className="rounded-lg border bg-muted/30 p-3 text-xs">
              <p className="flex items-center gap-2 font-semibold">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Formato detectado:{' '}
                {preview.format === 'tupartner' && preview.origin === 'csv'
                  ? FORMAT_LABEL['tupartner-csv']
                  : FORMAT_LABEL[preview.format]}
              </p>
              <p className="mt-1 text-muted-foreground">
                {preview.count} leads en el archivo
                {preview.format === 'tupartner'
                  ? ` · ${preview.notesCount} notas · ${preview.tagsCount} tags`
                  : ''}
                .
              </p>
              {preview.format === 'tupartner' && preview.stages.length > 0 ? (
                <div className="mt-2">
                  <p className="mb-1 font-semibold">Etapas detectadas (se crearán las que falten):</p>
                  <ul className="space-y-0.5">
                    {preview.stages.map((s) => (
                      <li key={s.name} className="flex items-baseline justify-between gap-2">
                        <span>{s.name}</span>
                        <span className="tabular-nums text-muted-foreground">{s.count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <FileJson className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>
                {preview.format === 'unknown' && preview.reason
                  ? preview.reason
                  : 'Pega un JSON o CSV, o sube un archivo, para ver la previsualización.'}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={isPending || preview.format === 'unknown'}>
            {isPending ? 'Importando…' : 'Importar leads'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
