import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Headphones, Phone, RefreshCw, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useRegisterTopBarContent } from '@/components/TopBarContentContext';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { usePermissions } from '@/hooks/usePermissions';
import { getPhoneCallsScope } from '@/lib/phonePermissions';
import {
  callDisplayClasses,
  callDisplayLabels,
  callRecordingSource,
  canListenCallRecording,
  getCallDisplayType,
  type CallDisplayType,
} from '@/lib/lipooutPhone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface IssabelCall {
  id: string;
  direction: 'outbound' | 'inbound' | 'missed';
  display_type?: CallDisplayType;
  display_party?: string;
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
  can_listen_recording?: boolean;
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

const CallRecordingPlayer: React.FC<{
  call: IssabelCall;
  phoneScope: ReturnType<typeof getPhoneCallsScope>;
}> = ({ call, phoneScope }) => {
  const source = call.recording_path ||
    (phoneScope === 'all' && (call.duration_seconds ?? 0) > 0 ? `uniqueid:${call.id}` : null) ||
    call.recording_url ||
    null;
  const allowed = canListenCallRecording(phoneScope, call);
  const displayType = getCallDisplayType(call);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioSrc, setAudioSrc] = useState<string | null>(null);

  useEffect(() => () => {
    if (audioSrc) URL.revokeObjectURL(audioSrc);
  }, [audioSrc]);

  if (!source || !allowed) {
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

  const listenLabel = displayType === 'voicemail' ? 'Escuchar mensaje' : 'Escuchar grabación';

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
        {loading ? 'Cargando…' : listenLabel}
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
};

type DirectionFilter = 'all' | CallDisplayType;

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

  const initialDirection: DirectionFilter = missedOnly || searchParams.get('filter') === 'missed'
    ? 'missed'
    : 'all';
  const [from, setFrom] = useState(toDateInputValue(yesterday));
  const [to, setTo] = useState(toDateInputValue(today));
  const [direction, setDirection] = useState<DirectionFilter>(initialDirection);
  const [search, setSearch] = useState('');

  const effectiveDirection: DirectionFilter = missedOnly
    ? (direction === 'all' ? 'all' : direction === 'voicemail' ? 'voicemail' : 'missed')
    : direction;

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
          limit: 1000,
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
    const displayType = getCallDisplayType(call);
    return [
      call.display_party,
      call.customer_phone,
      call.customer?.name,
      callDisplayLabels[displayType],
    ]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(needle));
  });

  const renderCustomer = (call: IssabelCall) => {
    if (call.customer) {
      return (
        <Link
          to={`/clientes?customer=${call.customer.id}`}
          className="font-medium text-blue-600 hover:underline"
        >
          {call.customer.name}
        </Link>
      );
    }
    return call.display_party || call.customer_phone || '-';
  };

  const filterButtons: { value: DirectionFilter; label: string }[] = missedOnly
    ? [
        { value: 'all', label: 'Perdidas y buzón' },
        { value: 'missed', label: 'Perdida' },
        { value: 'voicemail', label: 'Buzón de voz' },
      ]
    : [
        { value: 'all', label: 'Todas' },
        { value: 'outbound', label: 'Saliente' },
        { value: 'inbound', label: 'Entrante' },
        { value: 'missed', label: 'Perdida' },
        { value: 'voicemail', label: 'Buzón de voz' },
      ];

  const topBarActions = useMemo(() => (
    <>
      {filterButtons.map(({ value, label }) => (
        <Button
          key={value}
          type="button"
          size="sm"
          variant={direction === value ? 'default' : 'outline'}
          onClick={() => setDirection(value)}
          className="h-7 px-2 text-xs"
        >
          {label}
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
  ), [callsQuery, direction, filterButtons]);

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
                placeholder="Buscar cliente, teléfono o tipo..."
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
                  <TableHead>Cliente / teléfono</TableHead>
                  <TableHead>Duración</TableHead>
                  <TableHead>Audio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCalls.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No hay llamadas para los filtros seleccionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCalls.map((call) => {
                    const displayType = getCallDisplayType(call);
                    return (
                      <TableRow key={call.id}>
                        <TableCell className="whitespace-nowrap">{formatDateTime(call.started_at)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={callDisplayClasses[displayType]}>
                            {callDisplayLabels[displayType]}
                          </Badge>
                        </TableCell>
                        <TableCell>{renderCustomer(call)}</TableCell>
                        <TableCell>{formatDuration(call.duration_seconds)}</TableCell>
                        <TableCell>
                          <CallRecordingPlayer call={call} phoneScope={phoneScope} />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
