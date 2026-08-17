import React, { useMemo, useState } from 'react';
import { Gift, Clock, Target, TrendingUp, Sparkles } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useCreateIncentiveRequest, useIncentiveMySummary } from '@/hooks/useIncentives';
import { formatMinutesAsHours } from '@/lib/incentives';

function monthShortLabel(label: string): string {
  const raw = String(label || '');
  const [y, m] = raw.split('-');
  if (!y || !m) return raw;
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
}

export const IncentiveDashboardBoard: React.FC = () => {
  const { toast } = useToast();
  const { data, isLoading, error } = useIncentiveMySummary();
  const createRequest = useCreateIncentiveRequest();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('12:00');
  const [notes, setNotes] = useState('');

  const isReception = data?.track === 'recepcion';

  const chartData = useMemo(() => {
    if (!data?.monthly?.length) return [];
    return data.monthly.map((row) => ({
      key: row.label,
      label: monthShortLabel(row.label),
      valor: isReception ? row.leads : Math.round(row.amount_eur),
      horas: Number(row.tier_hours) || 0,
      isCurrent: row.is_current,
    }));
  }, [data?.monthly, isReception]);

  const progressPct = useMemo(() => {
    if (!data) return 0;
    const current = isReception ? data.month_leads : data.month_amount_eur;
    const next = Number(data.next_threshold ?? 0);
    if (next <= 0) return 100;
    return Math.min(100, Math.round((current / next) * 100));
  }, [data, isReception]);

  if (isLoading || error || !data?.linked || !data.enabled || data.track === 'none') return null;

  const currentValue = isReception ? data.month_leads : data.month_amount_eur;
  const unit = isReception ? 'presentadas' : '€';
  const remaining = data.remaining_to_next;
  const nextHours = data.next_tier_hours;
  const cashValue = (data.balance_minutes / 60) * data.cash_per_hour;
  const recent = (data.history ?? [])
    .filter((h) => (isReception ? h.source === 'lead' : h.source === 'sale'))
    .slice(0, 6);

  const submit = async () => {
    try {
      await createRequest.mutateAsync({
        date,
        startTime: start,
        endTime: end,
        notes: notes.trim() || undefined,
      });
      toast({ title: 'Solicitud enviada', description: 'Gerencia debe aprobar el disfrute.' });
      setOpen(false);
      setNotes('');
    } catch (e) {
      toast({
        title: 'No se pudo solicitar',
        description: e instanceof Error ? e.message : 'Error',
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <Card className="overflow-hidden border-emerald-200/70 shadow-lg">
        <div className="bg-gradient-to-br from-emerald-700 via-teal-700 to-slate-800 px-5 py-4 text-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-emerald-100/90">
                <Gift className="h-3.5 w-3.5" />
                Incentivos · {isReception ? 'Recepción' : 'Cabina'}
              </p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight">Tu tramo del mes</h3>
              <p className="mt-0.5 text-sm text-emerald-50/85">
                {isReception
                  ? `Más de ${Math.max(0, data.lead_min_count - 1)} presentadas → 4 h · cada +${data.lead_step_count} → +2 h`
                  : `≥${data.revenue_min_eur.toFixed(0)} € → ${data.revenue_base_hours} h · cada +${data.revenue_step_eur.toFixed(0)} € → +${data.revenue_step_hours} h`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold tabular-nums">{formatMinutesAsHours(data.balance_minutes)}</p>
              <p className="text-xs text-emerald-100/80">Saldo · ~{cashValue.toFixed(0)} € a {data.cash_per_hour} €/h</p>
            </div>
          </div>
        </div>

        <CardContent className="space-y-5 p-5">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" />
                Parcial mes actual
              </p>
              <p className="mt-2 text-3xl font-bold tabular-nums text-foreground">
                {isReception ? currentValue : `${Math.round(currentValue).toLocaleString('es-ES')} €`}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Tramo ganado: <span className="font-medium text-foreground">{data.month_tier_hours} h</span>
                {isReception ? ` · ${data.month_leads} ${unit}` : ` · ventas imputadas`}
              </p>
            </div>

            <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/50 p-4 dark:bg-emerald-950/20 md:col-span-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                    <Target className="h-3.5 w-3.5" />
                    Siguiente paso
                  </p>
                  <p className="mt-1 text-lg font-semibold text-foreground">
                    {remaining <= 0 ? (
                      '¡Tramo máximo del mes al día!'
                    ) : isReception ? (
                      <>
                        Faltan <span className="tabular-nums text-emerald-700 dark:text-emerald-300">{remaining}</span>{' '}
                        presentadas para {nextHours} h
                      </>
                    ) : (
                      <>
                        Faltan{' '}
                        <span className="tabular-nums text-emerald-700 dark:text-emerald-300">
                          {remaining.toLocaleString('es-ES', { maximumFractionDigits: 0 })} €
                        </span>{' '}
                        para {nextHours} h
                      </>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                    Meta: {isReception ? `${data.next_threshold} presentadas` : `${Number(data.next_threshold).toLocaleString('es-ES')} €`}
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-emerald-600/10 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                  <Sparkles className="h-3.5 w-3.5" />
                  {progressPct}%
                </div>
              </div>
              <Progress value={progressPct} className="mt-3 h-3" />
              <div className="mt-2 flex justify-between text-[11px] text-muted-foreground tabular-nums">
                <span>
                  {isReception
                    ? `${data.month_leads} / ${data.next_threshold}`
                    : `${Math.round(data.month_amount_eur).toLocaleString('es-ES')} / ${Number(data.next_threshold).toLocaleString('es-ES')} €`}
                </span>
                <span>Siguiente recompensa: {nextHours} h</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-3 rounded-lg border border-border/60 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Totales por mes</p>
                <p className="text-[11px] text-muted-foreground">
                  {isReception ? 'Presentadas · horas de tramo' : 'Importe € · horas de tramo'}
                </p>
              </div>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} width={40} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} width={28} />
                    <Tooltip
                      formatter={(value, name) => {
                        const n = Number(value ?? 0);
                        if (name === 'valor') {
                          return [
                            isReception ? `${n} presentadas` : `${n.toLocaleString('es-ES')} €`,
                            isReception ? 'Leads' : 'Importe',
                          ];
                        }
                        return [`${n} h`, 'Horas'];
                      }}
                      labelFormatter={(label) => String(label).toUpperCase()}
                    />
                    <Bar yAxisId="left" dataKey="valor" radius={[4, 4, 0, 0]} maxBarSize={36}>
                      {chartData.map((entry) => (
                        <Cell
                          key={entry.key}
                          fill={entry.isCurrent ? 'hsl(160 84% 32%)' : 'hsl(160 40% 55%)'}
                        />
                      ))}
                    </Bar>
                    <Bar
                      yAxisId="right"
                      dataKey="horas"
                      fill="hsl(199 70% 42%)"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={18}
                      opacity={0.85}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="lg:col-span-2 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">Parciales recientes</p>
                <Button size="sm" onClick={() => setOpen(true)} disabled={data.balance_minutes < 15}>
                  <Clock className="mr-1.5 h-4 w-4" />
                  Solicitar horas
                </Button>
              </div>
              {recent.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Aún no hay {isReception ? 'presentadas' : 'ventas'} imputadas este periodo.
                </p>
              ) : (
                <ul className="space-y-1.5 text-xs">
                  {recent.map((row) => (
                    <li
                      key={row.id}
                      className="flex items-center justify-between gap-2 rounded-md border border-border/50 px-2.5 py-1.5"
                    >
                      <span className="truncate text-muted-foreground">
                        {row.occurred_at} · {row.notes || (isReception ? 'Lead' : 'Bono')}
                      </span>
                      <span className="shrink-0 font-medium tabular-nums text-foreground">
                        {isReception ? '+1' : `${Number(row.amount_eur ?? 0).toFixed(0)} €`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-auto rounded-md bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
                Cada venta o presentada suma al parcial. Al cruzar el siguiente umbral se acreditan las
                horas del tramo en tu bolsa.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar horas libres</DialogTitle>
            <DialogDescription>
              Saldo disponible: {formatMinutesAsHours(data.balance_minutes)}. Tras la aprobación se
              bloquea el tramo en la agenda.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>Fecha</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Desde</Label>
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div>
                <Label>Hasta</Label>
                <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Notas</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={!date || createRequest.isPending}>
              Enviar solicitud
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
