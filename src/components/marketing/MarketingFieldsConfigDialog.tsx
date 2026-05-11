import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  useMarketingFieldConfig,
  type MarketingFieldConfig,
} from '@/hooks/useMarketingFieldConfig';
import { useMarketingLeads } from '@/hooks/useMarketingLeads';
import { humanizeFieldKey } from './marketingFormatters';

interface MarketingFieldsConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FIELD_TYPES = [
  { value: 'string',   label: 'Texto' },
  { value: 'number',   label: 'Número' },
  { value: 'currency', label: 'Moneda (€)' },
  { value: 'phone',    label: 'Teléfono' },
  { value: 'email',    label: 'Email' },
  { value: 'datetime', label: 'Fecha/Hora' },
];

export const MarketingFieldsConfigDialog: React.FC<MarketingFieldsConfigDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { toast } = useToast();
  const { fields, upsertField, updateField, deleteField } = useMarketingFieldConfig();
  const { leads } = useMarketingLeads();

  const [edits, setEdits] = useState<Record<string, Partial<MarketingFieldConfig>>>({});

  useEffect(() => {
    if (!open) setEdits({});
  }, [open]);

  const detectedExtraKeys = useMemo(() => {
    const set = new Set<string>();
    for (const lead of leads) {
      const fd = Array.isArray(lead.field_data)
        ? (lead.field_data as Array<{ name: string }>)
        : [];
      for (const f of fd) {
        if (f?.name) set.add(f.name);
      }
    }
    const existing = new Set(fields.map((f) => f.field_key));
    return [...set].filter((k) => !existing.has(k));
  }, [leads, fields]);

  const handleEdit = (id: string, patch: Partial<MarketingFieldConfig>) => {
    setEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const handleSave = async (field: MarketingFieldConfig) => {
    const draft = edits[field.id];
    if (!draft) return;
    try {
      await updateField.mutateAsync({ id: field.id, values: draft });
      setEdits((prev) => {
        const next = { ...prev };
        delete next[field.id];
        return next;
      });
      toast({ title: 'Campo actualizado' });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error al guardar';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleToggle = async (
    field: MarketingFieldConfig,
    key: 'visible_in_card' | 'visible_in_detail',
    value: boolean,
  ) => {
    try {
      await updateField.mutateAsync({ id: field.id, values: { [key]: value } });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error al actualizar';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleAddDetected = async (key: string) => {
    try {
      await upsertField.mutateAsync({
        field_key: key,
        display_label: humanizeFieldKey(key).slice(0, 60),
        visible_in_card: false,
        visible_in_detail: true,
        sort_order: fields.length,
        field_type: 'string',
        is_system: false,
      });
      toast({ title: 'Campo añadido' });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleDelete = async (field: MarketingFieldConfig) => {
    if (!window.confirm(`¿Eliminar el campo "${field.display_label}" de la configuración?`)) return;
    try {
      await deleteField.mutateAsync(field.id);
      toast({ title: 'Campo eliminado' });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const ordered = [...fields].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Configurar campos de las tarjetas</DialogTitle>
          <DialogDescription>
            Decide qué información se muestra en cada tarjeta del Kanban y en la vista de detalle.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto pr-1">
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-semibold">Campo</th>
                  <th className="px-3 py-2 font-semibold">Etiqueta</th>
                  <th className="px-3 py-2 font-semibold">Tipo</th>
                  <th className="px-3 py-2 text-center font-semibold">En tarjeta</th>
                  <th className="px-3 py-2 text-center font-semibold">En detalle</th>
                  <th className="px-3 py-2 text-right" />
                </tr>
              </thead>
              <tbody>
                {ordered.map((field) => {
                  const draft = edits[field.id];
                  const labelValue = draft?.display_label ?? field.display_label;
                  const typeValue = (draft?.field_type ?? field.field_type) as string;
                  const isDirty = !!draft;
                  return (
                    <tr key={field.id} className="border-t">
                      <td className="px-3 py-2 align-middle">
                        <code className="rounded bg-muted px-1 py-0.5 text-[10px]">
                          {field.field_key}
                        </code>
                        {field.is_system ? (
                          <span className="ml-1 text-[10px] text-muted-foreground">(sistema)</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <Input
                          value={labelValue}
                          onChange={(e) => handleEdit(field.id, { display_label: e.target.value })}
                          className="h-7 text-xs"
                        />
                      </td>
                      <td className="px-3 py-2 align-middle">
                        <Select
                          value={typeValue}
                          onValueChange={(v) => handleEdit(field.id, { field_type: v })}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2 text-center align-middle">
                        <Switch
                          checked={field.visible_in_card}
                          onCheckedChange={(v) => handleToggle(field, 'visible_in_card', v)}
                        />
                      </td>
                      <td className="px-3 py-2 text-center align-middle">
                        <Switch
                          checked={field.visible_in_detail}
                          onCheckedChange={(v) => handleToggle(field, 'visible_in_detail', v)}
                        />
                      </td>
                      <td className="px-3 py-2 text-right align-middle">
                        <div className="flex justify-end gap-1">
                          {isDirty ? (
                            <Button size="sm" onClick={() => handleSave(field)}>
                              Guardar
                            </Button>
                          ) : null}
                          {!field.is_system ? (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(field)}
                              title="Eliminar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {ordered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                      No hay campos configurados.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {detectedExtraKeys.length > 0 ? (
            <div className="mt-4 rounded-lg border border-dashed bg-muted/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <Label className="text-xs font-semibold uppercase tracking-wide">
                  Detectados en los formularios ({detectedExtraKeys.length})
                </Label>
              </div>
              <div className="flex flex-wrap gap-2">
                {detectedExtraKeys.map((k) => (
                  <Button
                    key={k}
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => handleAddDetected(k)}
                    title={k}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    {humanizeFieldKey(k).slice(0, 50)}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
