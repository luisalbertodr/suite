import React, { useState } from 'react';
import { Plus, Trash2, ArrowUp, ArrowDown, Save } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';
import {
  useMarketingStages,
  type MarketingLeadStage,
} from '@/hooks/useMarketingStages';

interface MarketingStagesManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_COLORS = [
  '#22c55e', '#3b82f6', '#f59e0b', '#06b6d4', '#0ea5e9',
  '#a855f7', '#10b981', '#ef4444', '#ec4899', '#94a3b8',
];

export const MarketingStagesManager: React.FC<MarketingStagesManagerProps> = ({
  open,
  onOpenChange,
}) => {
  const { toast } = useToast();
  const { stages, createStage, updateStage, deleteStage, reorderStages } = useMarketingStages();

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editing, setEditing] = useState<Record<string, { name: string; color: string }>>({});

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) {
      toast({ title: 'El nombre es obligatorio', variant: 'destructive' });
      return;
    }
    try {
      await createStage.mutateAsync({
        name,
        color: newColor,
        position: stages.length,
      });
      setNewName('');
      toast({ title: 'Etapa creada' });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error al crear etapa';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleSave = async (stage: MarketingLeadStage) => {
    const draft = editing[stage.id];
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      toast({ title: 'El nombre es obligatorio', variant: 'destructive' });
      return;
    }
    try {
      await updateStage.mutateAsync({
        id: stage.id,
        values: { name, color: draft.color },
      });
      setEditing((prev) => {
        const next = { ...prev };
        delete next[stage.id];
        return next;
      });
      toast({ title: 'Etapa actualizada' });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error al actualizar';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleDelete = async (stage: MarketingLeadStage) => {
    if (!window.confirm(`¿Eliminar la etapa "${stage.name}"? Los leads se quedarán sin etapa.`)) {
      return;
    }
    try {
      await deleteStage.mutateAsync(stage.id);
      toast({ title: 'Etapa eliminada' });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error al eliminar';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleMove = async (stage: MarketingLeadStage, dir: -1 | 1) => {
    const ordered = [...stages].sort((a, b) => a.position - b.position);
    const idx = ordered.findIndex((s) => s.id === stage.id);
    if (idx < 0) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= ordered.length) return;
    [ordered[idx], ordered[swapIdx]] = [ordered[swapIdx], ordered[idx]];
    try {
      await reorderStages.mutateAsync(ordered.map((s) => s.id));
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error al reordenar';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const startEdit = (stage: MarketingLeadStage) => {
    setEditing((prev) => ({
      ...prev,
      [stage.id]: { name: stage.name, color: stage.color },
    }));
  };

  const ordered = [...stages].sort((a, b) => a.position - b.position);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gestionar etapas</DialogTitle>
          <DialogDescription>
            Define las columnas del embudo y su orden. Cada etapa puede tener un color propio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[200px] space-y-1">
                <Label htmlFor="new-stage-name">Nueva etapa</Label>
                <Input
                  id="new-stage-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="p. ej. Cita Confirmada"
                />
              </div>
              <div className="space-y-1">
                <Label>Color</Label>
                <div className="flex flex-wrap gap-1">
                  {PRESET_COLORS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      className={[
                        'h-6 w-6 rounded-full border-2',
                        newColor === c ? 'border-foreground' : 'border-transparent',
                      ].join(' ')}
                      style={{ backgroundColor: c }}
                      onClick={() => setNewColor(c)}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
              </div>
              <Button onClick={handleAdd} disabled={createStage.isPending} size="sm">
                <Plus className="mr-2 h-3.5 w-3.5" /> Añadir
              </Button>
            </div>
          </div>

          <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {ordered.map((stage, idx) => {
              const draft = editing[stage.id];
              const isEditing = !!draft;
              return (
                <div
                  key={stage.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border bg-card px-3 py-2"
                >
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleMove(stage, -1)}
                      disabled={idx === 0 || reorderStages.isPending}
                      title="Subir"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleMove(stage, 1)}
                      disabled={idx === ordered.length - 1 || reorderStages.isPending}
                      title="Bajar"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  <div className="flex flex-1 items-center gap-2 min-w-[200px]">
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: isEditing ? draft.color : stage.color }}
                    />
                    {isEditing ? (
                      <Input
                        value={draft.name}
                        onChange={(e) =>
                          setEditing((prev) => ({
                            ...prev,
                            [stage.id]: { ...prev[stage.id], name: e.target.value },
                          }))
                        }
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <button
                        type="button"
                        className="text-left text-sm font-medium hover:underline"
                        onClick={() => startEdit(stage)}
                      >
                        {stage.name}
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="flex flex-wrap gap-1">
                      {PRESET_COLORS.map((c) => (
                        <button
                          type="button"
                          key={c}
                          className={[
                            'h-5 w-5 rounded-full border-2',
                            draft.color === c ? 'border-foreground' : 'border-transparent',
                          ].join(' ')}
                          style={{ backgroundColor: c }}
                          onClick={() =>
                            setEditing((prev) => ({
                              ...prev,
                              [stage.id]: { ...prev[stage.id], color: c },
                            }))
                          }
                          aria-label={`Color ${c}`}
                        />
                      ))}
                    </div>
                  ) : null}

                  <div className="flex gap-1">
                    {isEditing ? (
                      <Button size="sm" onClick={() => handleSave(stage)} disabled={updateStage.isPending}>
                        <Save className="mr-1 h-3.5 w-3.5" /> Guardar
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(stage)}
                        disabled={deleteStage.isPending}
                        title="Eliminar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
            {ordered.length === 0 ? (
              <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
                Aún no hay etapas. Crea la primera arriba.
              </p>
            ) : null}
          </div>
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
