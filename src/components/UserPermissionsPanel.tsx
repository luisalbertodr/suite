import React, { useMemo, useState } from 'react';
import { Search, ShieldCheck, ShieldX, Inbox } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { toast } from 'sonner';
import {
  useUserAdmin,
  type UserPermissionOverride,
} from '@/hooks/useUserAdmin';
import type { Permission } from '@/hooks/useRoles';

interface UserPermissionsPanelProps {
  userId: string;
  companyId: string;
  permissions: Permission[];
  rolePermissionIds: Set<string>;
}

type EffectiveState = 'inherit' | 'allow' | 'deny';

const stateFromOverride = (
  override: UserPermissionOverride | undefined,
): EffectiveState => {
  if (!override) return 'inherit';
  return override.mode;
};

const groupPermissionsByResource = (perms: Permission[]) => {
  const groups = new Map<string, Permission[]>();
  for (const p of perms) {
    const key = p.resource || 'otros';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
};

const ACTION_LABELS: Record<string, string> = {
  read: 'Ver',
  create: 'Crear',
  update: 'Editar',
  delete: 'Eliminar',
  write: 'Escritura',
  manage: 'Gestionar',
  export: 'Exportar',
  import: 'Importar',
};

const labelForAction = (a: string) => ACTION_LABELS[a] ?? a;

/**
 * Panel de permisos efectivos por usuario.
 *
 * Cada permiso del sistema muestra su estado vigente:
 *  - "Heredado"  -> sin override, depende del rol base.
 *  - "Permitido" -> override allow (lo activa incluso si el rol no lo da).
 *  - "Denegado"  -> override deny (lo quita aunque el rol lo dé). DENY gana.
 *
 * Al pulsar un estado, se hace upsert/borrado del override correspondiente
 * via `user_permission_overrides`.
 */
export const UserPermissionsPanel: React.FC<UserPermissionsPanelProps> = ({
  userId,
  companyId,
  permissions,
  rolePermissionIds,
}) => {
  const { overrides, upsertOverride, removeOverrideByPermission, loading } =
    useUserAdmin(companyId);
  const [filter, setFilter] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const overrideByPermissionId = useMemo(() => {
    const m = new Map<string, UserPermissionOverride>();
    for (const o of overrides) {
      if (o.user_id === userId && o.permission_id) {
        m.set(o.permission_id, o);
      }
    }
    return m;
  }, [overrides, userId]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return permissions;
    return permissions.filter((p) => {
      const text = `${p.name ?? ''} ${p.resource} ${p.action} ${p.description ?? ''}`.toLowerCase();
      return text.includes(q);
    });
  }, [filter, permissions]);

  const grouped = useMemo(() => groupPermissionsByResource(filtered), [filtered]);

  const counts = useMemo(() => {
    let allow = 0;
    let deny = 0;
    let inherited = 0;
    for (const p of permissions) {
      const st = stateFromOverride(overrideByPermissionId.get(p.id));
      if (st === 'allow') allow++;
      else if (st === 'deny') deny++;
      else if (rolePermissionIds.has(p.id)) inherited++;
    }
    return { allow, deny, inherited };
  }, [permissions, overrideByPermissionId, rolePermissionIds]);

  const handleStateChange = async (
    permission: Permission,
    next: EffectiveState | '',
  ) => {
    if (!next) return;
    setPendingId(permission.id);
    try {
      if (next === 'inherit') {
        const ok = await removeOverrideByPermission(userId, permission.id);
        if (ok) toast.success(`"${permission.name ?? permission.resource}" vuelve al rol base`);
      } else {
        const ok = await upsertOverride({
          user_id: userId,
          company_id: companyId,
          permission_id: permission.id,
          mode: next,
        });
        if (ok) {
          toast.success(
            next === 'allow'
              ? `Permiso "${permission.name ?? permission.resource}" forzado a permitido`
              : `Permiso "${permission.name ?? permission.resource}" denegado`,
          );
        }
      }
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar permisos (recurso, acción…)"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-1.5 text-[10px]">
          <Badge variant="secondary" className="gap-1">
            <Inbox className="h-3 w-3" /> {counts.inherited} heredados
          </Badge>
          <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-300 gap-1">
            <ShieldCheck className="h-3 w-3" /> {counts.allow} allow
          </Badge>
          <Badge className="bg-rose-500/15 text-rose-700 hover:bg-rose-500/25 dark:text-rose-300 gap-1">
            <ShieldX className="h-3 w-3" /> {counts.deny} deny
          </Badge>
        </div>
      </div>

      <div className="rounded-md border max-h-[55vh] overflow-y-auto divide-y">
        {grouped.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            Sin permisos que coincidan con el filtro.
          </div>
        ) : (
          grouped.map(([resource, perms]) => (
            <div key={resource} className="p-2">
              <div className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {resource}
              </div>
              <div className="space-y-1">
                {perms.map((perm) => {
                  const override = overrideByPermissionId.get(perm.id);
                  const state = stateFromOverride(override);
                  const inheritedActive = rolePermissionIds.has(perm.id);
                  const label = perm.name || `${perm.resource}:${perm.action}`;
                  const busy = pendingId === perm.id || loading;

                  return (
                    <div
                      key={perm.id}
                      className="flex items-center justify-between gap-2 rounded-md border bg-card px-2 py-1.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium" title={label}>
                          {label}
                        </p>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {labelForAction(perm.action)}
                          {inheritedActive ? ' · activo por rol' : ' · no incluido en el rol'}
                        </p>
                      </div>
                      <ToggleGroup
                        type="single"
                        size="sm"
                        value={state}
                        onValueChange={(v) => handleStateChange(perm, v as EffectiveState | '')}
                        disabled={busy}
                        className="shrink-0"
                      >
                        <ToggleGroupItem
                          value="inherit"
                          className="h-6 px-1.5 text-[10px] data-[state=on]:bg-muted"
                          title="Hereda del rol base"
                        >
                          Rol
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="allow"
                          className="h-6 px-1.5 text-[10px] text-emerald-700 data-[state=on]:bg-emerald-100 data-[state=on]:text-emerald-800 dark:text-emerald-300 dark:data-[state=on]:bg-emerald-950"
                          title="Forzar como permitido"
                        >
                          Allow
                        </ToggleGroupItem>
                        <ToggleGroupItem
                          value="deny"
                          className="h-6 px-1.5 text-[10px] text-rose-700 data-[state=on]:bg-rose-100 data-[state=on]:text-rose-800 dark:text-rose-300 dark:data-[state=on]:bg-rose-950"
                          title="Denegar aunque el rol lo conceda"
                        >
                          Deny
                        </ToggleGroupItem>
                      </ToggleGroup>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <p className="text-[10px] text-muted-foreground">
        DENY tiene precedencia sobre ALLOW. Los cambios se aplican al instante.
      </p>
    </div>
  );
};

export default UserPermissionsPanel;
