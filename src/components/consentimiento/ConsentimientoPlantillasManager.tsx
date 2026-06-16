import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, X } from 'lucide-react';
import { CONSENTIMIENTO_VARIABLE_HINTS } from '@/lib/consentimientoVariables';
import type { ConsentimientoPlantilla } from '@/lib/consentimientoTypes';

interface Props {
  onClose: () => void;
}

export const ConsentimientoPlantillasManager: React.FC<Props> = ({ onClose }) => {
  const { companyId } = useCompanyFilter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    tipo: '',
    titulo: '',
    contenido: '',
    codigo: '',
    keywords: '',
    orden: 0,
    activo: true,
  });

  const { data: plantillas = [], refetch } = useQuery({
    queryKey: ['consentimiento-plantillas-manager', companyId],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consentimiento_plantillas')
        .select('*')
        .eq('company_id', companyId!)
        .order('titulo', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ConsentimientoPlantilla[];
    },
  });

  const startCreate = () => {
    setSelectedId(null);
    setIsCreating(true);
    setForm({ tipo: '', titulo: '', contenido: '', codigo: '', keywords: '', orden: 0, activo: true });
  };

  const openEdit = (p: ConsentimientoPlantilla) => {
    setSelectedId(p.id);
    setIsCreating(false);
    setForm({
      tipo: p.tipo,
      titulo: p.titulo,
      contenido: p.contenido,
      codigo: p.codigo ?? '',
      keywords: p.keywords ?? '',
      orden: p.orden ?? 0,
      activo: p.activo,
    });
  };

  const savePlantilla = async () => {
    if (!companyId) return;
    if (!form.tipo.trim() || !form.titulo.trim()) {
      toast({ title: 'Tipo y título son obligatorios', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (selectedId) {
        const current = plantillas.find((p) => p.id === selectedId);
        const nextVersion = (current?.version ?? 1) + (current?.contenido !== form.contenido ? 1 : 0);
        const { error } = await supabase
          .from('consentimiento_plantillas')
          .update({
            tipo: form.tipo.trim(),
            titulo: form.titulo.trim(),
            contenido: form.contenido,
            codigo: form.codigo.trim() || null,
            keywords: form.keywords.trim() || null,
            orden: form.orden,
            activo: form.activo,
            version: nextVersion,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedId);
        if (error) throw error;
        toast({ title: 'Plantilla actualizada' });
      } else {
        const { error } = await supabase.from('consentimiento_plantillas').insert({
          company_id: companyId,
          tipo: form.tipo.trim(),
          titulo: form.titulo.trim(),
          contenido: form.contenido,
          codigo: form.codigo.trim() || null,
          keywords: form.keywords.trim() || null,
          orden: form.orden,
          activo: form.activo,
        });
        if (error) throw error;
        toast({ title: 'Plantilla creada' });
        setIsCreating(false);
      }
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['consentimiento-plantillas', companyId] });
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : 'Error al guardar',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const deletePlantilla = async () => {
    if (!selectedId) return;
    if (!window.confirm('¿Eliminar esta plantilla? Los consentimientos ya firmados no se borran.')) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('consentimiento_plantillas').delete().eq('id', selectedId);
      if (error) throw error;
      toast({ title: 'Plantilla eliminada' });
      setSelectedId(null);
      setIsCreating(false);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['consentimiento-plantillas', companyId] });
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : 'Error al eliminar',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const showEditor = isCreating || selectedId;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-background rounded-xl shadow-xl w-full max-w-5xl h-[85vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b flex items-center justify-between shrink-0">
          <h3 className="text-lg font-semibold">Plantillas de consentimiento informado</h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] flex-1 min-h-0">
          <div className="border-r p-3 overflow-auto space-y-2">
            <Button size="sm" className="w-full" onClick={startCreate}>
              <Plus className="w-4 h-4 mr-1" /> Nueva plantilla
            </Button>
            {plantillas.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`w-full text-left border rounded-md px-3 py-2 text-sm ${
                  selectedId === p.id ? 'bg-sky-50 border-sky-300' : 'hover:bg-muted/50'
                }`}
                onClick={() => openEdit(p)}
              >
                <div className="font-medium truncate">{p.titulo}</div>
                <div className="text-xs text-muted-foreground flex justify-between gap-2">
                  <span className="truncate">{p.tipo}</span>
                  {!p.activo ? <span className="text-amber-600">Inactiva</span> : null}
                </div>
              </button>
            ))}
          </div>

          <div className="p-4 overflow-auto space-y-4">
            {!showEditor ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Crea o selecciona una plantilla para editar el texto del consentimiento.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label>Código (opcional)</Label>
                    <Input
                      value={form.codigo}
                      onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))}
                      placeholder="indiba_deep_beauty_2024"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Palabras clave (servicio/cita)</Label>
                    <Input
                      value={form.keywords}
                      onChange={(e) => setForm((f) => ({ ...f, keywords: e.target.value }))}
                      placeholder="indiba,radiofrecuencia,capacitiva"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label>Orden</Label>
                    <Input
                      type="number"
                      value={form.orden}
                      onChange={(e) => setForm((f) => ({ ...f, orden: Number(e.target.value) || 0 }))}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo *</Label>
                    <Input
                      value={form.tipo}
                      onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                      placeholder="Ej: Tratamiento estético"
                    />
                  </div>
                  <div>
                    <Label>Título *</Label>
                    <Input
                      value={form.titulo}
                      onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.activo}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, activo: v }))}
                  />
                  <Label>Activa (visible al firmar)</Label>
                </div>
                <div>
                  <Label>Contenido</Label>
                  <Textarea
                    value={form.contenido}
                    onChange={(e) => setForm((f) => ({ ...f, contenido: e.target.value }))}
                    rows={14}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Variables:{' '}
                    {CONSENTIMIENTO_VARIABLE_HINTS.map((v) => `{${v.key}}`).join(', ')}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={savePlantilla} disabled={saving}>
                    {saving ? 'Guardando…' : 'Guardar plantilla'}
                  </Button>
                  {selectedId ? (
                    <Button variant="destructive" onClick={deletePlantilla} disabled={deleting}>
                      <Trash2 className="w-4 h-4 mr-1" />
                      {deleting ? 'Eliminando…' : 'Eliminar'}
                    </Button>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
