import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useAgendaEmployees, type AgendaEmployee } from '@/hooks/useAgendaEmployees';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useToast } from '@/hooks/use-toast';
import { DeactivateAgendaEmployeeDialog } from '@/components/DeactivateAgendaEmployeeDialog';
import {
  type AgendaDayHoursMap,
  type AgendaTimeSegment,
  type AgendaUnavailabilityEntry,
  DEFAULT_AGENDA_CENTER_HOURS,
  parseAgendaDayHoursMap,
  parseUnavailability,
} from '@/lib/agendaHours';
import { format } from 'date-fns';
import { Plus, Trash2 } from 'lucide-react';

const DAY_ROWS: { key: string; label: string }[] = [
  { key: '0', label: 'Domingo' },
  { key: '1', label: 'Lunes' },
  { key: '2', label: 'Martes' },
  { key: '3', label: 'Miércoles' },
  { key: '4', label: 'Jueves' },
  { key: '5', label: 'Viernes' },
  { key: '6', label: 'Sábado' },
];

function firstSeg(day: AgendaTimeSegment[] | undefined): { open: string; close: string } {
  const s = day?.[0];
  return { open: s?.open ?? '10:00', close: s?.close ?? '20:30' };
}

type EmpEdit = {
  useCustom: boolean;
  weekly: AgendaDayHoursMap;
  blocks: AgendaUnavailabilityEntry[];
  /** Menor = más a la izquierda en la agenda. */
  agenda_sort_order: number;
};

function empToEdit(emp: AgendaEmployee): EmpEdit {
  const wh = emp.weekly_hours;
  const useCustom = wh != null && typeof wh === 'object';
  const ord = emp.agenda_sort_order;
  return {
    useCustom,
    weekly: useCustom ? parseAgendaDayHoursMap(wh) : { ...DEFAULT_AGENDA_CENTER_HOURS },
    blocks: parseUnavailability(emp.unavailability),
    agenda_sort_order: typeof ord === 'number' && Number.isFinite(ord) ? ord : 0,
  };
}

export const AgendaEmployeeHoursConfig: React.FC = () => {
  const { toast } = useToast();
  const { companyId } = useCompanyFilter();
  const { employees, isLoading, updateEmployee } = useAgendaEmployees({ agendaOnly: false });
  const [edits, setEdits] = useState<Record<string, EmpEdit>>({});
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const next: Record<string, EmpEdit> = {};
    for (const e of employees) {
      next[e.id] = empToEdit(e);
    }
    setEdits(next);
  }, [employees]);

  const patchEdit = (id: string, patch: Partial<EmpEdit>) => {
    setEdits((prev) => {
      const cur = prev[id];
      if (!cur) return prev;
      return { ...prev, [id]: { ...cur, ...patch } };
    });
  };

  const saveOne = async (emp: AgendaEmployee) => {
    const st = edits[emp.id];
    if (!st) return;
    const blocksClean = st.blocks.filter((b) => /^\d{4}-\d{2}-\d{2}$/.test(b.date));
    try {
      const ord = Math.max(0, Math.floor(Number(st.agenda_sort_order)) || 0);
      await updateEmployee.mutateAsync({
        id: emp.id,
        weekly_hours: st.useCustom ? st.weekly : null,
        unavailability: blocksClean,
        agenda_sort_order: ord,
      });
      toast({ title: `Guardado: ${emp.name}` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al guardar';
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    }
  };

  const reassignmentTargets = employees
    .filter((e) => e.active !== false && e.id !== deactivateTarget?.id)
    .map((e) => ({
      id: e.id,
      name: e.name,
      label: `${e.name} (${e.id.slice(0, 8)})`,
    }));

  const sortedEmployees = React.useMemo(() => {
    return [...employees].sort((a, b) => {
      const ao = a.agenda_sort_order ?? 0;
      const bo = b.agenda_sort_order ?? 0;
      if (ao !== bo) return ao - bo;
      const ac = a.active === false ? 1 : 0;
      const bc = b.active === false ? 1 : 0;
      if (ac !== bc) return ac - bc;
      return a.name.localeCompare(b.name, 'es');
    });
  }, [employees]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Horario por empleado</CardTitle>
          <CardDescription>Cargando…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <DeactivateAgendaEmployeeDialog
        open={deactivateOpen}
        onOpenChange={(o) => {
          setDeactivateOpen(o);
          if (!o) setDeactivateTarget(null);
        }}
        employeeId={deactivateTarget?.id ?? null}
        employeeName={deactivateTarget?.name ?? ''}
        companyId={companyId}
        reassignmentTargets={reassignmentTargets}
      />
      <CardHeader>
        <CardTitle>Horario por empleado (agenda)</CardTitle>
        <CardDescription>
          Activa o desactiva cada profesional en la vista de agenda, define la posición de su columna (número más
          bajo = más a la izquierda) y el horario. Los inactivos se pueden editar y reactivar aquí. Por defecto aplica
          el horario del centro; «Horario personalizado» marca tramos sombreados (orientativo). Las excepciones «No
          disponible» sí impiden reservar en esos tramos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {sortedEmployees.map((emp) => {
          const st = edits[emp.id] ?? empToEdit(emp);
          const isInactive = emp.active === false;
          return (
            <div
              key={emp.id}
              className={`border rounded-lg p-4 space-y-4 ${isInactive ? 'opacity-80 border-dashed bg-muted/20' : ''}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <h4 className="font-medium break-words">{emp.name}</h4>
                  {isInactive && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                      Inactivo
                    </span>
                  )}
                </div>
                <Button size="sm" variant="secondary" onClick={() => saveOne(emp)}>
                  Guardar este empleado
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={emp.active !== false}
                  onCheckedChange={(v) => {
                    if (v === true) {
                      void updateEmployee.mutateAsync({ id: emp.id, active: true });
                      return;
                    }
                    setDeactivateTarget({ id: emp.id, name: emp.name });
                    setDeactivateOpen(true);
                  }}
                />
                <Label className="text-sm">Activo en la agenda</Label>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Posición en la agenda</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    className="h-8 w-24"
                    value={st.agenda_sort_order}
                    onChange={(e) => {
                      const v = Math.max(0, Math.floor(Number(e.target.value)) || 0);
                      patchEdit(emp.id, { agenda_sort_order: v });
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground pb-1 max-w-sm">
                  Orden de la columna de izquierda a derecha (0 = primera). Guarda para aplicar en la vista agenda.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={st.useCustom}
                  onCheckedChange={(v) =>
                    patchEdit(emp.id, {
                      useCustom: v === true,
                      weekly: v ? st.weekly : { ...DEFAULT_AGENDA_CENTER_HOURS },
                    })
                  }
                />
                <Label className="text-sm">Horario personalizado (si no, aplica el del centro)</Label>
              </div>

              {st.useCustom && (
                <div className="space-y-3 pl-1">
                  {DAY_ROWS.map(({ key, label }) => {
                    const segs = st.weekly[key] ?? [];
                    const closed = segs.length === 0;
                    const { open, close } = firstSeg(segs);
                    return (
                      <div key={key} className="flex flex-wrap items-end gap-3 border-b border-dashed pb-2">
                        <div className="w-24 text-xs font-medium text-muted-foreground">{label}</div>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`e-${emp.id}-${key}-closed`}
                            checked={closed}
                            onCheckedChange={(v) => {
                              const on = v === true;
                              setEdits((prev) => {
                                const cur = prev[emp.id] ?? empToEdit(emp);
                                return {
                                  ...prev,
                                  [emp.id]: {
                                    ...cur,
                                    weekly: {
                                      ...cur.weekly,
                                      [key]: on ? [] : [{ open: '10:00', close: '20:30' }],
                                    },
                                  },
                                };
                              });
                            }}
                          />
                          <Label htmlFor={`e-${emp.id}-${key}-closed`} className="text-xs cursor-pointer">
                            Cerrado
                          </Label>
                        </div>
                        {!closed && (
                          <div className="flex flex-wrap gap-2">
                            <Input
                              type="time"
                              className="h-8 w-28"
                              value={open}
                              onChange={(e) =>
                                setEdits((prev) => {
                                  const cur = prev[emp.id] ?? empToEdit(emp);
                                  return {
                                    ...prev,
                                    [emp.id]: {
                                      ...cur,
                                      weekly: {
                                        ...cur.weekly,
                                        [key]: [{ open: e.target.value, close }],
                                      },
                                    },
                                  };
                                })
                              }
                            />
                            <Input
                              type="time"
                              className="h-8 w-28"
                              step={300}
                              value={close}
                              onChange={(e) =>
                                setEdits((prev) => {
                                  const cur = prev[emp.id] ?? empToEdit(emp);
                                  return {
                                    ...prev,
                                    [emp.id]: {
                                      ...cur,
                                      weekly: {
                                        ...cur.weekly,
                                        [key]: [{ open, close: e.target.value }],
                                      },
                                    },
                                  };
                                })
                              }
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-sm">No disponible (excepciones)</Label>
                {st.blocks.map((blk, idx) => (
                  <div key={`${emp.id}-b-${idx}`} className="flex flex-wrap items-end gap-2 p-2 rounded-md bg-muted/40">
                    <Input
                      type="date"
                      className="h-8 w-40"
                      value={blk.date}
                      onChange={(e) => {
                        const arr = [...st.blocks];
                        arr[idx] = { ...blk, date: e.target.value };
                        patchEdit(emp.id, { blocks: arr });
                      }}
                    />
                    <div className="flex items-center gap-1">
                      <Checkbox
                        id={`ad-${emp.id}-${idx}`}
                        checked={Boolean(blk.allDay)}
                        onCheckedChange={(v) => {
                          const arr = [...st.blocks];
                          arr[idx] = {
                            ...blk,
                            allDay: v === true,
                            start: v === true ? undefined : blk.start ?? '12:00',
                            end: v === true ? undefined : blk.end ?? '14:00',
                          };
                          patchEdit(emp.id, { blocks: arr });
                        }}
                      />
                      <Label htmlFor={`ad-${emp.id}-${idx}`} className="text-xs">
                        Todo el día
                      </Label>
                    </div>
                    {!blk.allDay && (
                      <>
                        <Input
                          type="time"
                          className="h-8 w-28"
                          value={blk.start ?? '12:00'}
                          onChange={(e) => {
                            const arr = [...st.blocks];
                            arr[idx] = { ...blk, start: e.target.value };
                            patchEdit(emp.id, { blocks: arr });
                          }}
                        />
                        <Input
                          type="time"
                          className="h-8 w-28"
                          value={blk.end ?? '14:00'}
                          onChange={(e) => {
                            const arr = [...st.blocks];
                            arr[idx] = { ...blk, end: e.target.value };
                            patchEdit(emp.id, { blocks: arr });
                          }}
                        />
                      </>
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0"
                      onClick={() => patchEdit(emp.id, { blocks: st.blocks.filter((_, i) => i !== idx) })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() =>
                    patchEdit(emp.id, {
                      blocks: [...st.blocks, { date: format(new Date(), 'yyyy-MM-dd'), allDay: true }],
                    })
                  }
                >
                  <Plus className="h-3.5 w-3.5" /> Añadir excepción
                </Button>
              </div>
            </div>
          );
        })}
        {employees.length === 0 && <p className="text-sm text-muted-foreground">No hay empleados en la empresa.</p>}
      </CardContent>
    </Card>
  );
};
