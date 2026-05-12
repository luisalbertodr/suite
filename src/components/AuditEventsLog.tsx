import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Activity,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  User as UserIcon,
  ShieldCheck,
} from 'lucide-react';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

interface AuditEvent {
  id: string;
  company_id: string;
  actor_user_id: string | null;
  action: 'insert' | 'update' | 'delete';
  entity_schema: string;
  entity_table: string;
  entity_id: string | null;
  old_record: Record<string, unknown> | null;
  new_record: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_LABEL: Record<AuditEvent['action'], string> = {
  insert: 'Creación',
  update: 'Edición',
  delete: 'Borrado',
};

const ACTION_BADGE_CLASS: Record<AuditEvent['action'], string> = {
  insert: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  update: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  delete: 'bg-rose-500/15 text-rose-700 dark:text-rose-300',
};

const ACTION_ICON = {
  insert: Plus,
  update: Pencil,
  delete: Trash2,
} as const;

const TABLE_FILTERS: Array<{ value: string; label: string }> = [
  { value: 'all', label: 'Todas las tablas' },
  { value: 'user_company_roles', label: 'Roles de usuario' },
  { value: 'user_permissions', label: 'Permisos por usuario' },
  { value: 'user_permission_overrides', label: 'Excepciones (allow/deny)' },
  { value: 'user_profiles', label: 'Perfiles / vínculo empleado' },
  { value: 'agenda_appointments', label: 'Citas' },
  { value: 'customers', label: 'Clientes' },
  { value: 'invoices', label: 'Facturas' },
  { value: 'sales', label: 'Ventas (TPV)' },
  { value: 'notifications', label: 'Notificaciones' },
  { value: 'marketing_leads', label: 'Marketing (leads)' },
];

const RBAC_TABLES = new Set([
  'user_company_roles',
  'user_permissions',
  'user_permission_overrides',
  'user_profiles',
]);

const dateFormatter = new Intl.DateTimeFormat('es-ES', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const summariseRecord = (rec: Record<string, unknown> | null): string => {
  if (!rec) return '';
  const keys = Object.keys(rec).filter(
    (k) => !['id', 'created_at', 'updated_at', 'company_id'].includes(k),
  );
  const preview = keys.slice(0, 3).map((k) => {
    const v = rec[k];
    if (v === null || v === undefined) return `${k}=∅`;
    if (typeof v === 'object') return `${k}=…`;
    const str = String(v);
    return `${k}=${str.length > 30 ? str.slice(0, 29) + '…' : str}`;
  });
  return preview.join(' · ');
};

interface AuditEventsLogProps {
  defaultLimit?: number;
}

export const AuditEventsLog: React.FC<AuditEventsLogProps> = ({ defaultLimit = 50 }) => {
  const { companyId } = useCompanyFilter();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(defaultLimit);

  const fetchEvents = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('audit_events')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (tableFilter !== 'all') query = query.eq('entity_table', tableFilter);
      if (actionFilter !== 'all') query = query.eq('action', actionFilter);

      const { data, error } = await query;
      if (error) throw error;
      setEvents((data as AuditEvent[]) ?? []);
    } catch (err) {
      console.error('Error fetching audit events', err);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, tableFilter, actionFilter, limit]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return events;
    return events.filter((e) => {
      const blob = JSON.stringify(e).toLowerCase();
      return blob.includes(q);
    });
  }, [events, search]);

  const counts = useMemo(() => {
    const total = events.length;
    const rbac = events.filter((e) => RBAC_TABLES.has(e.entity_table)).length;
    return { total, rbac };
  }, [events]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="h-5 w-5 text-sky-500" />
              Registro de actividad (auditoría)
            </CardTitle>
            <CardDescription>
              Cambios reales en la base de datos: quién, qué y cuándo. Cubre citas, ventas,
              facturas, clientes, notificaciones y los cambios sobre usuarios/roles/permisos.
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={fetchEvents} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Select value={tableFilter} onValueChange={setTableFilter}>
            <SelectTrigger className="h-8 w-[230px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TABLE_FILTERS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="h-8 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todas las acciones</SelectItem>
              <SelectItem value="insert" className="text-xs">Creación</SelectItem>
              <SelectItem value="update" className="text-xs">Edición</SelectItem>
              <SelectItem value="delete" className="text-xs">Borrado</SelectItem>
            </SelectContent>
          </Select>

          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar (id, valores…)"
            className="h-8 flex-1 min-w-[200px] text-xs"
          />

          <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
            <SelectTrigger className="h-8 w-[100px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25" className="text-xs">25</SelectItem>
              <SelectItem value="50" className="text-xs">50</SelectItem>
              <SelectItem value="100" className="text-xs">100</SelectItem>
              <SelectItem value="250" className="text-xs">250</SelectItem>
            </SelectContent>
          </Select>

          <Badge variant="secondary" className="gap-1 text-[10px]">
            {counts.total} eventos · {counts.rbac} de RBAC
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {loading && events.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Cargando eventos…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No hay eventos para los filtros seleccionados.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1">
            {filtered.map((ev) => {
              const Icon = ACTION_ICON[ev.action];
              const tableLabel =
                TABLE_FILTERS.find((t) => t.value === ev.entity_table)?.label ?? ev.entity_table;
              const targetUserId =
                (ev.metadata?.target_user_id as string | undefined) ?? null;
              const summary = ev.action === 'delete'
                ? summariseRecord(ev.old_record)
                : summariseRecord(ev.new_record);

              return (
                <div
                  key={ev.id}
                  className="flex items-start gap-2 rounded-md border bg-card px-2 py-1.5 text-xs"
                >
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <Badge className={`${ACTION_BADGE_CLASS[ev.action]} text-[10px]`}>
                        {ACTION_LABEL[ev.action]}
                      </Badge>
                      <span className="font-medium">{tableLabel}</span>
                      {RBAC_TABLES.has(ev.entity_table) && (
                        <ShieldCheck className="h-3 w-3 text-sky-500" />
                      )}
                      <span className="text-muted-foreground">
                        · {dateFormatter.format(new Date(ev.created_at))}
                      </span>
                    </div>
                    {summary && (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {summary}
                      </p>
                    )}
                    <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0 text-[10px] text-muted-foreground">
                      {ev.entity_id && <span>id: {ev.entity_id.slice(0, 8)}…</span>}
                      {ev.actor_user_id && (
                        <span className="inline-flex items-center gap-1">
                          <UserIcon className="h-2.5 w-2.5" />
                          actor: {ev.actor_user_id.slice(0, 8)}…
                        </span>
                      )}
                      {targetUserId && (
                        <span>target: {targetUserId.slice(0, 8)}…</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AuditEventsLog;
