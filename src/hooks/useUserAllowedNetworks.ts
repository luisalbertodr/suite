import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export type UserAllowedNetwork = {
  id: string;
  user_id: string;
  cidr: string;
  label: string | null;
  created_by: string | null;
  created_at: string;
};

export const NETWORK_PRESETS: Array<{ cidr: string; label: string; description: string }> = [
  {
    cidr: '10.10.10.0/24',
    label: 'Clínica (proxy)',
    description: 'IP vista por el proxy Nginx (la más habitual en clínica)',
  },
  {
    cidr: '192.168.99.0/24',
    label: 'Clínica (LAN)',
    description: 'Red interna 192.168.99.x',
  },
  {
    cidr: '192.168.1.0/24',
    label: 'Oficina / casa',
    description: 'Red 192.168.1.x',
  },
  {
    cidr: '0.0.0.0/0',
    label: 'Cualquier IP (externo)',
    description: 'Permite acceso desde internet',
  },
];

/** Redes internas por defecto (excluye 0.0.0.0/0). */
export const INTERNAL_NETWORK_PRESETS = NETWORK_PRESETS.filter((p) => p.cidr !== '0.0.0.0/0');

const CIDR_RE =
  /^(?:\d{1,3}\.){3}\d{1,3}\/(?:[0-9]|[12][0-9]|3[0-2])$|^(?:[0-9a-fA-F:]+)\/(?:[0-9]|[1-9][0-9]|1[01][0-9]|12[0-8])$/;

export function isValidCidr(value: string): boolean {
  const v = value.trim();
  if (!CIDR_RE.test(v)) return false;
  if (v.includes('.')) {
    const host = v.split('/')[0];
    const parts = host.split('.').map(Number);
    if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
      return false;
    }
  }
  return true;
}

/**
 * CRUD de redes permitidas por usuario (tabla user_allowed_networks).
 * Sin filas = sin restricción de IP.
 */
export function useUserAllowedNetworks(userId: string | null | undefined) {
  const [networks, setNetworks] = useState<UserAllowedNetwork[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNetworks = useCallback(async () => {
    if (!userId) {
      setNetworks([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_allowed_networks')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setNetworks((data as UserAllowedNetwork[]) ?? []);
    } catch (e) {
      console.error('fetchNetworks', e);
      setNetworks([]);
      toast.error('No se pudieron cargar las redes del usuario');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void fetchNetworks();
  }, [fetchNetworks]);

  const addNetwork = useCallback(
    async (cidr: string, label?: string | null): Promise<boolean> => {
      if (!userId) return false;
      const normalized = cidr.trim();
      if (!isValidCidr(normalized)) {
        toast.error('CIDR no válido (ej. 192.168.99.0/24)');
        return false;
      }
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const { error } = await supabase.from('user_allowed_networks').insert({
          user_id: userId,
          cidr: normalized,
          label: label?.trim() || null,
          created_by: user?.id ?? null,
        });
        if (error) {
          if (error.code === '23505') {
            toast.error('Esa red ya está asignada');
          } else {
            throw error;
          }
          return false;
        }
        toast.success('Red añadida');
        await fetchNetworks();
        return true;
      } catch (e) {
        console.error('addNetwork', e);
        toast.error('No se pudo añadir la red');
        return false;
      }
    },
    [userId, fetchNetworks],
  );

  const removeNetwork = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const { error } = await supabase.from('user_allowed_networks').delete().eq('id', id);
        if (error) throw error;
        toast.success('Red eliminada');
        await fetchNetworks();
        return true;
      } catch (e) {
        console.error('removeNetwork', e);
        toast.error('No se pudo eliminar la red');
        return false;
      }
    },
    [fetchNetworks],
  );

  const clearNetworks = useCallback(async (): Promise<boolean> => {
    if (!userId) return false;
    try {
      const { error } = await supabase.from('user_allowed_networks').delete().eq('user_id', userId);
      if (error) throw error;
      toast.success('Restricción de redes eliminada (acceso desde cualquier IP)');
      await fetchNetworks();
      return true;
    } catch (e) {
      console.error('clearNetworks', e);
      toast.error('No se pudieron limpiar las redes');
      return false;
    }
  }, [userId, fetchNetworks]);

  return {
    networks,
    loading,
    fetchNetworks,
    addNetwork,
    removeNetwork,
    clearNetworks,
    isRestricted: networks.length > 0,
  };
}

/** Aplica redes internas por defecto a una lista de usuarios (omite quien ya tenga 0.0.0.0/0). */
export async function applyInternalNetworksToUsers(userIds: string[]): Promise<number> {
  const defaults = INTERNAL_NETWORK_PRESETS;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let applied = 0;
  for (const uid of userIds) {
    const { data: existing } = await supabase
      .from('user_allowed_networks')
      .select('cidr')
      .eq('user_id', uid);
    const rows = existing ?? [];
    if (rows.some((r) => r.cidr === '0.0.0.0/0')) continue;
    for (const preset of defaults) {
      if (rows.some((r) => r.cidr === preset.cidr)) continue;
      const { error } = await supabase.from('user_allowed_networks').insert({
        user_id: uid,
        cidr: preset.cidr,
        label: preset.label,
        created_by: user?.id ?? null,
      });
      if (!error) applied += 1;
    }
  }
  return applied;
}
