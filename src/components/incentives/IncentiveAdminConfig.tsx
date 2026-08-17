import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAgendaEmployees } from '@/hooks/useAgendaEmployees';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import {
  useIncentiveAdminOverview,
  useIncentiveBonusRules,
  useIncentiveMilestones,
  useIncentiveSettings,
  usePatchIncentiveBonusRule,
  usePatchIncentiveMilestone,
  useReviewIncentiveRequest,
  useSaveIncentiveSettings,
} from '@/hooks/useIncentives';
import { formatMinutesAsHours, type IncentiveSettings } from '@/lib/incentives';
import { createDunasoftAppointmentDual } from '@/lib/dunasoftDualWriteApi';
import { parseUnavailability } from '@/lib/agendaHours';
import { supabase } from '@/lib/supabase';

function hhmm(value: string): string {
  return String(value || '').slice(0, 5);
}

export const IncentiveAdminConfig: React.FC = () => {
  const { toast } = useToast();
  const { companyId } = useCompanyFilter();
  const { data: settingsRow } = useIncentiveSettings();
  const { data: rules = [] } = useIncentiveBonusRules();
  const { data: milestones = [] } = useIncentiveMilestones();
  const { data: overview } = useIncentiveAdminOverview();
  const { employees } = useAgendaEmployees({ agendaOnly: false });
  const saveSettings = useSaveIncentiveSettings();
  const patchRule = usePatchIncentiveBonusRule();
  const patchMs = usePatchIncentiveMilestone();
  const review = useReviewIncentiveRequest();
  const [form, setForm] = useState<IncentiveSettings | null>(null);

  useEffect(() => {
    if (settingsRow) setForm(settingsRow);
    else if (companyId) {
      setForm({
        company_id: companyId,
        enabled: true,
        monthly_baseline_count: 4,
        min_eligible_amount: 100,
        type_a_minutes: 60,
        type_b_minutes: 30,
        type_a_min_amount: 450,
      });
    }
  }, [settingsRow, companyId]);

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const save = async () => {
    if (!form || !companyId) return;
    try {
      await saveSettings.mutateAsync({ ...form, company_id: companyId });
      toast({ title: 'Reglas de incentivo guardadas' });
    } catch (e) {
      toast({
        title: 'No se pudo guardar',
        description: e instanceof Error ? e.message : 'Error',
        variant: 'destructive',
      });
    }
  };

  const approve = async (requestId: string, employeeId: string, date: string, start: string, end: string) => {
    const emp = employeeById.get(employeeId);
    const startHm = hhmm(start);
    const endHm = hhmm(end);
    let appointmentId: string | null = null;
    let legacyIdplan: string | null = null;
    try {
      const codemp = String(emp?.dunasoft_codemp ?? '').trim();
      if (codemp && codemp !== '9999999') {
        try {
          const created = await createDunasoftAppointmentDual({
            codemp,
            codcli: '0',
            nomcli: 'HORAS LIBRES',
            fecha: date,
            horini: startHm,
            horfin: endHm,
            texto: 'Horas libres (incentivo bonos)',
          });
          appointmentId = created.appointment_id ?? null;
          legacyIdplan = created.legacy_idplan != null ? String(created.legacy_idplan) : null;
        } catch (agendaErr) {
          console.warn('incentive agenda block', agendaErr);
        }
      }
      if (emp) {
        const blocks = parseUnavailability(emp.unavailability);
        blocks.push({ date, start: startHm, end: endHm });
        await supabase.from('agenda_employees').update({ unavailability: blocks }).eq('id', emp.id);
      }
      await review.mutateAsync({
        requestId,
        approve: true,
        appointmentId,
        legacyIdplan,
      });
      toast({ title: 'Solicitud aprobada', description: 'Horas descontadas y tramo bloqueado en agenda.' });
    } catch (e) {
      toast({
        title: 'No se pudo aprobar',
        description: e instanceof Error ? e.message : 'Error',
        variant: 'destructive',
      });
    }
  };

  const reject = async (requestId: string) => {
    try {
      await review.mutateAsync({ requestId, approve: false });
      toast({ title: 'Solicitud rechazada' });
    } catch (e) {
      toast({
        title: 'No se pudo rechazar',
        description: e instanceof Error ? e.message : 'Error',
        variant: 'destructive',
      });
    }
  };

  if (!form) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Incentivos por venta de bonos</CardTitle>
          <CardDescription>
            Cupo mensual sin premio (recomendado: 4 bonos ≥ 100 €). A partir de ahí, tipo A +60 min y
            tipo B +30 min. Análisis feb–jul 2026: Betha y Marta ~5 bonos/mes de mediana; Mar ~4.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label>Activado</Label>
              <p className="text-xs text-muted-foreground">Si se desactiva, no se acreditan minutos nuevos.</p>
            </div>
            <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <Label>Cupo mensual (sin horas)</Label>
              <Input
                type="number"
                min={0}
                value={form.monthly_baseline_count}
                onChange={(e) => setForm({ ...form, monthly_baseline_count: Number(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Importe mínimo (€)</Label>
              <Input
                type="number"
                min={0}
                value={form.min_eligible_amount}
                onChange={(e) => setForm({ ...form, min_eligible_amount: Number(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Umbral tipo A (€)</Label>
              <Input
                type="number"
                min={0}
                value={form.type_a_min_amount}
                onChange={(e) => setForm({ ...form, type_a_min_amount: Number(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Minutos tipo A</Label>
              <Input
                type="number"
                min={0}
                value={form.type_a_minutes}
                onChange={(e) => setForm({ ...form, type_a_minutes: Number(e.target.value) || 0 })}
              />
            </div>
            <div>
              <Label>Minutos tipo B</Label>
              <Input
                type="number"
                min={0}
                value={form.type_b_minutes}
                onChange={(e) => setForm({ ...form, type_b_minutes: Number(e.target.value) || 0 })}
              />
            </div>
          </div>
          <Button onClick={save} disabled={saveSettings.isPending}>
            Guardar reglas
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Solicitudes pendientes</CardTitle>
          <CardDescription>Al aprobar se descuenta el saldo y se bloquea el tramo en la agenda.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {(overview?.pending ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay solicitudes pendientes.</p>
          ) : (
            (overview?.pending ?? []).map((req) => (
              <div key={req.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                <div className="text-sm">
                  <p className="font-medium">{req.employee_name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {req.requested_date} · {hhmm(req.start_time)}–{hhmm(req.end_time)} ·{' '}
                    {formatMinutesAsHours(req.minutes)}
                    {req.notes ? ` · ${req.notes}` : ''}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => reject(req.id)}
                    disabled={review.isPending}
                  >
                    Rechazar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      approve(req.id, String(req.employee_id), req.requested_date, req.start_time, req.end_time)
                    }
                    disabled={review.isPending}
                  >
                    Aprobar
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saldos por empleada</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-3">Empleada</th>
                  <th className="py-1 pr-3 text-right">Bonos mes</th>
                  <th className="py-1 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {(overview?.balances ?? []).map((row) => (
                  <tr key={row.employee_id} className="border-t">
                    <td className="py-1.5 pr-3">{row.employee_name}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{row.month_eligible}</td>
                    <td className="py-1.5 text-right tabular-nums">
                      {formatMinutesAsHours(Number(row.balance_minutes))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hitos opcionales</CardTitle>
          <CardDescription>
            Extra al alcanzar un recuento absoluto de bonos elegibles en el mes. Desactivados por defecto
            para no solapar el cupo + minutos por venta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {milestones.map((ms) => (
            <div key={ms.id} className="flex items-center justify-between gap-3 rounded-md border p-2">
              <span className="text-sm">
                {ms.eligible_count} bonos → +{formatMinutesAsHours(ms.extra_minutes)}
              </span>
              <Switch
                checked={ms.active}
                onCheckedChange={(v) => patchMs.mutate({ id: ms.id, patch: { active: v } })}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Catálogo de bonos</CardTitle>
          <CardDescription>A = corporal/láser grande; B = estándar; X = no incentiva (p.ej. personalizados).</CardDescription>
        </CardHeader>
        <CardContent className="max-h-[420px] overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-2">Bono</th>
                <th className="py-1 pr-2">€</th>
                <th className="py-1 pr-2">Tipo</th>
                <th className="py-1">Min</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => {
                const art = Array.isArray(rule.articles) ? rule.articles[0] : rule.articles;
                return (
                  <tr key={rule.id} className="border-t">
                    <td className="py-1 pr-2">
                      {art?.descripcion || rule.name_pattern || '—'}
                    </td>
                    <td className="py-1 pr-2 tabular-nums">{art?.precio != null ? Number(art.precio).toFixed(0) : '—'}</td>
                    <td className="py-1 pr-2">
                      <Select
                        value={rule.tier_code}
                        onValueChange={(v) =>
                          patchRule.mutate({
                            id: rule.id,
                            patch: {
                              tier_code: v as 'A' | 'B' | 'X',
                              minutes_per_sale: v === 'A' ? 60 : v === 'B' ? 30 : 0,
                            },
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-16">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">A</SelectItem>
                          <SelectItem value="B">B</SelectItem>
                          <SelectItem value="X">X</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="py-1">
                      <Input
                        type="number"
                        className="h-8 w-16"
                        defaultValue={rule.minutes_per_sale}
                        onBlur={(e) => {
                          const next = Number(e.target.value) || 0;
                          if (next === rule.minutes_per_sale) return;
                          patchRule.mutate({
                            id: rule.id,
                            patch: { minutes_per_sale: next },
                          });
                        }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
};
