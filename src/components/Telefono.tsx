import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Headphones, Phone, RefreshCw, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRegisterTopBarContent } from '@/components/TopBarContentContext';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { usePermissions } from '@/hooks/usePermissions';
import { getPhoneCallsScope } from '@/lib/phonePermissions';
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
  missed_reason?: 'voicemail' | 'no_answer' | 'missed' | null;
  recording_url?: string | null;
  recording_path?: string | null;
}

function recordingSource(call: IssabelCall): string | null {
  return call.recording_path || call.recording_url || null;
}

async function fetchCallRecordingBlob(call: IssabelCall, source: string): Promise<Blob> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Sesión no válida');

  const callDate = call.started_at.slice(0, 10);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
  const response = await fetch(`${supabaseUrl}/functions/v1/issabel-calls`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'calls.recording',
      recording: source,
      call_id: call.id,
      from: callDate,
      to: callDate,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const parsed = JSON.parse(text) as { error?: string };
      if (parsed.error) message = parsed.error;
    } catch {
      /* respuesta no JSON */
    }
    throw new Error(message || 'No se pudo cargar la grabación');
  }
  return response.blob();
}

const CallRecordingPlayer: React.FC<{ call: IssabelCall }> = ({ call }) => {
  const source = recordingSource(call);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);

  useEffect(() => () => {
    if (audioSrc) URL.revokeObjectURL(audioSrc);
  }, [audioSrc]);

  if (!source) {
    return <span className="text-muted-foreground">—</span>;
  }

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const blob = await fetchCallRecordingBlob(call, source);
      setAudioSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  };

  if (audioSrc) {
    return (
      <audio controls preload="metadata" src={audioSrc} className="h-8 max-w-[220px]" />
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto px-0 text-sky-600"
        disabled={loading}
        onClick={() => void load()}
      >
        <Headphones className="mr-1 h-3.5 w-3.5" />
        {loading ? 'Cargando…' : 'Escuchar'}
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
};

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
    timeZone: 'Europe/Madrid',
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
  const { hasPermission } = usePermissions();
  const phoneScope = getPhoneCallsScope(hasPermission);
  const missedOnly = phoneScope === 'missed';
  const today = useMemo(() => new Date(), []);
  const yesterday = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() - 1);
    return date;
  }, []);

  const initialDirection: 'all' | CallDirection = missedOnly || searchParams.get('filter') === 'missed'
    ? 'missed'
    : 'all';
  const [from, setFrom] = useState(toDateInputValue(yesterday));
  const [to, setTo] = useState(toDateInputValue(today));
  const [direction, setDirection] = useState<'all' | CallDirection>(initialDirection);
  const [search, setSearch] = useState('');

  const effectiveDirection: 'all' | CallDirection = missedOnly ? 'missed' : direction;

  const callsQuery = useQuery({
    queryKey: ['issabel-calls', companyId, from, to, effectiveDirection, phoneScope],
    enabled: !!companyId && phoneScope !== 'none',
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('issabel-calls', {
        body: {
          action: 'calls.list',
          company_id: companyId,
          from,
          to,
          direction: effectiveDirection === 'all' ? undefined : effectiveDirection,
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
      {!missedOnly &&
        (['all', 'outbound', 'inbound', 'missed'] as const).map((value) => (
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
  ), [callsQuery, direction, missedOnly]);

  useRegisterTopBarContent(
    {
      title: (
        <span className="inline-flex items-center gap-2">
          <Phone className="w-4 h-4 text-sky-500" />
          {missedOnly ? 'Llamadas perdidas' : 'Llamadas'}
        </span>
      ),
      actions: topBarActions,
    },
    [topBarActions, missedOnly],
  );

  return (
    <div className="space-y-4">
      {missedOnly ? (
        <p className="text-sm text-muted-foreground">
          Solo puedes consultar llamadas perdidas y mensajes de buzón de voz.
        </p>
      ) : null}
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
                  <TableHead>Grabación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCalls.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
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
                      <TableCell>
                        {call.missed_reason === 'voicemail' ? 'Buzón de voz' : call.disposition || '-'}
                      </TableCell>
                      <TableCell>
                        <CallRecordingPlayer call={call} />
                      </TableCell>
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
