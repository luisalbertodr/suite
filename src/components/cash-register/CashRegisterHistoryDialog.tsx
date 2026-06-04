import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { History, Pencil, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  type CashSessionRow,
  cashSessionStatusLabel,
  formatCashSessionSummaryLine,
  formatSessionDateLabel,
} from '@/lib/cashRegisterFormat';

const db = supabase as any;

type DiffFilter = 'all' | 'balanced' | 'cash_mismatch' | 'card_mismatch' | 'any_mismatch';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
  onPickDate?: (date: string) => void;
};

function matchesDiffFilter(s: CashSessionRow, filter: DiffFilter): boolean {
  if (filter === 'all') return true;
  const cash = Number(s.cash_difference ?? 0);
  const card = Number(s.card_difference ?? 0);
  const cashOk = Math.abs(cash) < 0.005;
  const cardOk = Math.abs(card) < 0.005;
  if (filter === 'balanced') return cashOk && cardOk;
  if (filter === 'cash_mismatch') return !cashOk;
  if (filter === 'card_mismatch') return !cardOk;
  return !cashOk || !cardOk;
}

export const CashRegisterHistoryDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  companyId,
  onPickDate,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isSuperuser } = useAuth();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CashSessionRow['status']>('all');
  const [diffFilter, setDiffFilter] = useState<DiffFilter>('all');
  const [notesSearch, setNotesSearch] = useState('');
  const [editing, setEditing] = useState<CashSessionRow | null>(null);
  const [editOpening, setEditOpening] = useState('');
  const [editExpectedCash, setEditExpectedCash] = useState('');
  const [editExpectedCard, setEditExpectedCard] = useState('');
  const [editCountedCash, setEditCountedCash] = useState('');
  const [editCountedCard, setEditCountedCard] = useState('');
  const [editWithdrawn, setEditWithdrawn] = useState('');
  const [editClosing, setEditClosing] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const { data: isAdmin = false } = useQuery({
    queryKey: ['is-admin'],
    enabled: open && !isSuperuser,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_admin');
      if (error) return false;
      return data === true;
    },
  });

  const canEdit = isSuperuser || isAdmin;

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: [
      'cash-register-history',
      companyId,
      dateFrom,
      dateTo,
      statusFilter,
      notesSearch,
    ],
    enabled: open && !!companyId,
    queryFn: async () => {
      let q = db
        .from('cash_register_sessions')
        .select('*')
        .eq('company_id', companyId)
        .order('session_date', { ascending: false })
        .limit(200);
      if (dateFrom) q = q.gte('session_date', dateFrom);
      if (dateTo) q = q.lte('session_date', dateTo);
      if (statusFilter !== 'all') q = q.eq('status', statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      let rows = (data ?? []) as CashSessionRow[];
      const term = notesSearch.trim().toLowerCase();
      if (term) {
        rows = rows.filter((s) => (s.notes || '').toLowerCase().includes(term));
      }
      rows = rows.filter((s) => matchesDiffFilter(s, diffFilter));
      return rows;
    },
  });

  const startEdit = (s: CashSessionRow) => {
    setEditing(s);
    setEditOpening(String(s.opening_cash ?? 0));
    setEditExpectedCash(String(s.expected_cash ?? 0));
    setEditExpectedCard(String(s.expected_card ?? 0));
    setEditCountedCash(s.counted_cash != null ? String(s.counted_cash) : '');
    setEditCountedCard(s.counted_card != null ? String(s.counted_card) : '');
    setEditWithdrawn(String(s.withdrawn_cash ?? 0));
    setEditClosing(s.closing_cash != null ? String(s.closing_cash) : '');
    setEditNotes(s.notes || '');
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error('Ninguna sesión seleccionada');
      const expectedCash = Number(editExpectedCash || 0);
      const expectedCard = Number(editExpectedCard || 0);
      const countedCash = editCountedCash === '' ? null : Number(editCountedCash);
      const countedCard = editCountedCard === '' ? null : Number(editCountedCard);
      const closingCash = editClosing === '' ? countedCash : Number(editClosing);
      const payload = {
        opening_cash: Number(editOpening || 0),
        expected_cash: expectedCash,
        expected_card: expectedCard,
        counted_cash: countedCash,
        counted_card: countedCard,
        withdrawn_cash: Number(editWithdrawn || 0),
        closing_cash: closingCash,
        cash_difference:
          countedCash != null ? countedCash - expectedCash : null,
        card_difference:
          countedCard != null ? countedCard - expectedCard : null,
        notes: editNotes.trim() || null,
      };
      const { error } = await db
        .from('cash_register_sessions')
        .update(payload)
        .eq('id', editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Caja actualizada' });
      queryClient.invalidateQueries({ queryKey: ['cash-register-history'] });
      queryClient.invalidateQueries({ queryKey: ['cash-register-recent-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['cash-register-session'] });
      setEditing(null);
    },
    onError: (err: Error) => {
      toast({
        title: 'No se pudo guardar',
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const resultHint = useMemo(() => {
    if (isLoading) return 'Buscando…';
    return `${sessions.length} sesión${sessions.length === 1 ? '' : 'es'}`;
  }, [isLoading, sessions.length]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de cajas diarias
          </DialogTitle>
          <DialogDescription>
            Filtra sesiones anteriores. {canEdit ? 'Como administrador puedes editar los importes y notas.' : 'Solo lectura.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Desde</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Hasta</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Estado</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="open">Abierta</SelectItem>
                <SelectItem value="closed">Cerrada</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Descuadres</Label>
            <Select value={diffFilter} onValueChange={(v) => setDiffFilter(v as DiffFilter)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="balanced">Cuadradas</SelectItem>
                <SelectItem value="any_mismatch">Con descuadre</SelectItem>
                <SelectItem value="cash_mismatch">Descuadre efectivo</SelectItem>
                <SelectItem value="card_mismatch">Descuadre tarjeta</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label>Notas (texto)</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                value={notesSearch}
                onChange={(e) => setNotesSearch(e.target.value)}
                placeholder="Buscar en observaciones del cierre…"
              />
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">{resultHint}</p>

        <ul className="max-h-52 space-y-1 overflow-y-auto rounded-md border p-2 text-sm">
          {sessions.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-muted/60"
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => {
                  onPickDate?.(s.session_date);
                  onOpenChange(false);
                }}
              >
                <span className="font-medium">{formatSessionDateLabel(s.session_date)}</span>
                <span className="mx-2 text-muted-foreground">·</span>
                <span className="text-muted-foreground">{formatCashSessionSummaryLine(s)}</span>
              </button>
              <div className="flex shrink-0 items-center gap-1">
                <Badge variant={s.status === 'closed' ? 'secondary' : 'outline'}>
                  {cashSessionStatusLabel(s.status)}
                </Badge>
                {canEdit && (
                  <Button type="button" size="sm" variant="ghost" onClick={() => startEdit(s)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </li>
          ))}
          {!isLoading && sessions.length === 0 && (
            <li className="py-6 text-center text-muted-foreground">Sin resultados con estos filtros.</li>
          )}
        </ul>

        {editing && canEdit && (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
            <p className="text-sm font-semibold">
              Editar caja del {formatSessionDateLabel(editing.session_date)}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Apertura</Label>
                <Input type="number" step="0.01" value={editOpening} onChange={(e) => setEditOpening(e.target.value)} />
              </div>
              <div>
                <Label>Retiradas</Label>
                <Input type="number" step="0.01" value={editWithdrawn} onChange={(e) => setEditWithdrawn(e.target.value)} />
              </div>
              <div>
                <Label>Efectivo esperado</Label>
                <Input type="number" step="0.01" value={editExpectedCash} onChange={(e) => setEditExpectedCash(e.target.value)} />
              </div>
              <div>
                <Label>Tarjeta esperada</Label>
                <Input type="number" step="0.01" value={editExpectedCard} onChange={(e) => setEditExpectedCard(e.target.value)} />
              </div>
              <div>
                <Label>Efectivo contado</Label>
                <Input type="number" step="0.01" value={editCountedCash} onChange={(e) => setEditCountedCash(e.target.value)} />
              </div>
              <div>
                <Label>Tarjeta conciliada</Label>
                <Input type="number" step="0.01" value={editCountedCard} onChange={(e) => setEditCountedCard(e.target.value)} />
              </div>
              <div>
                <Label>Cierre en caja</Label>
                <Input type="number" step="0.01" value={editClosing} onChange={(e) => setEditClosing(e.target.value)} />
              </div>
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                Guardar cambios
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
