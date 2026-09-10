import React, { useState } from 'react';
import { Network, Plus, Trash2, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  NETWORK_PRESETS,
  useUserAllowedNetworks,
} from '@/hooks/useUserAllowedNetworks';

interface UserAllowedNetworksPanelProps {
  userId: string;
  readOnly?: boolean;
}

/**
 * Configura desde qué redes (CIDR) puede entrar el usuario.
 * Sin redes = sin restricción. Con redes = solo esas.
 */
export const UserAllowedNetworksPanel: React.FC<UserAllowedNetworksPanelProps> = ({
  userId,
  readOnly = false,
}) => {
  const { networks, loading, addNetwork, removeNetwork, clearNetworks, isRestricted } =
    useUserAllowedNetworks(userId);
  const [customCidr, setCustomCidr] = useState('');
  const [customLabel, setCustomLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const hasCidr = (cidr: string) => networks.some((n) => n.cidr === cidr);

  const onTogglePreset = async (cidr: string, label: string) => {
    if (readOnly || busy) return;
    setBusy(true);
    try {
      if (hasCidr(cidr)) {
        const row = networks.find((n) => n.cidr === cidr);
        if (row) await removeNetwork(row.id);
      } else {
        await addNetwork(cidr, label);
      }
    } finally {
      setBusy(false);
    }
  };

  const onAddCustom = async () => {
    if (readOnly || busy) return;
    setBusy(true);
    try {
      const ok = await addNetwork(customCidr, customLabel || null);
      if (ok) {
        setCustomCidr('');
        setCustomLabel('');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-sky-200 bg-sky-50/80 dark:border-sky-900 dark:bg-sky-950/40 p-3 text-xs text-sky-900 dark:text-sky-200 space-y-1.5">
        <div className="flex items-center gap-2 font-medium">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Acceso por red
        </div>
        <p>
          Si no hay redes, el usuario puede entrar desde cualquier IP. Si añades redes, solo
          podrá acceder cuando la IP vista por <strong>supabase.lipoout.com</strong> esté en
          alguna de ellas.
        </p>
        <p>
          Hoy casi todo el tráfico web llega como <code className="text-[10px]">10.10.10.1</code>{' '}
          (firewall). El preset «Clínica (proxy)» permite sede — y también internet si el
          firewall no reenvía la IP pública real. Las redes <code className="text-[10px]">192.168.x</code>{' '}
          solo aplican si el servidor ve esa IP (LAN/VPN), no la IP privada de un PC en casa.
          «Cualquier IP» anula el resto.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <Network className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Estado:</span>
        {loading ? (
          <Badge variant="secondary">Cargando…</Badge>
        ) : isRestricted ? (
          <Badge variant="default">Restringido ({networks.length})</Badge>
        ) : (
          <Badge variant="outline">Sin restricción (cualquier IP)</Badge>
        )}
      </div>

      <div className="space-y-2">
        <Label>Presets</Label>
        <div className="grid gap-2">
          {NETWORK_PRESETS.map((preset) => {
            const active = hasCidr(preset.cidr);
            return (
              <button
                key={preset.cidr}
                type="button"
                disabled={readOnly || busy || loading}
                onClick={() => void onTogglePreset(preset.cidr, preset.label)}
                className={`flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                } disabled:opacity-50`}
              >
                <div>
                  <div className="font-medium">{preset.label}</div>
                  <div className="text-[11px] text-muted-foreground">{preset.description}</div>
                  <code className="text-[10px] text-muted-foreground">{preset.cidr}</code>
                </div>
                <Badge variant={active ? 'default' : 'outline'}>{active ? 'Sí' : 'No'}</Badge>
              </button>
            );
          })}
        </div>
      </div>

      {!readOnly && (
        <div className="space-y-2 border-t pt-3">
          <Label>CIDR personalizado</Label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={customCidr}
              onChange={(e) => setCustomCidr(e.target.value)}
              placeholder="203.0.113.0/24"
              className="font-mono text-sm"
            />
            <Input
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="Etiqueta (opcional)"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => void onAddCustom()}
              disabled={busy || !customCidr.trim()}
            >
              <Plus className="h-4 w-4 mr-1" />
              Añadir
            </Button>
          </div>
        </div>
      )}

      {networks.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <Label>Redes asignadas</Label>
          <ul className="space-y-1.5">
            {networks.map((n) => (
              <li
                key={n.id}
                className="flex items-center justify-between gap-2 rounded border px-2.5 py-1.5 text-sm"
              >
                <div className="min-w-0">
                  <code className="font-mono text-xs">{n.cidr}</code>
                  {n.label ? (
                    <span className="ml-2 text-muted-foreground text-xs">{n.label}</span>
                  ) : null}
                </div>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive"
                    disabled={busy}
                    onClick={() => void removeNetwork(n.id)}
                    aria-label="Eliminar red"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {!readOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => {
                if (
                  window.confirm(
                    '¿Quitar todas las redes? El usuario podrá acceder desde cualquier IP.',
                  )
                ) {
                  void clearNetworks();
                }
              }}
            >
              Quitar restricción
            </Button>
          )}
        </div>
      )}
    </div>
  );
};
