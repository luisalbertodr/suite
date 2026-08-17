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
import { formatMinutesAsHours, incentiveProgress } from '@/lib/incentives';

export const IncentiveEmployeeCard: React.FC = () => {
  const { toast } = useToast();
  const { data, isLoading, error } = useIncentiveMySummary();
  const createRequest = useCreateIncentiveRequest();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState('');
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('12:00');
  const [notes, setNotes] = useState('');

  if (isLoading || error || !data?.linked || !data.enabled) return null;

  const progress = incentiveProgress(data.month_eligible, data.baseline);
  const history = (data.history ?? []).filter((h) => h.source === 'sale').slice(0, 8);

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
      <Card className="border-violet-200/80 shadow-lg">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Gift className="h-4 w-4 text-violet-600" />
            Bolsa de horas libres
          </CardTitle>
          <CardDescription>
            Por ventas de bonos por encima de {data.baseline} al mes (los de menos de 100 € no cuentan).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-3xl font-bold tabular-nums">{formatMinutesAsHours(data.balance_minutes)}</p>
              <p className="text-xs text-muted-foreground">Saldo acumulado</p>
            </div>
            <Button size="sm" onClick={() => setOpen(true)} disabled={data.balance_minutes < 15}>
              <Clock className="mr-1.5 h-4 w-4" />
              Solicitar horas
            </Button>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{progress.label}</span>
              {data.next_milestone ? (
                <span>
                  Hito {data.next_milestone.count}: +{formatMinutesAsHours(data.next_milestone.extra_minutes)}
                </span>
              ) : null}
            </div>
            <Progress value={progress.pct} className="h-2" />
            <p className="text-xs text-muted-foreground tabular-nums">
              Este mes: {formatMinutesAsHours(data.month_awarded_minutes)} acreditados
            </p>
          </div>
          {history.length > 0 ? (
            <ul className="space-y-1 text-xs">
              {history.map((row) => (
                <li key={row.id} className="flex justify-between gap-2 tabular-nums">
                  <span className="truncate text-muted-foreground">
                    {row.occurred_at} · {row.notes || 'Bono'}
                    {row.share_pct < 100 ? ` (${row.share_pct}%)` : ''}
                  </span>
                  <span className={Number(row.minutes) > 0 ? 'text-emerald-600' : 'text-muted-foreground'}>
                    {Number(row.minutes) > 0 ? `+${formatMinutesAsHours(Number(row.minutes))}` : 'cupo'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">Aún no hay ventas imputadas este periodo.</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Solicitar horas libres</DialogTitle>
            <DialogDescription>
              Saldo disponible: {formatMinutesAsHours(data.balance_minutes)}. Tras la aprobación se bloquea
              el tramo en la agenda.
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
