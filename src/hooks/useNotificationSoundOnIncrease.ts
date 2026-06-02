import { useEffect, useRef } from 'react';
import { playNotificationSound, type NotificationSoundKind } from '@/lib/notificationSounds';

/**
 * Reproduce un sonido cuando `count` sube respecto al valor anterior.
 * En el primer render no suena (evita ruido al cargar contadores iniciales).
 */
export function useNotificationSoundOnIncrease(
  count: number,
  kind: NotificationSoundKind,
  options?: { enabled?: boolean },
) {
  const enabled = options?.enabled ?? true;
  const prevRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      prevRef.current = count;
      return;
    }
    if (prevRef.current === null) {
      prevRef.current = count;
      return;
    }
    if (count > prevRef.current) {
      playNotificationSound(kind);
    }
    prevRef.current = count;
  }, [count, kind, enabled]);
}
