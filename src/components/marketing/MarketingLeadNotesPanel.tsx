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

interface MarketingLeadNotesPanelProps {
  leadId: string;
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

export const MarketingLeadNotesPanel: React.FC<MarketingLeadNotesPanelProps> = ({
  leadId,
  compact = false,
}) => {
  const { toast } = useToast();
  const { notes, isLoading, addNote, deleteNote } = useMarketingLeadNotes(leadId);

  const [body, setBody] = useState('');
  const [kind, setKind] = useState<MarketingLeadNoteKind>('note');
  const [nextAction, setNextAction] = useState('');

  const handleAdd = async () => {
    const trimmed = body.trim();
    if (!trimmed) {
      toast({ title: 'Escribe algo en la nota', variant: 'destructive' });
      return;
    }
    try {
      await addNote.mutateAsync({
        body: trimmed,
        kind,
        next_action_at: nextAction ? new Date(nextAction).toISOString() : null,
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
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Error al eliminar';
      toast({ title: 'Error', description: message, variant: 'destructive' });
    }
  };

  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [notes],
  );

  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
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
          <Button size="sm" onClick={handleAdd} disabled={addNote.isPending}>
            <Save className="mr-2 h-3.5 w-3.5" />
            {addNote.isPending ? 'Guardando…' : 'Añadir nota'}
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        {isLoading ? (
          <p className="text-xs text-muted-foreground">Cargando notas…</p>
        ) : sortedNotes.length === 0 ? (
          <p className="rounded border border-dashed py-4 text-center text-xs text-muted-foreground">
            Aún no hay notas para este lead.
          </p>
        ) : (
          sortedNotes.map((note) => {
            const meta = NOTE_KINDS.find((k) => k.value === note.kind) ?? NOTE_KINDS[0];
            const Icon = meta.icon;
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
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(note)}
                  title="Eliminar"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
