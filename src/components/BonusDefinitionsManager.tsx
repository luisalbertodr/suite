import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Plus, X } from 'lucide-react';
import { BonusDefinitionItemsEditor, type BonoCoverageItem } from '@/components/bonus/BonusDefinitionItemsEditor';

type CoverageItem = BonoCoverageItem;

interface Props {
  onClose: () => void;
}

export const BonusDefinitionsManager: React.FC<Props> = ({ onClose }) => {
  const { companyId } = useCompanyFilter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    default_price: 0,
    default_total_sessions: 1,
    items: [] as CoverageItem[],
  });

  const { data: definitions = [], refetch } = useQuery({
    queryKey: ['bonus-definitions-manager', companyId],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bonus_definitions')
        .select(`
          id, code, name, description, default_price, default_total_sessions,
          bonus_definition_items(id,coverage_type,article_id,family_code,covered_quantity,notes,articles:article_id(codigo,descripcion))
        `)
        .eq('company_id', companyId!)
        .order('name', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: articles = [] } = useQuery({
    queryKey: ['bonus-definitions-articles', companyId],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('id,codigo,descripcion,article_kind,familia,estado')
        .eq('company_id', companyId!)
        .eq('estado', 'activo')
        .order('descripcion');
      if (error) throw error;
      return data ?? [];
    },
  });

  const startCreate = () => {
    setSelectedId(null);
    setIsCreating(true);
    setForm({
      code: '',
      name: '',
      description: '',
      default_price: 0,
      default_total_sessions: 1,
      items: [],
    });
  };

  const openEdit = (d: any) => {
    setSelectedId(String(d.id));
    setIsCreating(false);
    setForm({
      code: d.code ?? '',
      name: d.name ?? '',
      description: d.description ?? '',
      default_price: Number(d.default_price ?? 0),
      default_total_sessions: Number(d.default_total_sessions ?? 1),
      items: (d.bonus_definition_items ?? []).map((it: any) => {
        const a = it.articles;
        const lbl =
          a && (typeof a === 'object')
            ? `${(a as any).codigo ? `${(a as any).codigo} - ` : ''}${(a as any).descripcion || 'Artículo'}`.trim()
            : (it.family_code ? `Familia ${it.family_code}` : 'Cobertura');
        return {
        id: it.id,
        coverage_type: (it.coverage_type ?? 'service') as CoverageItem['coverage_type'],
        article_id: it.article_id ?? null,
        family_code: it.family_code ?? null,
        covered_quantity: Number(it.covered_quantity ?? 1),
        label: it.notes || lbl,
      };
      }),
    });
  };

  const saveDefinition = async () => {
    if (!companyId) return;
    if (!form.code.trim() || !form.name.trim()) {
      toast({ title: 'Código y nombre son obligatorios', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      let definitionId = selectedId;
      if (selectedId) {
        const { error } = await supabase
          .from('bonus_definitions')
          .update({
            code: form.code.trim(),
            name: form.name.trim(),
            description: form.description || null,
            default_price: Number(form.default_price || 0),
            default_total_sessions: Number(form.default_total_sessions || 1),
          })
          .eq('id', selectedId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('bonus_definitions')
          .insert({
            company_id: companyId,
            code: form.code.trim(),
            name: form.name.trim(),
            description: form.description || null,
            default_price: Number(form.default_price || 0),
            default_total_sessions: Number(form.default_total_sessions || 1),
            source: 'manual',
          })
          .select('id')
          .single();
        if (error) throw error;
        definitionId = data.id;
      }

      await supabase.from('bonus_definition_items').delete().eq('definition_id', definitionId!);
      if (form.items.length > 0) {
        const payload = form.items.map((it) => ({
          definition_id: definitionId!,
          coverage_type: it.coverage_type,
          article_id: it.coverage_type === 'family' ? null : (it.article_id ?? null),
          family_code: it.coverage_type === 'family' ? (it.family_code ?? null) : null,
          covered_quantity: Number(it.covered_quantity || 0),
          notes: it.label || null,
        }));
        const { error: itemErr } = await supabase.from('bonus_definition_items').insert(payload);
        if (itemErr) throw itemErr;
      }

      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['bonus-definitions'] });
      toast({ title: 'Plantilla guardada' });
      if (!selectedId && definitionId) {
        const created = (definitions as any[]).find((d) => d.id === definitionId);
        if (created) openEdit(created);
      }
    } catch (e: any) {
      toast({ title: e?.message || 'Error guardando plantilla', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const deleteDefinition = async () => {
    if (!selectedId) return;
    if (!window.confirm('¿Eliminar esta plantilla de bono?')) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from('bonus_definitions').delete().eq('id', selectedId);
      if (error) throw error;
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ['bonus-definitions'] });
      toast({ title: 'Plantilla eliminada' });
      startCreate();
    } catch (e: any) {
      toast({ title: e?.message || 'Error eliminando plantilla', variant: 'destructive' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl h-[85vh] overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h3 className="text-lg font-semibold">Plantillas globales de bonos</h3>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] h-[calc(85vh-65px)]">
          <div className="border-r p-3 overflow-auto space-y-2">
            <Button size="sm" className="w-full" onClick={startCreate}>
              <Plus className="w-4 h-4 mr-1" /> Nueva plantilla
            </Button>
            {(definitions as any[]).map((d) => (
              <button
                key={d.id}
                type="button"
                className={`w-full text-left border rounded-md px-3 py-2 text-sm ${selectedId === d.id ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'}`}
                onClick={() => openEdit(d)}
              >
                <div className="font-medium">{d.name}</div>
                <div className="text-xs text-muted-foreground">{d.code}</div>
              </button>
            ))}
          </div>

          <div className="p-4 overflow-auto space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Código *</Label>
                <Input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} />
              </div>
              <div>
                <Label>Nombre *</Label>
                <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <Label>Precio por defecto</Label>
                <Input type="number" value={form.default_price} onChange={(e) => setForm((p) => ({ ...p, default_price: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Sesiones totales por defecto</Label>
                <Input type="number" value={form.default_total_sessions} onChange={(e) => setForm((p) => ({ ...p, default_total_sessions: Number(e.target.value) }))} />
              </div>
            </div>
            <div>
              <Label>Descripción</Label>
              <Input value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>

            <BonusDefinitionItemsEditor
              items={form.items}
              onChange={(next) => setForm((p) => ({ ...p, items: next }))}
              articles={articles as any[]}
            />

            <div className="flex gap-2">
              <Button onClick={saveDefinition} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar plantilla'}
              </Button>
              {!!selectedId && (
                <Button variant="destructive" onClick={deleteDefinition} disabled={deleting}>
                  {deleting ? 'Eliminando...' : 'Eliminar'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

