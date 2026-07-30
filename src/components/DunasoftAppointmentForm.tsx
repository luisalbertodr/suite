import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import type { DunasoftPlanArtInput } from '@/lib/dunasoftDualWrite';
import type { Employee } from '@/types/agenda';
import { calcEndFromStart } from '@/lib/agendaAppointmentItems';
import { AGENDA_APPOINTMENT_MODAL_Z } from '@/lib/agendaResourceColors';
import { DOCK_CLEARANCE_BOTTOM } from '@/lib/dialogLayers';
import {
  AppointmentClientePicker,
  type AppointmentClientPick,
} from '@/components/forms/AppointmentClientePicker';
import {
  AppointmentArticleFamilyPicker,
  type AppointmentArticleOption,
} from '@/components/forms/AppointmentArticleFamilyPicker';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { supabase } from '@/lib/supabase';
import { DEFAULT_APPOINTMENT_SERVICE_MINUTES } from '@/lib/appointmentArticleKind';

export type DunasoftAppointmentFormValues = {
  codemp: string;
  codcli: string;
  nomcli: string;
  tel1cli: string;
  fecha: string;
  horini: string;
  horfin: string;
  texto: string;
  planart: DunasoftPlanArtInput[];
  customer_id?: string | null;
};

type PlanArtDraft = DunasoftPlanArtInput & {
  articleId?: string | null;
};

type Props = {
  mode: 'create' | 'edit';
  employeeId: string;
  employees: Employee[];
  defaultDate: string;
  startTime: string;
  initial?: Partial<DunasoftAppointmentFormValues>;
  idplan?: string;
  saving?: boolean;
  onSave: (values: DunasoftAppointmentFormValues) => void;
  onCancel: () => void;
};

function serviceMinutes(article?: AppointmentArticleOption | null): number {
  const mins = article?.duration_minutes;
  if (typeof mins === 'number' && mins > 0) return mins;
  return DEFAULT_APPOINTMENT_SERVICE_MINUTES;
}

function recalcHorfin(rows: PlanArtDraft[], start: string, articlesById: Map<string, AppointmentArticleOption>): string {
  const totalMins = rows.reduce((sum, row) => {
    const article = row.articleId ? articlesById.get(row.articleId) : undefined;
    return sum + serviceMinutes(article);
  }, 0);
  return calcEndFromStart(start, totalMins || DEFAULT_APPOINTMENT_SERVICE_MINUTES);
}

export const DunasoftAppointmentForm: React.FC<Props> = ({
  mode,
  employeeId,
  employees,
  defaultDate,
  startTime,
  initial,
  idplan,
  saving,
  onSave,
  onCancel,
}) => {
  const employee = employees.find((e) => e.id === employeeId);
  const { companyId } = useCompanyFilter();
  const { catalogHostCompanyId } = useWorkCenter();
  const catalogCompanyId = catalogHostCompanyId ?? companyId;

  const [clientPick, setClientPick] = useState<AppointmentClientPick | null>(() => {
    const name = (initial?.nomcli ?? '').trim();
    if (!name) return null;
    return { kind: 'manual', name };
  });
  const [codcli, setCodcli] = useState(initial?.codcli ?? '');
  const [nomcli, setNomcli] = useState(initial?.nomcli ?? '');
  const [tel1cli, setTel1cli] = useState(initial?.tel1cli ?? '');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [fecha, setFecha] = useState(initial?.fecha ?? defaultDate);
  const [horini, setHorini] = useState(initial?.horini ?? startTime);
  const [horfin, setHorfin] = useState(initial?.horfin ?? calcEndFromStart(startTime, 45));
  const [texto, setTexto] = useState(initial?.texto ?? '');
  const [planart, setPlanart] = useState<PlanArtDraft[]>(
    initial?.planart?.length
      ? initial.planart.map((row) => ({ ...row }))
      : [{ codart: '', hora: startTime, articleId: null }],
  );
  const [articleCache, setArticleCache] = useState<Map<string, AppointmentArticleOption>>(new Map());

  const initialCodarts = useMemo(
    () => [...new Set((initial?.planart ?? []).map((row) => row.codart.trim()).filter(Boolean))],
    [initial?.planart],
  );

  const { data: resolvedArticles = [] } = useQuery({
    queryKey: ['dunasoft-planart-articles', catalogCompanyId, initialCodarts],
    enabled: Boolean(catalogCompanyId && initialCodarts.length > 0),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('id,codigo,descripcion,descripcion_larga,precio,duration_minutes,article_kind,estado,familia,recurso_id')
        .eq('company_id', catalogCompanyId!)
        .eq('estado', 'activo')
        .in('codigo', initialCodarts);
      if (error) throw error;
      return (data ?? []) as AppointmentArticleOption[];
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!resolvedArticles.length) return;
    const byCode = new Map(resolvedArticles.map((a) => [String(a.codigo ?? '').trim(), a]));
    setArticleCache((prev) => {
      const next = new Map(prev);
      for (const article of resolvedArticles) next.set(article.id, article);
      return next;
    });
    setPlanart((rows) =>
      rows.map((row) => {
        if (row.articleId) return row;
        const code = row.codart.trim();
        const article = code ? byCode.get(code) : undefined;
        return article ? { ...row, articleId: article.id, desart: article.descripcion } : row;
      }),
    );
  }, [resolvedArticles]);

  useEffect(() => {
    if (!clientPick) return;
    if (clientPick.kind === 'manual') {
      setNomcli(clientPick.name);
      setCustomerId(null);
      return;
    }
    setNomcli(clientPick.displayName);
    setCodcli(String(clientPick.legacyCodcli ?? '').trim());
    setTel1cli(String(clientPick.phone ?? '').trim());
    setCustomerId(clientPick.customerId);
  }, [clientPick]);

  const applyArticleAt = (index: number, article: AppointmentArticleOption) => {
    setArticleCache((prev) => {
      const next = new Map(prev);
      next.set(article.id, article);
      return next;
    });
    setPlanart((rows) => {
      const next = [...rows];
      const mins = serviceMinutes(article);
      next[index] = {
        ...next[index]!,
        codart: String(article.codigo ?? '').trim(),
        desart: article.descripcion,
        articleId: article.id,
        hora: next[index]!.hora || horini,
      };
      setHorfin(calcEndFromStart(horini, mins * next.filter((r) => r.codart.trim()).length));
      return next;
    });
  };

  const clearArticleAt = (index: number) => {
    setPlanart((rows) => {
      const next = [...rows];
      next[index] = { ...next[index]!, codart: '', desart: '', articleId: null };
      setHorfin(recalcHorfin(next, horini, articleCache));
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomcli.trim() && !codcli.trim()) return;
    onSave({
      codemp: employeeId,
      codcli: codcli.trim() || '0',
      nomcli: nomcli.trim() || codcli.trim(),
      tel1cli: tel1cli.trim(),
      fecha,
      horini,
      horfin,
      texto: texto.trim(),
      planart: planart
        .filter((p) => p.codart.trim())
        .map(({ codart, hora, desart }) => ({ codart, hora, desart })),
      customer_id: customerId,
    });
  };

  return (
    <div
      className={`fixed inset-x-0 top-0 ${DOCK_CLEARANCE_BOTTOM} flex items-center justify-center bg-black/40 p-4 ${AGENDA_APPOINTMENT_MODAL_Z}`}
    >
      <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <CardTitle className="text-base">
            {mode === 'create' ? 'Nueva cita Style' : `Editar cita ${idplan ?? ''}`}
          </CardTitle>
          <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="text-xs text-muted-foreground rounded-md border border-border/60 bg-muted/30 px-2 py-1.5">
              Profesional: <strong>{employee?.name ?? employeeId}</strong>
              <span className="ml-2">· Suite + Dunasoft + cola DBF</span>
            </div>

            <div className="space-y-1">
              <Label>Cliente</Label>
              <AppointmentClientePicker
                lazySearch
                value={clientPick}
                onChange={setClientPick}
                disabled={saving}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="ds-nomcli">Nombre</Label>
                <Input id="ds-nomcli" value={nomcli} onChange={(e) => setNomcli(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="ds-codcli">Cód. cliente</Label>
                <Input id="ds-codcli" value={codcli} onChange={(e) => setCodcli(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="ds-tel">Teléfono</Label>
              <Input id="ds-tel" value={tel1cli} onChange={(e) => setTel1cli(e.target.value)} />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label htmlFor="ds-fecha">Fecha</Label>
                <Input id="ds-fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="ds-ini">Inicio</Label>
                <Input id="ds-ini" value={horini} onChange={(e) => setHorini(e.target.value)} required />
              </div>
              <div>
                <Label htmlFor="ds-fin">Fin</Label>
                <Input id="ds-fin" value={horfin} onChange={(e) => setHorfin(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Servicios</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={saving}
                  onClick={() => setPlanart((rows) => [...rows, { codart: '', hora: horini, articleId: null }])}
                >
                  <Plus className="w-3 h-3 mr-1" /> Línea
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Toca el servicio para abrir la rejilla gráfica con familias y fotos.
              </p>
              {planart.map((row, idx) => {
                const cached = row.articleId ? articleCache.get(row.articleId) : undefined;
                const selectedLabel =
                  cached?.descripcion?.trim() ||
                  row.desart?.trim() ||
                  (row.codart.trim() ? row.codart : undefined);
                return (
                  <div key={idx} className="flex gap-1 items-center">
                    <div className="min-w-0 flex-1">
                      <AppointmentArticleFamilyPicker
                        value={row.articleId ?? null}
                        itemKind="service"
                        selectedLabel={selectedLabel}
                        selectedUnitPrice={cached?.precio}
                        placeholder="Elegir servicio…"
                        triggerClassName="h-9 text-xs"
                        primaryOpensGrid
                        disabled={saving}
                        onSelect={(article) => applyArticleAt(idx, article)}
                        onClear={() => clearArticleAt(idx)}
                      />
                    </div>
                    <Input
                      className="w-20 h-9 shrink-0"
                      value={row.hora ?? ''}
                      placeholder="HH:mm"
                      disabled={saving}
                      onChange={(e) => {
                        const h = e.target.value;
                        setPlanart((rows) => {
                          const next = [...rows];
                          next[idx] = { ...next[idx]!, hora: h };
                          return next;
                        });
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 shrink-0"
                      disabled={saving || planart.length <= 1}
                      onClick={() => setPlanart((rows) => rows.filter((_, i) => i !== idx))}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>

            <div>
              <Label htmlFor="ds-texto">Notas</Label>
              <Textarea id="ds-texto" value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                <Save className="w-4 h-4 mr-1" />
                {saving ? 'Guardando…' : mode === 'create' ? 'Crear cita' : 'Guardar cambios'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
