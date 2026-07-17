import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Camera, Loader2, RefreshCw, Search } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  SMARTPSS_STATE_LABELS,
  smartPssMethodLabel,
  smartPssStateLabel,
  useSmartPssEvents,
  useSmartPssPing,
  type SmartPssEvent,
} from '@/hooks/useSmartPssEvents';

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatEventTime(event: SmartPssEvent): string {
  const iso = event.attendance_datetime_iso || event.attendance_utc_iso;
  if (!iso) return '—';
  try {
    return format(new Date(iso), 'dd/MM/yyyy HH:mm:ss', { locale: es });
  } catch {
    return iso;
  }
}

function stateBadgeVariant(
  state: number | null,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (state === 0) return 'default';
  if (state === 1) return 'secondary';
  if (state === 2 || state === 3) return 'outline';
  return 'outline';
}

export const SmartPssEventsPanel: React.FC = () => {
  const today = useMemo(() => new Date(), []);
  const weekAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  }, []);

  const [from, setFrom] = useState(toDateInputValue(weekAgo));
  const [to, setTo] = useState(toDateInputValue(today));
  const [q, setQ] = useState('');
  const [device, setDevice] = useState('');
  const [stateFilter, setStateFilter] = useState<string>('all');

  const filters = {
    from,
    to,
    q: q.trim() || undefined,
    device: device.trim() || undefined,
    state: stateFilter === 'all' ? null : Number(stateFilter),
    limit: 300,
  };

  const eventsQuery = useSmartPssEvents(filters);
  const pingQuery = useSmartPssPing(true);

  const events = eventsQuery.data?.events ?? [];
  const total = eventsQuery.data?.total ?? 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Camera className="h-5 w-5" />
                Eventos SmartPSS
              </CardTitle>
              <CardDescription>
                Registros de asistencia y control de acceso guardados por SmartPSS Lite
                (MySQL <code className="text-xs">smartpss_events</code>). Útiles para asistencia,
                movimiento fuera de horario o intrusión.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {pingQuery.data?.ok ? (
                <Badge variant="outline" className="tabular-nums">
                  {pingQuery.data.total} en BD
                </Badge>
              ) : pingQuery.isError ? (
                <Badge variant="destructive">Sin conexión MySQL</Badge>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void eventsQuery.refetch();
                  void pingQuery.refetch();
                }}
                disabled={eventsQuery.isFetching}
              >
                {eventsQuery.isFetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="ml-1.5">Actualizar</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-1.5">
              <Label htmlFor="smartpss-from">Desde</Label>
              <Input
                id="smartpss-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smartpss-to">Hasta</Label>
              <Input
                id="smartpss-to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smartpss-q">Persona / tarjeta</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="smartpss-q"
                  className="pl-8"
                  placeholder="Nombre, ID o tarjeta"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smartpss-device">Dispositivo</Label>
              <Input
                id="smartpss-device"
                placeholder="Nombre o IP"
                value={device}
                onChange={(e) => setDevice(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Object.entries(SMARTPSS_STATE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {eventsQuery.isError ? (
            <p className="text-sm text-destructive">
              {(eventsQuery.error as Error)?.message || 'No se pudieron cargar los eventos'}
            </p>
          ) : null}

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha / hora</TableHead>
                  <TableHead>Persona</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Método</TableHead>
                  <TableHead>Dispositivo</TableHead>
                  <TableHead>Observaciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </TableCell>
                  </TableRow>
                ) : events.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No hay eventos en el rango seleccionado. Cuando SmartPSS Lite registre
                      accesos, aparecerán aquí.
                    </TableCell>
                  </TableRow>
                ) : (
                  events.map((event, idx) => (
                    <TableRow
                      key={`${event.person_id}-${event.attendance_datetime}-${idx}`}
                    >
                      <TableCell className="whitespace-nowrap tabular-nums text-sm">
                        {formatEventTime(event)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-sm">
                            {event.person_name || event.person_id || '—'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {[event.person_id, event.person_card_no].filter(Boolean).join(' · ') ||
                              'Sin ID'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={stateBadgeVariant(event.attendance_state)}>
                          {smartPssStateLabel(event.attendance_state)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {smartPssMethodLabel(event.attendance_method)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm">{event.device_name || '—'}</span>
                          {event.device_ip ? (
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {event.device_ip}
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                        {event.remarks || event.handler || '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {!eventsQuery.isLoading && events.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Mostrando {events.length}
              {total > events.length ? ` de ${total}` : ''} eventos
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
};
