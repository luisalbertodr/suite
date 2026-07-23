import React, { useMemo, useRef, useState } from 'react';
import { Loader2, Pencil, Plus, StickyNote, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  useWhatsappQuickNotes,
  type WhatsappQuickNote,
} from '@/hooks/useWhatsappQuickNotes';
import {
  WHATSAPP_QUICK_NOTE_VARS,
  applyWhatsappQuickNoteVars,
  loadWhatsappQuickNoteAppointmentVars,
} from '@/lib/whatsappQuickNoteVars';

type Props = {
  chatDisplayName?: string;
  customerId?: string | null;
  onSendText: (text: string) => Promise<void>;
};

export const WhatsappSendNotesButton: React.FC<Props> = ({
  chatDisplayName,
  customerId,
  onSendText,
}) => {
  const { toast } = useToast();
  const { data: notes, isLoading, createNote, updateNote, deleteNote } =
    useWhatsappQuickNotes();
  const [open, setOpen] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<WhatsappQuickNote | null>(null);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const sorted = useMemo(
    () => [...(notes ?? [])].sort((a, b) => a.sort_order - b.sort_order),
    [notes],
  );

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
    setTitle('');
    setBody('');
  };

  const openEdit = (note: WhatsappQuickNote) => {
    setCreating(false);
    setEditing(note);
    setTitle(note.title);
    setBody(note.body);
  };

  const closeForm = () => {
    setCreating(false);
    setEditing(null);
    setTitle('');
    setBody('');
  };

  const insertVar = (key: string) => {
    const token = `{${key}}`;
    const el = bodyRef.current;
    if (!formOpen) {
      openCreate();
      setBody(token);
      return;
    }
    if (!el) {
      setBody((prev) => `${prev}${token}`);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = `${body.slice(0, start)}${token}${body.slice(end)}`;
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleSaveForm = async () => {
    if (!title.trim() || !body.trim()) {
      toast({
        title: 'Faltan datos',
        description: 'Indica título y texto de la nota.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateNote.mutateAsync({ id: editing.id, title, body });
        toast({ title: 'Nota actualizada' });
      } else {
        await createNote.mutateAsync({ title, body });
        toast({ title: 'Nota creada' });
      }
      closeForm();
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'No se pudo guardar',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (note: WhatsappQuickNote) => {
    if (!window.confirm(`¿Eliminar la nota «${note.title}»?`)) return;
    try {
      await deleteNote.mutateAsync(note.id);
      if (editing?.id === note.id) closeForm();
      toast({ title: 'Nota eliminada' });
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'No se pudo eliminar',
        variant: 'destructive',
      });
    }
  };

  const handleSend = async (note: WhatsappQuickNote) => {
    setSendingId(note.id);
    try {
      const appointmentVars = await loadWhatsappQuickNoteAppointmentVars(customerId);
      const text = applyWhatsappQuickNoteVars(note.body, {
        nombre: chatDisplayName,
        nombre_completo: chatDisplayName,
        ...appointmentVars,
      });
      await onSendText(text);
      toast({ title: 'Nota enviada', description: note.title });
      setOpen(false);
    } catch (e) {
      toast({
        title: 'Error al enviar',
        description: e instanceof Error ? e.message : 'No se pudo enviar',
        variant: 'destructive',
      });
    } finally {
      setSendingId(null);
    }
  };

  const formOpen = creating || !!editing;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 border-amber-200 bg-amber-50/60 text-xs text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
        onClick={() => setOpen(true)}
        title="Notas predefinidas"
      >
        <StickyNote className="h-3.5 w-3.5" />
        Notas
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) closeForm(); }}>
        <DialogContent className="max-w-lg gap-3">
          <DialogHeader>
            <DialogTitle>Notas rápidas</DialogTitle>
            <DialogDescription>
              Elige una nota para enviarla a este chat, o añade / edita / elimina plantillas.
              Pulsa un campo para insertarlo en el texto.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-wrap gap-1.5">
            {WHATSAPP_QUICK_NOTE_VARS.map((v) => (
              <Badge
                key={v.key}
                variant="secondary"
                className="cursor-pointer font-mono text-[10px] hover:bg-secondary/80"
                title={v.description}
                onClick={() => insertVar(v.key)}
              >
                {`{${v.key}}`}
              </Badge>
            ))}
          </div>

          {formOpen ? (
            <div className="space-y-3 rounded-lg border p-3">
              <p className="text-xs font-medium text-muted-foreground">
                {editing ? 'Editar nota' : 'Nueva nota'}
              </p>
              <div className="space-y-1">
                <Label className="text-xs">Título</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ej. Confirmación asistencia"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Texto</Label>
                <Textarea
                  ref={bodyRef}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={5}
                  placeholder="Hola {nombre}, te esperamos el {fecha_cita} a las {hora_cita}…"
                  className="text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={closeForm}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={saving}
                  onClick={() => void handleSaveForm()}
                >
                  {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                  Guardar
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex justify-end">
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={openCreate}>
                <Plus className="h-3.5 w-3.5" />
                Añadir
              </Button>
            </div>
          )}

          <ScrollArea className="max-h-[340px] pr-2">
            {isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>
            ) : sorted.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No hay notas. Pulsa Añadir para crear la primera.
              </p>
            ) : (
              <ul className="space-y-2">
                {sorted.map((note) => (
                  <li
                    key={note.id}
                    className="rounded-lg border bg-muted/20 p-3"
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <p className="text-sm font-medium leading-tight">{note.title}</p>
                      <div className="flex shrink-0 gap-0.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="Editar"
                          onClick={() => openEdit(note)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          title="Eliminar"
                          onClick={() => void handleDelete(note)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="mb-2 line-clamp-3 whitespace-pre-wrap text-xs text-muted-foreground">
                      {note.body}
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 text-xs"
                      disabled={sendingId === note.id}
                      onClick={() => void handleSend(note)}
                    >
                      {sendingId === note.id ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : null}
                      Enviar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
