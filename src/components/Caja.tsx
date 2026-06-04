import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Banknote, Plus, Lock, Unlock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type CashSession = {
  id: string;
  company_id: string;
  session_date: string;
  status: 'open' | 'closed' | 'cancelled';
  opening_cash: number;
  expected_cash: number;
  expected_card: number;
  counted_cash: number | null;
  counted_card: number | null;
  withdrawn_cash: number;
  closing_cash: number | null;
  cash_difference: number | null;
  card_difference: number | null;
  notes: string | null;
};

type CashMovement = {
  id: string;
  movement_type: 'withdrawal' | 'cash_in' | 'adjustment';
  payment_channel: 'cash' | 'card';
  amount: number;
  reason: string | null;
  created_at: string;
};

type SaleRow = {
  id: string;
  ticket_number: string | null;
  total_amount: number;
  payment_method: string | null;
  customer_name: string | null;
  created_at: string;
};

const db = supabase as any;

function money(value: number | null | undefined): string {
  return `${Number(value || 0).toFixed(2)} €`;
}

export const Caja: React.FC = () => {
  const { companyId } = useCompanyFilter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [openingCash, setOpeningCash] = useState('0');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [countedCash, setCountedCash] = useState('');
  const [countedCard, setCountedCard] = useState('');
  const [notes, setNotes] = useState('');

  const dayStart = `${date}T00:00:00`;
  const dayEnd = `${date}T23:59:59.999`;

  const { data: previousSession } = useQuery({
    queryKey: ['cash-register-previous-session', companyId, date],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await db
        .from('cash_register_sessions')
        .select('closing_cash, session_date')
        .eq('company_id', companyId)
        .eq('status', 'closed')
        .lt('session_date', date)
        .order('session_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as { closing_cash: number | null; session_date: string } | null;
    },
  });

  const { data: session } = useQuery({
    queryKey: ['cash-register-session', companyId, date],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await db
        .from('cash_register_sessions')
        .select('*')
        .eq('company_id', companyId)
        .eq('session_date', date)
        .maybeSingle();
      if (error) throw error;
      return data as CashSession | null;
    },
  });

  const { data: sales = [] } = useQuery({
    queryKey: ['cash-register-sales', companyId, date],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await db
        .from('sales')
        .select('id,ticket_number,total_amount,payment_method,customer_name,created_at')
        .eq('company_id', companyId)
        .eq('status', 'completed')
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as SaleRow[];
    },
  });

  const { data: movements = [] } = useQuery({
    queryKey: ['cash-register-movements', session?.id],
    enabled: !!session?.id,
    queryFn: async () => {
      const { data, error } = await db
        .from('cash_register_movements')
        .select('*')
        .eq('session_id', session!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as CashMovement[];
    },
  });

  const totals = useMemo(() => {
    const cashSales = sales
      .filter((s) => String(s.payment_method || '').toLowerCase() === 'cash')
      .reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
    const cardSales = sales
      .filter((s) => String(s.payment_method || '').toLowerCase() !== 'cash')
      .reduce((sum, s) => sum + Number(s.total_amount || 0), 0);
    const movementCashIn = movements
      .filter((m) => m.payment_channel === 'cash' && m.movement_type === 'cash_in')
      .reduce((sum, m) => sum + Number(m.amount || 0), 0);
    const adjustments = movements
      .filter((m) => m.payment_channel === 'cash' && m.movement_type === 'adjustment')
      .reduce((sum, m) => sum + Number(m.amount || 0), 0);
    const withdrawals = movements
      .filter((m) => m.payment_channel === 'cash' && m.movement_type === 'withdrawal')
      .reduce((sum, m) => sum + Number(m.amount || 0), 0);
    const opening = Number(session?.opening_cash ?? 0);
    const expectedCash = opening + cashSales + movementCashIn + adjustments - withdrawals;
    return { cashSales, cardSales, movementCashIn, adjustments, withdrawals, expectedCash };
  }, [movements, sales, session?.opening_cash]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['cash-register-session'] });
    queryClient.invalidateQueries({ queryKey: ['cash-register-previous-session'] });
    queryClient.invalidateQueries({ queryKey: ['cash-register-movements'] });
  };

  const openMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('No hay empresa activa');
      const { error } = await db.from('cash_register_sessions').insert({
        company_id: companyId,
        session_date: date,
        opening_cash: Number(openingCash || previousSession?.closing_cash || 0),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Caja abierta' });
      invalidate();
    },
  });

  const movementMutation = useMutation({
    mutationFn: async () => {
      if (!session || !companyId) throw new Error('Abre la caja antes de registrar movimientos');
      const amount = Number(movementAmount || 0);
      if (amount <= 0) throw new Error('Importe no válido');
      const { error } = await db.from('cash_register_movements').insert({
        session_id: session.id,
        company_id: companyId,
        movement_type: 'withdrawal',
        payment_channel: 'cash',
        amount,
        reason: movementReason || 'Retirada de efectivo',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMovementAmount('');
      setMovementReason('');
      toast({ title: 'Retirada registrada' });
      invalidate();
    },
  });

  const closeMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('No hay caja abierta');
      const cash = Number(countedCash || 0);
      const card = Number(countedCard || 0);
      const { error } = await db
        .from('cash_register_sessions')
        .update({
          status: 'closed',
          closed_at: new Date().toISOString(),
          expected_cash: totals.expectedCash,
          expected_card: totals.cardSales,
          counted_cash: cash,
          counted_card: card,
          withdrawn_cash: totals.withdrawals,
          closing_cash: cash,
          cash_difference: cash - totals.expectedCash,
          card_difference: card - totals.cardSales,
          notes: notes || null,
        })
        .eq('id', session.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Caja cerrada' });
      invalidate();
    },
  });

  const isClosed = session?.status === 'closed';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Banknote className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-semibold">Caja diaria</h2>
        </div>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
      </div>

      {!session ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Abrir caja</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-end gap-3">
            <div>
              <Label>Saldo inicial efectivo</Label>
              <Input
                type="number"
                step="0.01"
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder={String(previousSession?.closing_cash ?? 0)}
              />
            </div>
            <Button onClick={() => openMutation.mutate()} disabled={openMutation.isPending || !companyId}>
              <Unlock className="mr-2 h-4 w-4" />
              Abrir caja
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Efectivo esperado</p><p className="text-xl font-semibold">{money(totals.expectedCash)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Tarjeta esperada</p><p className="text-xl font-semibold">{money(totals.cardSales)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Retiradas</p><p className="text-xl font-semibold">{money(totals.withdrawals)}</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Estado</p><p className="text-xl font-semibold">{isClosed ? 'Cerrada' : 'Abierta'}</p></CardContent></Card>
          </div>

          {!isClosed && (
            <Card>
              <CardHeader><CardTitle className="text-base">Movimientos y cierre</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Retirada de efectivo</Label>
                  <div className="flex gap-2">
                    <Input type="number" step="0.01" value={movementAmount} onChange={(e) => setMovementAmount(e.target.value)} placeholder="0.00" />
                    <Button variant="outline" onClick={() => movementMutation.mutate()} disabled={movementMutation.isPending}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input value={movementReason} onChange={(e) => setMovementReason(e.target.value)} placeholder="Motivo" />
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label>Efectivo contado</Label><Input type="number" step="0.01" value={countedCash} onChange={(e) => setCountedCash(e.target.value)} /></div>
                    <div><Label>Tarjeta conciliada</Label><Input type="number" step="0.01" value={countedCard} onChange={(e) => setCountedCard(e.target.value)} /></div>
                  </div>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas del cierre" rows={2} />
                  <Button onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending}>
                    <Lock className="mr-2 h-4 w-4" />
                    Cerrar caja
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {isClosed && (
            <Card>
              <CardContent className="grid gap-3 p-4 md:grid-cols-4">
                <div><p className="text-xs text-muted-foreground">Efectivo real</p><p className="font-semibold">{money(session.counted_cash)}</p></div>
                <div><p className="text-xs text-muted-foreground">Tarjeta real</p><p className="font-semibold">{money(session.counted_card)}</p></div>
                <div><p className="text-xs text-muted-foreground">Descuadre efectivo</p><p className="font-semibold">{money(session.cash_difference)}</p></div>
                <div><p className="text-xs text-muted-foreground">Descuadre tarjeta</p><p className="font-semibold">{money(session.card_difference)}</p></div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Tickets del día</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2">Hora</th><th>Ticket</th><th>Cliente</th><th>Método</th><th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id} className="border-b last:border-0">
                      <td className="py-2">{sale.created_at?.slice(11, 16)}</td>
                      <td>{sale.ticket_number || sale.id.slice(0, 8)}</td>
                      <td>{sale.customer_name || 'Cliente no indicado'}</td>
                      <td>{String(sale.payment_method || '').toLowerCase() === 'cash' ? 'Efectivo' : 'Tarjeta'}</td>
                      <td className="text-right font-medium">{money(sale.total_amount)}</td>
                    </tr>
                  ))}
                  {sales.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Sin tickets en esta fecha.</td></tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
