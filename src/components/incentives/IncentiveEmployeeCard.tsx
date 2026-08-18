import React, { useState } from 'react';
import { Gift, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  formatMinutesAsHours,
  incentiveLeadProgress,
  incentiveRevenueProgress,
  orientationHoursFromMonthly,
} from '@/lib/incentives';

export const IncentiveEmployeeCard: React.FC = () => {
  const { toast } = useToast();
  const { data, isLoading, error } = useIncentiveMySummary();
  const createRequest = useCreateIncentiveRequest();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('12:00');
  const [notes, setNotes] = useState('');

  if (isLoading || error || !data?.linked || !data.enabled || data.track === 'none') return null;

  const isReception = data.track === 'recepcion';
  const progress = isReception
    ? incentiveLeadProgress(data.month_leads, data.lead_min_count, data.lead_step_count)
    : incentiveRevenueProgress(data.month_amount_eur, data.revenue_min_eur, data.revenue_step_eur);

  const history = (data.history ?? [])
    .filter((h) => (isReception ? h.source === 'lead' : h.source === 'sale'))
    .slice(0, 8);

  const cashValue = (data.balance_minutes / 60) * data.cash_per_hour;

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
      <Card className="border-emerald-200/80 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gift className="h-4 w-4 text-emerald-700" />
            Bolsa de horas libres
          </CardTitle>
          <CardDescription>
            {isReception
              ? `Leads de marketing que acuden a la cita (Presentada). Desde ${data.lead_min_count}: 4 h; cada +${data.lead_step_count} → +2 h.`
              : `Bonos desde ${data.revenue_min_eur.toFixed(0)} €/mes → 4 h; cada +${data.revenue_step_eur.toFixed(0)} € → +2 h. Alternativa: ${data.cash_per_hour} €/h.`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-bold tabular-nums">{formatMinutesAsHours(data.balance_minutes)}</p>
              <p className="text-xs text-muted-foreground">
                Saldo efectivo desde septiembre · equiv. {cashValue.toFixed(0)} € a {data.cash_per_hour} €/h
              </p>
              {orientationHoursFromMonthly(data.monthly) > 0 ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Orientación hasta 31 ago: {orientationHoursFromMonthly(data.monthly).toLocaleString('es-ES')} h · consumidas
                </p>
              ) : null}
            </div>
            <Button size="sm" onClick={() => setOpen(true)} disabled={data.balance_minutes < 15}>
              <Clock className="mr-1.5 h-4 w-4" />
              Solicitar horas
            </Button>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{progress.label}</span>
              <span className="tabular-nums">
                {isReception
                  ? `${data.month_leads} presentadas`
                  : `${data.month_amount_eur.toFixed(0)} €`}
              </span>
            </div>
            <Progress value={progress.pct} className="h-2" />
            <p className="text-xs text-muted-foreground tabular-nums">
              Tramo del mes: {data.month_tier_hours} h (
              {formatMinutesAsHours(data.month_awarded_minutes)})
            </p>
          </div>
          {history.length > 0 ? (
            <ul className="space-y-1 text-xs">
              {history.map((row) => (
                <li key={row.id} className="flex justify-between gap-2 tabular-nums">
                  <span className="truncate text-muted-foreground">
                    {row.occurred_at} · {row.notes || (isReception ? 'Lead' : 'Bono')}
                    {!isReception && row.share_pct < 100 ? ` (${row.share_pct}%)` : ''}
                  </span>
                  <span className="text-muted-foreground">
                    {isReception
                      ? '+1'
                      : `${Number(row.amount_eur ?? 0).toFixed(0)} €`}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              {isReception
                ? 'Aún no hay leads presentados imputados este mes.'
                : 'Aún no hay ventas imputadas este periodo.'}
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar horas libres</DialogTitle>
            <DialogDescription>
              Saldo disponible: {formatMinutesAsHours(data.balance_minutes)}. Tras la aprobación se
              bloquea el tramo en la agenda. Si prefieres dinero, pide a gerencia el abono a{' '}
              {data.cash_per_hour} €/h.
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
