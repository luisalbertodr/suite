import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getIdleLoginEnabled, IDLE_LOGIN_MS } from '@/lib/idleLoginPrefs';

/**
 * Si la preferencia de apariencia está activa, cierra sesión tras 30s de inactividad
 * y muestra de nuevo la pantalla de login.
 */
export function IdleLoginWatcher() {
  const { user, signOut } = useAuth();
  const signingOut = useRef(false);
  const enabledRef = useRef(getIdleLoginEnabled());

  const doSignOut = useCallback(async () => {
    if (!user || signingOut.current) return;
    signingOut.current = true;
    try {
      await signOut();
    } finally {
      signingOut.current = false;
    }
  }, [user, signOut]);

  useEffect(() => {
    const syncPref = () => {
      enabledRef.current = getIdleLoginEnabled();
    };
    window.addEventListener('suite:idle-login-pref', syncPref);
    window.addEventListener('storage', syncPref);
    return () => {
      window.removeEventListener('suite:idle-login-pref', syncPref);
      window.removeEventListener('storage', syncPref);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    let timeout: ReturnType<typeof setTimeout> | null = null;

    const clear = () => {
      if (timeout != null) {
        clearTimeout(timeout);
        timeout = null;
      }
    };

    const arm = () => {
      clear();
      if (!enabledRef.current) return;
      timeout = setTimeout(() => {
        if (!enabledRef.current) return;
        void doSignOut();
      }, IDLE_LOGIN_MS);
    };

    const onActivity = () => {
      if (!enabledRef.current) return;
      arm();
    };

    const events: Array<keyof WindowEventMap> = [
      'mousedown',
      'mousemove',
      'keydown',
      'touchstart',
      'scroll',
      'pointerdown',
      'wheel',
    ];
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    arm();

    const onPref = () => {
      enabledRef.current = getIdleLoginEnabled();
      if (enabledRef.current) arm();
      else clear();
    };
    window.addEventListener('suite:idle-login-pref', onPref);

    return () => {
      clear();
      events.forEach((e) => window.removeEventListener(e, onActivity));
      window.removeEventListener('suite:idle-login-pref', onPref);
    };
  }, [user, doSignOut]);

  return null;
}
