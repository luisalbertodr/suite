import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, Save, Plus, Trash2 } from 'lucide-react';
import { dunasoftSupabase } from '@/lib/dunasoftSupabase';
import type { DunasoftPlanArtInput } from '@/lib/dunasoftDualWrite';
import type { Employee } from '@/types/agenda';
import { calcEndFromStart } from '@/lib/agendaAppointmentItems';
import { AGENDA_APPOINTMENT_MODAL_Z } from '@/lib/agendaResourceColors';
import { DOCK_CLEARANCE_BOTTOM } from '@/lib/dialogLayers';
import {
  AppointmentClientePicker,
  type AppointmentClientPick,
} from '@/components/forms/AppointmentClientePicker';

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
  const [planart, setPlanart] = useState<DunasoftPlanArtInput[]>(
    initial?.planart?.length
      ? initial.planart
      : [{ codart: '', hora: startTime }],
  );

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

  const { data: articulos = [] } = useQuery({
    queryKey: ['dunasoft-articulos-agenda'],
    queryFn: async () => {
      const res = await dunasoftSupabase
        .from('articulos')
        .select('codart,desart,tiempo,obsoleto')
        .order('desart')
        .limit(800);
      if (res.error) throw res.error;
      return (res.data ?? []).filter((a) => (a as { obsoleto?: boolean }).obsoleto !== true);
    },
    staleTime: 120_000,
  });

  const articuloByCode = useMemo(() => {
    const m = new Map<string, { desart: string; tiempo?: string | null }>();
    for (const a of articulos) {
      const code = String((a as { codart?: string }).codart ?? '').trim();
      if (code) m.set(code, { desart: String((a as { desart?: string }).desart ?? ''), tiempo: (a as { tiempo?: string }).tiempo });
    }
    return m;
  }, [articulos]);

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
      planart: planart.filter((p) => p.codart.trim()),
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
              <div className="flex items-center justify-between">
                <Label>Servicios (planart)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setPlanart((rows) => [...rows, { codart: '', hora: horini }])}
                >
                  <Plus className="w-3 h-3 mr-1" /> Línea
                </Button>
              </div>
              {planart.map((row, idx) => (
                <div key={idx} className="flex gap-1 items-end">
                  <div className="flex-1">
                    <Input
                      list="dunasoft-articulos"
                      value={row.codart}
                      placeholder="Cód. artículo"
                      onChange={(e) => {
                        const cod = e.target.value;
                        setPlanart((rows) => {
                          const next = [...rows];
                          const meta = articuloByCode.get(cod.trim());
                          const mins = parseInt(String(meta?.tiempo ?? '15'), 10) || 15;
                          next[idx] = { ...next[idx]!, codart: cod, hora: next[idx]!.hora || horini };
                          if (idx === rows.length - 1) setHorfin(calcEndFromStart(horini, mins * rows.length));
                          return next;
                        });
                      }}
                    />
                  </div>
                  <Input
                    className="w-20"
                    value={row.hora ?? ''}
                    placeholder="HH:mm"
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
                    onClick={() => setPlanart((rows) => rows.filter((_, i) => i !== idx))}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <datalist id="dunasoft-articulos">
                {articulos.slice(0, 200).map((a) => (
                  <option key={String(a.codart)} value={String(a.codart)}>
                    {String(a.desart ?? '')}
                  </option>
                ))}
              </datalist>
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
