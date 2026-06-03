import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Phone, RefreshCw, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRegisterTopBarContent } from '@/components/TopBarContentContext';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

type CallDirection = 'outbound' | 'inbound' | 'missed';

interface IssabelCall {
  id: string;
  direction: CallDirection;
  started_at: string;
  caller: string;
  callee: string;
  customer_phone?: string;
  customer?: {
    id: string;
    name: string;
  } | null;
  duration_seconds: number;
  disposition: string;
  recording_url?: string | null;
}

const directionLabels: Record<CallDirection, string> = {
  outbound: 'Realizada',
  inbound: 'Recibida',
  missed: 'Perdida',
};

const directionClasses: Record<CallDirection, string> = {
  outbound: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300',
  inbound: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300',
  missed: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300',
};

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safe / 60);
  const remaining = safe % 60;
  if (minutes === 0) return `${remaining}s`;
  return `${minutes}m ${remaining.toString().padStart(2, '0')}s`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || '-';
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function digitsOnly(value: string | undefined | null): string {
  return (value ?? '').replace(/\D/g, '');
}

export const Telefono: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { companyId } = useCompanyFilter();
  const today = useMemo(() => new Date(), []);
  const yesterday = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date;
  }, []);

  const initialDirection = searchParams.get('filter') === 'missed' ? 'missed' : 'all';
  const [from, setFrom] = useState(toDateInputValue(yesterday));
  const [to, setTo] = useState(toDateInputValue(today));
  const [direction, setDirection] = useState<'all' | CallDirection>(initialDirection);
  const [search, setSearch] = useState('');

  const callsQuery = useQuery({
    queryKey: ['issabel-calls', companyId, from, to, direction],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('issabel-calls', {
        body: {
          action: 'calls.list',
          company_id: companyId,
          from,
          to,
          direction: direction === 'all' ? undefined : direction,
          limit: 300,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data?.calls ?? []) as IssabelCall[];
    },
  });

  const calls = callsQuery.data ?? [];
  const filteredCalls = calls.filter((call) => {
    const needle = search.trim().toLowerCase();
    if (!needle) return true;
    return [call.caller, call.callee, call.customer_phone, call.customer?.name, call.disposition]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(needle));
  });

  const renderParty = (value: string, call: IssabelCall) => {
    const partyDigits = digitsOnly(value);
    const customerDigits = digitsOnly(call.customer_phone);
    if (call.customer && partyDigits && customerDigits && partyDigits.endsWith(customerDigits.slice(-9))) {
      return (
        <Link
          to={`/clientes?customer=${call.customer.id}`}
          className="font-medium text-blue-600 hover:underline"
        >
          {call.customer.name}
        </Link>
      );
    }
    return value || '-';
  };

  const topBarActions = useMemo(() => (
    <>
      {(['all', 'outbound', 'inbound', 'missed'] as const).map((value) => (
        <Button
          key={value}
          type="button"
          size="sm"
          variant={direction === value ? 'default' : 'outline'}
          onClick={() => setDirection(value)}
          className="h-7 px-2 text-xs"
        >
          {value === 'all' ? 'Todas' : directionLabels[value]}
        </Button>
      ))}
      <Button
        onClick={() => callsQuery.refetch()}
        variant="outline"
        size="sm"
        className="h-7 px-2 text-xs"
        disabled={callsQuery.isFetching}
      >
        <RefreshCw className={`w-3.5 h-3.5 mr-1 ${callsQuery.isFetching ? 'animate-spin' : ''}`} />
        Actualizar
      </Button>
    </>
  ), [callsQuery, direction]);

  useRegisterTopBarContent(
    {
      title: (
        <span className="inline-flex items-center gap-2">
          <Phone className="w-4 h-4 text-sky-500" />
          Llamadas
        </span>
      ),
      actions: topBarActions,
    },
    [topBarActions],
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="grid gap-2 md:grid-cols-[170px_170px_minmax(220px,1fr)]">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar extensión, número o estado..."
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {callsQuery.isLoading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Cargando llamadas...</div>
          ) : callsQuery.isError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {callsQuery.error instanceof Error
                ? callsQuery.error.message
                : 'No se pudieron obtener las llamadas de Issabel.'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Origen</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead>Duración</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCalls.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No hay llamadas para los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCalls.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell className="whitespace-nowrap">{formatDateTime(call.started_at)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={directionClasses[call.direction]}>
                          {directionLabels[call.direction]}
                        </Badge>
                      </TableCell>
                      <TableCell>{renderParty(call.caller, call)}</TableCell>
                      <TableCell>{renderParty(call.callee, call)}</TableCell>
                      <TableCell>{formatDuration(call.duration_seconds)}</TableCell>
                      <TableCell>{call.disposition || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
