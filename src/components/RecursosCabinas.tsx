import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Edit2, DoorOpen, Cpu, X, Check } from 'lucide-react';
import { useCabinas, useRecursos } from '@/hooks/useRecursosCabinas';
import { Skeleton } from '@/components/ui/skeleton';
import { ReportFilterMultiSelect } from '@/components/reports/ReportFilterMultiSelect';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import {
  RECURSO_COLOR_PALETTE,
  suggestRecursoColor,
  suggestRecursoKeywords,
  resolveRecursoColor,
} from '@/lib/agendaRecursoMatch';

const CABINA_COLORS = RECURSO_COLOR_PALETTE;

export const RecursosCabinas: React.FC = () => {
  return (
    <div className="space-y-6">
      <Tabs defaultValue="cabinas">
        <TabsList className="grid grid-cols-2 w-64">
          <TabsTrigger value="cabinas" className="gap-1.5">
            <DoorOpen className="w-4 h-4" /> Cabinas
          </TabsTrigger>
          <TabsTrigger value="recursos" className="gap-1.5">
            <Cpu className="w-4 h-4" /> Recursos
          </TabsTrigger>
        </TabsList>

        <div className="mt-4">
          <TabsContent value="cabinas"><CabinasPanel /></TabsContent>
          <TabsContent value="recursos"><RecursosPanel /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

// ---------- CABINAS ----------

const CabinasPanel: React.FC = () => {
  const { cabinas, create, update, remove } = useCabinas();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ nombre: '', descripcion: '', capacidad: 1, color: '#8B5CF6' });

  const resetForm = () => { setForm({ nombre: '', descripcion: '', capacidad: 1, color: '#8B5CF6' }); setShowForm(false); setEditId(null); };

  const handleSave = () => {
    if (editId) {
      update.mutate({ id: editId, ...form }, { onSuccess: resetForm });
    } else {
      create.mutate(form, { onSuccess: resetForm });
    }
  };

  const startEdit = (c: any) => {
    setForm({ nombre: c.nombre, descripcion: c.descripcion || '', capacidad: c.capacidad, color: c.color || '#8B5CF6' });
    setEditId(c.id);
    setShowForm(true);
  };

  if (cabinas.isLoading) {
    return <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { resetForm(); setShowForm(!showForm); }}>
          {showForm ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
          {showForm ? 'Cancelar' : 'Nueva Cabina'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombre *</Label>
                <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Cabina 1" />
              </div>
              <div>
                <Label>Capacidad</Label>
                <Input type="number" min={1} value={form.capacidad} onChange={(e) => setForm({ ...form, capacidad: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label>Descripción</Label>
              <Input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripción opcional" />
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex gap-2 mt-1">
                {CABINA_COLORS.map(c => (
                  <button
                    key={c}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm({ ...form, color: c })}
                  />
                ))}
              </div>
            </div>
            <Button onClick={handleSave} disabled={!form.nombre || create.isPending || update.isPending}>
              <Check className="w-4 h-4 mr-1" /> {editId ? 'Actualizar' : 'Crear'}
            </Button>
          </CardContent>
        </Card>
      )}

      {!cabinas.data?.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <DoorOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No hay cabinas configuradas</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cabinas.data.map((c) => (
            <Card key={c.id} className="overflow-hidden">
              <div className="h-2" style={{ backgroundColor: c.color || '#8B5CF6' }} />
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-semibold">{c.nombre}</h4>
                    {c.descripcion && <p className="text-xs text-muted-foreground mt-0.5">{c.descripcion}</p>}
                    <p className="text-xs text-muted-foreground mt-1">Capacidad: {c.capacidad}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${c.activa ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                    <Button variant="ghost" size="sm" onClick={() => startEdit(c)}><Edit2 className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {
                      if (window.confirm('¿Eliminar cabina?')) remove.mutate(c.id);
                    }}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------- RECURSOS ----------

type ServicioOption = { id: string; label: string; recurso_id: string | null };

const RecursosPanel: React.FC = () => {
  const { recursos, create, update, remove, syncTratamientos, companyId } = useRecursos();
  const { cabinas } = useCabinas();
  const { companyId: filterCompanyId } = useCompanyFilter();
  const { catalogHostCompanyId } = useWorkCenter();
  const catalogCompanyId = catalogHostCompanyId ?? filterCompanyId ?? companyId;

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [tratamientoIds, setTratamientoIds] = useState<string[]>([]);
  const [initialTratamientoIds, setInitialTratamientoIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    tipo: 'equipamiento',
    cabina_id: '' as string | null,
    color: '#3B82F6',
    match_keywords: '',
  });

  const serviciosQuery = useQuery({
    queryKey: ['recurso-servicios', catalogCompanyId],
    queryFn: async (): Promise<ServicioOption[]> => {
      const { data, error } = await supabase
        .from('articles')
        .select('id,codigo,descripcion,recurso_id,estado')
        .eq('company_id', catalogCompanyId!)
        .eq('article_kind', 'servicio')
        .eq('estado', 'activo')
        .order('descripcion');
      if (error) throw error;
      return (data || []).map((a) => ({
        id: a.id,
        label: `${a.codigo ? `${a.codigo} — ` : ''}${a.descripcion}`.trim(),
        recurso_id: a.recurso_id ?? null,
      }));
    },
    enabled: !!catalogCompanyId,
  });

  const servicioOptions = useMemo(() => {
    const rows = serviciosQuery.data || [];
    // En edición: mostrar todos los servicios activos + los ya vinculados
    // Al elegir, se pueden reasignar desde otro recurso.
    return rows.map((r) => ({ value: r.id, label: r.label }));
  }, [serviciosQuery.data]);

  const resetForm = () => {
    setForm({
      nombre: '',
      descripcion: '',
      tipo: 'equipamiento',
      cabina_id: null,
      color: '#3B82F6',
      match_keywords: '',
    });
    setTratamientoIds([]);
    setInitialTratamientoIds([]);
    setShowForm(false);
    setEditId(null);
  };

  const onNombreChange = (nombre: string) => {
    setForm((prev) => {
      const next = { ...prev, nombre };
      if (!editId && nombre.trim()) {
        if (!prev.match_keywords.trim()) {
          next.match_keywords = suggestRecursoKeywords(nombre);
        }
        if (prev.color === '#3B82F6' || !prev.color) {
          next.color = suggestRecursoColor(nombre);
        }
      }
      return next;
    });
  };

  const persistTratamientos = async (recursoId: string) => {
    await syncTratamientos.mutateAsync({
      recursoId,
      articleIds: tratamientoIds,
      previousArticleIds: initialTratamientoIds,
    });
  };

  const handleSave = async () => {
    const payload = { ...form, cabina_id: form.cabina_id || null };
    if (editId) {
      update.mutate(
        { id: editId, ...payload },
        {
          onSuccess: async () => {
            try {
              await persistTratamientos(editId);
            } finally {
              resetForm();
            }
          },
        }
      );
      return;
    }
    create.mutate(payload, {
      onSuccess: async (created) => {
        try {
          if (created?.id && tratamientoIds.length) {
            await persistTratamientos(created.id);
          }
        } finally {
          resetForm();
        }
      },
    });
  };

  const startEdit = (r: any) => {
    setForm({
      nombre: r.nombre,
      descripcion: r.descripcion || '',
      tipo: r.tipo,
      cabina_id: r.cabina_id || null,
      color: r.color || suggestRecursoColor(r.nombre),
      match_keywords: r.match_keywords || suggestRecursoKeywords(r.nombre),
    });
    const linked = (serviciosQuery.data || [])
      .filter((s) => s.recurso_id === r.id)
      .map((s) => s.id);
    setTratamientoIds(linked);
    setInitialTratamientoIds(linked);
    setEditId(r.id);
    setShowForm(true);
  };

  useEffect(() => {
    if (!editId || !serviciosQuery.data) return;
    const linked = serviciosQuery.data.filter((s) => s.recurso_id === editId).map((s) => s.id);
    setTratamientoIds(linked);
    setInitialTratamientoIds(linked);
  }, [editId, serviciosQuery.data]);

  if (recursos.isLoading) {
    return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16" />)}</div>;
  }

  const activeRecursos = (recursos.data || []).filter((r) => r.activo !== false);
  const inactiveRecursos = (recursos.data || []).filter((r) => r.activo === false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { resetForm(); setShowForm(!showForm); }}>
          {showForm ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
          {showForm ? 'Cancelar' : 'Nuevo Recurso'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombre *</Label>
                <Input value={form.nombre} onChange={(e) => onNombreChange(e.target.value)} placeholder="Láser, IPL, LPG…" />
              </div>
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equipamiento">Equipamiento</SelectItem>
                    <SelectItem value="aparatologia">Aparatología</SelectItem>
                    <SelectItem value="consumible">Consumible</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Palabras clave en servicios</Label>
              <Input
                value={form.match_keywords}
                onChange={(e) => setForm({ ...form, match_keywords: e.target.value })}
                placeholder="ipl,laser,lumbar,dorsal"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Separadas por coma. Si el nombre del servicio contiene alguna, se asigna este recurso al tramo en la agenda.
              </p>
            </div>
            <ReportFilterMultiSelect
              label="Tratamientos exclusivos"
              options={servicioOptions}
              value={tratamientoIds}
              onChange={setTratamientoIds}
              placeholder="Seleccionar tratamientos…"
              searchPlaceholder="Buscar servicio…"
              emptyLabel="Ninguno (solo por palabras clave)"
            />
            <p className="text-[11px] text-muted-foreground -mt-2">
              Estos servicios asignarán automáticamente este recurso (y su color) en la cita; se puede cambiar después.
            </p>
            <div>
              <Label>Color en agenda</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {RECURSO_COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => setForm({ ...form, color: c })}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label>Descripción</Label>
              <Input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            </div>
            <div>
              <Label>Cabina Asignada (opcional)</Label>
              <Select value={form.cabina_id || 'none'} onValueChange={(v) => setForm({ ...form, cabina_id: v === 'none' ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {cabinas.data?.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleSave}
              disabled={!form.nombre || create.isPending || update.isPending || syncTratamientos.isPending}
            >
              <Check className="w-4 h-4 mr-1" /> {editId ? 'Actualizar' : 'Crear'}
            </Button>
          </CardContent>
        </Card>
      )}

      {!activeRecursos.length ? (
        <div className="text-center py-12 text-muted-foreground">
          <Cpu className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No hay recursos configurados</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeRecursos.map((r) => {
            const linkedCount = (serviciosQuery.data || []).filter((s) => s.recurso_id === r.id).length;
            return (
              <Card key={r.id} className="overflow-hidden">
                <div className="h-1.5" style={{ backgroundColor: resolveRecursoColor(r) }} />
                <CardContent className="py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-3 h-3 rounded-full shrink-0 border border-black/10"
                      style={{ backgroundColor: resolveRecursoColor(r) }}
                    />
                    <div className={`w-2 h-2 rounded-full ${r.activo ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{r.nombre}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize">{r.tipo}</span>
                        {(r as any).dunasoft_codrec && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 border border-sky-100">
                            Style: {(r as any).dunasoft_codrec}
                          </span>
                        )}
                        {linkedCount > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-100">
                            {linkedCount} tratamiento{linkedCount === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                      {(r as any).match_keywords && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-md">
                          Claves: {(r as any).match_keywords}
                        </p>
                      )}
                      {(r as any).cabinas?.nombre && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <DoorOpen className="w-3 h-3" /> {(r as any).cabinas.nombre}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" onClick={() => startEdit(r)}><Edit2 className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {
                      if (window.confirm('¿Eliminar recurso?')) remove.mutate(r.id);
                    }}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {inactiveRecursos.length > 0 && (
        <div className="pt-4 space-y-2">
          <p className="text-xs text-muted-foreground">Inactivos / fusionados ({inactiveRecursos.length})</p>
          {inactiveRecursos.map((r) => (
            <Card key={r.id} className="opacity-60">
              <CardContent className="py-2 flex items-center justify-between">
                <span className="text-sm text-muted-foreground line-through">{r.nombre}</span>
                <Button variant="ghost" size="sm" onClick={() => startEdit(r)}><Edit2 className="w-3.5 h-3.5" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
