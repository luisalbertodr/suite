import { useAuth } from '@/hooks/useAuth';
import { useNfcStationSession } from '@/hooks/useNfcStationSession';

/**
 * Con sesión abierta, sigue escuchando el lector NFC de la estación.
 * Si pasa otra tarjeta, cierra la sesión actual y entra con el nuevo usuario.
 */
export function NfcSessionWatcher() {
  const { user } = useAuth();
  useNfcStationSession({
    enabled: Boolean(user),
    currentUserId: user?.id ?? null,
  });
  return null;
}
