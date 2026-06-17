import React, { useMemo, useState } from 'react';
import {
  Phone,
  MessageCircle,
  Mail,
  StickyNote,
  XCircle,
  CalendarClock,
  Trash2,
  Save,
  Pencil,
  X,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  useMarketingLeadNotes,
  type MarketingLeadNote,
  type MarketingLeadNoteKind,
} from '@/hooks/useMarketingLeadNotes';
import { parseNoteNextActionAt, toDatetimeLocalValue } from '@/lib/marketingNotesApi';
import { cn } from '@/lib/utils';
import { useMarketingPermissions } from '@/hooks/useMarketingPermissions';

interface MarketingLeadNotesPanelProps {
  leadId: string;
  companyId?: string | null;
  compact?: boolean;
}

const NOTE_KINDS: Array<{
  value: MarketingLeadNoteKind;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}> = [
  { value: 'note',       label: 'Nota',           icon: StickyNote,   color: 'text-slate-600' },
  { value: 'call',       label: 'Llamada',        icon: Phone,        color: 'text-sky-600' },
  { value: 'whatsapp',   label: 'WhatsApp',       icon: MessageCircle,color: 'text-emerald-600' },
  { value: 'email',      label: 'Email',          icon: Mail,         color: 'text-amber-600' },
  { value: 'reschedule', label: 'Reagendar',      icon: CalendarClock,color: 'text-violet-600' },
  { value: 'rejection',  label: 'Rechazo',        icon: XCircle,      color: 'text-rose-600' },
];

const dateTimeFormatter = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return dateTimeFormatter.format(d);
};

const stopClick = (e: React.MouseEvent) => e.stopPropagation();

export const MarketingLeadNotesPanel: React.FC<MarketingLeadNotesPanelProps> = ({
  leadId,
  companyId,
  compact = false,
}) => {
  const { toast } = useToast();
  const { canWrite: canEditMarketing, loading: marketingPermsLoading } = useMarketingPermissions();
  const notesWriteBlocked = !marketingPermsLoading && !canEditMarketing;
  const {
    notes,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
    addNote,
    deleteNote,
    updateNote,
  } = useMarketingLeadNotes(leadId, companyId);

  const [body, setBody] = useState('');
  const [kind, setKind] = useState<MarketingLeadNoteKind>('note');
  const [nextAction, setNextAction] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const [editKind, setEditKind] = useState<MarketingLeadNoteKind>('note');
  const [editNextAction, setEditNextAction] = useState('');

  const resetEdit = () => {
    setEditingId(null);
    setEditBody('');
    setEditKind('note');
    setEditNextAction('');
  };

  const handleAdd = async () => {
    if (!canEditMarketing) {
      toast({
        title: 'Sin permiso de edición',
        description: 'No puedes añadir notas en Marketing sin el permiso «Editar Marketing».',
        variant: 'destructive',
      });
      return;
    }
    const trimmed = body.trim();
    if (!trimmed) {
      toast({ title: 'Escribe algo en la nota', variant: 'destructive' });
      return;
    }
    try {
      await addNote.mutateAsync({
        body: trimmed,
        kind,
        next_action_at: parseNoteNextActionAt(nextAction),
      });
      setBody('');
      setNextAction('');
      setKind('note');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error al guardar la nota';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const handleDelete = async (note: MarketingLeadNote) => {
    if (!window.confirm('¿Eliminar esta nota?')) return;
    try {
      await deleteNote.mutateAsync(note.id);
      if (editingId === note.id) resetEdit();
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error al eliminar';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const startEdit = (note: MarketingLeadNote) => {
    setEditingId(note.id);
    setEditBody(note.body);
    setEditKind((note.kind as MarketingLeadNoteKind) || 'note');
    setEditNextAction(toDatetimeLocalValue(note.next_action_at));
  };

  const handleSaveEdit = async () => {
    if (!canEditMarketing) {
      toast({
        title: 'Sin permiso de edición',
        description: 'No puedes editar notas en Marketing sin el permiso «Editar Marketing».',
        variant: 'destructive',
      });
      return;
    }
    if (!editingId) return;
    const trimmed = editBody.trim();
    if (!trimmed) {
      toast({ title: 'La nota no puede estar vacía', variant: 'destructive' });
      return;
    }
    try {
      await updateNote.mutateAsync({
        id: editingId,
        values: {
          body: trimmed,
          kind: editKind,
          next_action_at: parseNoteNextActionAt(editNextAction),
        },
      });
      resetEdit();
      toast({ title: 'Nota actualizada' });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error al guardar cambios';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const sortedNotes = useMemo(
    () =>
      [...notes].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [notes],
  );

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'} onClick={stopClick}>
      <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[140px] space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as MarketingLeadNoteKind)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NOTE_KINDS.map((k) => {
                  const Icon = k.icon;
                  return (
                    <SelectItem key={k.value} value={k.value}>
                      <span className="flex items-center gap-2">
                        <Icon className={`h-3.5 w-3.5 ${k.color}`} />
                        {k.label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          {(kind === 'reschedule' || kind === 'call') ? (
            <div className="flex-1 min-w-[180px] space-y-1">
              <Label className="text-xs">Próximo contacto</Label>
              <Input
                type="datetime-local"
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          ) : null}
        </div>
        <Textarea
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escribe la anotación (llamada hecha, motivo de rechazo, observación…)"
          className="text-xs"
        />
        <div className="flex justify-end">
          <Button size="sm" type="button" onClick={handleAdd} disabled={addNote.isPending || notesWriteBlocked}>
            <Save className="mr-2 h-3.5 w-3.5" />
            {addNote.isPending ? 'Guardando…' : 'Añadir nota'}
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">
          {sortedNotes.length > 0
            ? `${sortedNotes.length} ${sortedNotes.length === 1 ? 'nota' : 'notas'}`
            : 'Historial'}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn('mr-1 h-3 w-3', isFetching && 'animate-spin')} />
          Actualizar
        </Button>
      </div>

      <div
        className={cn(
          'space-y-1.5',
          compact && 'max-h-[min(280px,40vh)] overflow-y-auto pr-1 scrollbar-kanban',
        )}
      >
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Cargando notas…</p>
        ) : isError ? (
          <div className="rounded border border-destructive/40 bg-destructive/5 px-3 py-3 text-xs text-destructive">
            <p>No se pudieron cargar las notas{error?.message ? `: ${error.message}` : '.'}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2 h-7"
              onClick={() => refetch()}
            >
              Reintentar
            </Button>
          </div>
        ) : sortedNotes.length === 0 ? (
          <p className="rounded border border-dashed py-4 text-center text-xs text-muted-foreground">
            Aún no hay notas para este lead.
          </p>
        ) : (
          sortedNotes.map((note) => {
            const meta = NOTE_KINDS.find((k) => k.value === note.kind) ?? NOTE_KINDS[0];
            const Icon = meta.icon;
            const isEditing = editingId === note.id;

            if (isEditing) {
              return (
                <div key={note.id} className="rounded-md border border-primary/40 bg-card p-2 text-xs space-y-2">
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="flex-1 min-w-[120px] space-y-1">
                      <Label className="text-[10px]">Tipo</Label>
                      <Select
                        value={editKind}
                        onValueChange={(v) => setEditKind(v as MarketingLeadNoteKind)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {NOTE_KINDS.map((k) => {
                            const KindIcon = k.icon;
                            return (
                              <SelectItem key={k.value} value={k.value}>
                                <span className="flex items-center gap-2">
                                  <KindIcon className={`h-3.5 w-3.5 ${k.color}`} />
                                  {k.label}
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    {(editKind === 'reschedule' || editKind === 'call') ? (
                      <div className="flex-1 min-w-[160px] space-y-1">
                        <Label className="text-[10px]">Próximo contacto</Label>
                        <Input
                          type="datetime-local"
                          value={editNextAction}
                          onChange={(e) => setEditNextAction(e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                    ) : null}
                  </div>
                  <Textarea
                    rows={3}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    className="text-xs"
                  />
                  <div className="flex justify-end gap-1">
                    <Button type="button" variant="ghost" size="sm" className="h-7" onClick={resetEdit}>
                      <X className="mr-1 h-3 w-3" />
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7"
                      onClick={handleSaveEdit}
                      disabled={updateNote.isPending}
                    >
                      <Save className="mr-1 h-3 w-3" />
                      {updateNote.isPending ? 'Guardando…' : 'Guardar'}
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div key={note.id} className="flex gap-2 rounded-md border bg-card p-2 text-xs">
                <div className="mt-0.5">
                  <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-1">
                    <span className="font-semibold">{meta.label}</span>
                    <span className="tabular-nums text-[10px] text-muted-foreground">
                      {formatDateTime(note.created_at)}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap break-words text-foreground">{note.body}</p>
                  {note.next_action_at ? (
                    <p className="mt-1 flex items-center gap-1 text-[10px] text-violet-600">
                      <CalendarClock className="h-3 w-3" />
                      Próximo contacto: {formatDateTime(note.next_action_at)}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col gap-0.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                    onClick={() => startEdit(note)}
                    title="Editar"
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(note)}
                    disabled={deleteNote.isPending}
                    title="Eliminar"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

