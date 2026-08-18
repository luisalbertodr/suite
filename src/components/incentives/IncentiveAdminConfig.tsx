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
import { useWorkCenter } from '@/hooks/useWorkCenter';
import {
  useCashIncentivePayout,
  useIncentiveAdminOverview,
  useIncentiveEmployeeTracks,
  useIncentiveSettings,
  useReviewIncentiveRequest,
  useSaveIncentiveSettings,
  useUpsertIncentiveEmployeeTrack,
} from '@/hooks/useIncentives';
import {
  formatMinutesAsHours,
  hoursFromRevenue,
  INCENTIVE_TRACK_LABELS,
  type IncentiveSettings,
  type IncentiveTrack,
} from '@/lib/incentives';
import { createDunasoftAppointmentDual } from '@/lib/dunasoftDualWriteApi';
import { parseUnavailability } from '@/lib/agendaHours';
import { supabase } from '@/lib/supabase';

function hhmm(value: string): string {
  return String(value || '').slice(0, 5);
}

function defaultSettings(companyId: string): IncentiveSettings {
  return {
    company_id: companyId,
    enabled: true,
    min_eligible_amount: 100,
    revenue_min_eur: 2000,
    revenue_step_eur: 500,
    revenue_base_hours: 4,
    revenue_step_hours: 2,
    cash_per_hour: 10,
    lead_min_count: 10,
    lead_step_count: 3,
    lead_base_hours: 4,
    lead_step_hours: 2,
  };
}

export const IncentiveAdminConfig: React.FC = () => {
  const { toast } = useToast();
  const { companyId } = useCompanyFilter();
  const { operationalCompanyId } = useWorkCenter();
  const scopeCompanyId = operationalCompanyId ?? companyId;
  const { data: settingsRow } = useIncentiveSettings();
  const { data: overview } = useIncentiveAdminOverview();
  const { data: tracks = [] } = useIncentiveEmployeeTracks();
  const { employees } = useAgendaEmployees({ agendaOnly: false });
  const saveSettings = useSaveIncentiveSettings();
  const upsertTrack = useUpsertIncentiveEmployeeTrack();
  const cashPayout = useCashIncentivePayout();
  const review = useReviewIncentiveRequest();
  const [form, setForm] = useState<IncentiveSettings | null>(null);
  const [cashHours, setCashHours] = useState<Record<string, string>>({});
  const [localTracks, setLocalTracks] = useState<Record<string, IncentiveTrack>>({});

  useEffect(() => {
    if (settingsRow) setForm(settingsRow);
    else if (companyId) setForm(defaultSettings(companyId));
  }, [settingsRow, companyId]);

  const employeeById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const trackByEmployee = useMemo(() => {
    const map = new Map<string, IncentiveTrack>();
    for (const row of overview?.balances ?? []) {
      if (row.track) map.set(row.employee_id, row.track);
    }
    for (const t of tracks) map.set(t.employee_id, t.track);
    for (const [id, track] of Object.entries(localTracks)) map.set(id, track);
    return map;
  }, [overview?.balances, tracks, localTracks]);

  const tierPreview = useMemo(() => {
    if (!form) return [];
    const rows: Array<{ eur: number; hours: number }> = [];
    for (let eur = form.revenue_min_eur; eur <= form.revenue_min_eur + form.revenue_step_eur * 6; eur += form.revenue_step_eur) {
      rows.push({
        eur,
        hours: hoursFromRevenue(
          eur,
          form.revenue_min_eur,
          form.revenue_step_eur,
          form.revenue_base_hours,
          form.revenue_step_hours,
        ),
      });
    }
    return rows;
  }, [form]);

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

  const setTrack = async (employeeId: string, track: IncentiveTrack) => {
    if (!scopeCompanyId) return;
    setLocalTracks((prev) => ({ ...prev, [employeeId]: track }));
    try {
      await upsertTrack.mutateAsync({
        employee_id: employeeId,
        company_id: scopeCompanyId,
        track,
        active: true,
      });
      toast({ title: 'Pista actualizada', description: INCENTIVE_TRACK_LABELS[track] });
    } catch (e) {
      setLocalTracks((prev) => {
        const next = { ...prev };
        delete next[employeeId];
        return next;
      });
      toast({
        title: 'No se pudo cambiar la pista',
        description: e instanceof Error ? e.message : 'Error',
        variant: 'destructive',
      });
    }
  };

  const payCash = async (employeeId: string, name: string) => {
    if (!companyId) return;
    const hours = Number(cashHours[employeeId] || 0);
    if (hours <= 0) {
      toast({ title: 'Indica las horas a abonar', variant: 'destructive' });
      return;
    }
    try {
      const res = await cashPayout.mutateAsync({
        companyId,
        employeeId,
        hours,
        notes: `Abono metálico a ${name}`,
      });
      toast({
        title: 'Abono registrado',
        description: `${hours} h → ${res.euros.toFixed(0)} € descontados del saldo.`,
      });
      setCashHours((prev) => ({ ...prev, [employeeId]: '' }));
    } catch (e) {
      toast({
        title: 'No se pudo abonar',
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
            texto: 'Horas libres (incentivo)',
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
          <CardTitle>Incentivos por tramos</CardTitle>
          <CardDescription>
            Cabina: importe de bonos ≥ {form.revenue_min_eur.toFixed(0)} € → {form.revenue_base_hours} h;
            cada +{form.revenue_step_eur.toFixed(0)} € → +{form.revenue_step_hours} h. Alternativa
            metálico: {form.cash_per_hour} €/h. Recepción (Gemma): leads Presentada ≥{' '}
            {form.lead_min_count} → {form.lead_base_hours} h; cada +{form.lead_step_count} → +
            {form.lead_step_hours} h (más de 9 presentadas).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label>Activado</Label>
              <p className="text-xs text-muted-foreground">Si se desactiva, no se acreditan tramos nuevos.</p>
            </div>
            <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Cabina (venta de bonos)</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <Label>Mínimo € / mes</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.revenue_min_eur}
                  onChange={(e) => setForm({ ...form, revenue_min_eur: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Paso €</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.revenue_step_eur}
                  onChange={(e) => setForm({ ...form, revenue_step_eur: Number(e.target.value) || 1 })}
                />
              </div>
              <div>
                <Label>Horas en el mínimo</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.revenue_base_hours}
                  onChange={(e) => setForm({ ...form, revenue_base_hours: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Horas por paso</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.revenue_step_hours}
                  onChange={(e) => setForm({ ...form, revenue_step_hours: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Bono mínimo (€)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.min_eligible_amount}
                  onChange={(e) => setForm({ ...form, min_eligible_amount: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>€ por hora (metálico)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.cash_per_hour}
                  onChange={(e) => setForm({ ...form, cash_per_hour: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Vista rápida:{' '}
              {tierPreview.map((r) => `${r.eur.toFixed(0)}€→${r.hours}h`).join(' · ')}
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Recepción (leads presentados)</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label>Mínimo presentadas</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.lead_min_count}
                  onChange={(e) => setForm({ ...form, lead_min_count: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Paso (leads)</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.lead_step_count}
                  onChange={(e) => setForm({ ...form, lead_step_count: Number(e.target.value) || 1 })}
                />
              </div>
              <div>
                <Label>Horas en el mínimo</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.lead_base_hours}
                  onChange={(e) => setForm({ ...form, lead_base_hours: Number(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Horas por paso</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.lead_step_hours}
                  onChange={(e) => setForm({ ...form, lead_step_hours: Number(e.target.value) || 0 })}
                />
              </div>
            </div>
          </div>

          <Button onClick={save} disabled={saveSettings.isPending}>
            Guardar reglas
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pista por empleada</CardTitle>
          <CardDescription>
            Cabina suma importe de bonos; recepción suma leads en Presentada; ninguna no participa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {employees
            .filter((e) => e.active !== false && String(e.dunasoft_codemp ?? '') !== '9999999')
            .map((emp) => {
              const track = trackByEmployee.get(emp.id) ?? 'none';
              return (
              <div key={emp.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
                <div className="min-w-0">
                  <span className="text-sm">{emp.name}</span>
                  <p className="text-[11px] text-muted-foreground">{INCENTIVE_TRACK_LABELS[track]}</p>
                </div>
                <Select
                  value={track}
                  onValueChange={(v) => setTrack(emp.id, v as IncentiveTrack)}
                >
                  <SelectTrigger className="h-8 w-36">
                    <SelectValue placeholder="Ninguna" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cabina">Cabina</SelectItem>
                    <SelectItem value="recepcion">Recepción</SelectItem>
                    <SelectItem value="none">Ninguna</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              );
            })}
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
                  <Button size="sm" variant="outline" onClick={() => reject(req.id)} disabled={review.isPending}>
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
          <CardTitle>Saldos y abono metálico</CardTitle>
          <CardDescription>
            El saldo efectivo empieza el 1 de septiembre. Las horas hasta el 31 de agosto son de
            orientación y quedan consumidas. Puedes convertir horas efectivas en dinero a{' '}
            {form.cash_per_hour} €/h.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-3">Empleada</th>
                  <th className="py-1 pr-3">Pista</th>
                  <th className="py-1 pr-3 text-right">Mes</th>
                  <th className="py-1 pr-3 text-right">Tramo</th>
                  <th className="py-1 pr-3 text-right">Saldo efectivo</th>
                  <th className="py-1 pr-3 text-right">Orientación</th>
                  <th className="py-1">Abono €</th>
                </tr>
              </thead>
              <tbody>
                {(overview?.balances ?? []).map((row) => (
                  <tr key={row.employee_id} className="border-t">
                    <td className="py-1.5 pr-3">{row.employee_name}</td>
                    <td className="py-1.5 pr-3 text-xs text-muted-foreground">
                      {row.track ? INCENTIVE_TRACK_LABELS[row.track] : '—'}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {row.track === 'recepcion'
                        ? `${row.month_leads ?? 0} leads`
                        : `${Number(row.month_amount_eur ?? 0).toFixed(0)} €`}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {formatMinutesAsHours(Number(row.month_tier_minutes ?? 0))}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">
                      {formatMinutesAsHours(Number(row.balance_minutes))}
                    </td>
                    <td className="py-1.5 pr-3 text-right tabular-nums text-muted-foreground">
                      {Number(row.orientation_minutes ?? 0) > 0
                        ? `${formatMinutesAsHours(Number(row.orientation_minutes))} · consumidas`
                        : '—'}
                    </td>
                    <td className="py-1.5">
                      {(row.track === 'cabina' || row.track === 'recepcion') && Number(row.balance_minutes) > 0 ? (
                        <div className="flex items-center gap-1">
                          <Input
                            className="h-8 w-16"
                            type="number"
                            min={0}
                            step={0.5}
                            placeholder="h"
                            value={cashHours[row.employee_id] ?? ''}
                            onChange={(e) =>
                              setCashHours((prev) => ({ ...prev, [row.employee_id]: e.target.value }))
                            }
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={cashPayout.isPending}
                            onClick={() => payCash(row.employee_id, row.employee_name)}
                          >
                            Pagar
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
