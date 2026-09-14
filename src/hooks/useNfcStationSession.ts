import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  applyNfcStationFromUrl,
  callNfcAuth,
  consumeNfcPickupFromUrl,
  getNfcStationId,
  normalizeNfcUid,
} from '@/lib/nfcAuth';
import { checkNetworkAccess, NETWORK_ACCESS_DENIED_MESSAGE } from '@/lib/networkAccess';

type Options = {
  enabled: boolean;
  /** Si coincide con el user de la tarjeta, no reinicia sesión. */
  currentUserId?: string | null;
  onError?: (message: string) => void;
};

const POLL_MS = 700;
const RESTART_AFTER_LOGIN_MS = 400;
const RESTART_AFTER_SAME_USER_MS = 800;
const RESTART_AFTER_ERROR_MS = 1200;
const RESTART_AFTER_SUPERSEDED_MS = 2500;
const LEADER_KEY_PREFIX = 'suite_nfc_leader:';
const LEADER_TTL_MS = 4000;

async function applySessionTokens(accessToken: string, refreshToken: string) {
  const { error: setErr } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (setErr) {
    // Tokens NFC huérfanos/revocados: limpiar basura local para no romper login manual.
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
    const raw = setErr.message || '';
    if (/session missing|session_not_found|Invalid Refresh Token|refresh_token/i.test(raw)) {
      throw new Error('Sesión NFC caducada; acerca de nuevo la tarjeta');
    }
    throw setErr;
  }
  const gate = await checkNetworkAccess();
  if (!gate.allowed) {
    await supabase.auth.signOut();
    throw new Error(
      NETWORK_ACCESS_DENIED_MESSAGE + (gate.clientIp ? ` (IP: ${gate.clientIp})` : ''),
    );
  }
}

function tabId(): string {
  try {
    const key = 'suite_nfc_tab_id';
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(key, id);
    }
    return id;
  } catch {
    return `tmp-${Math.random().toString(36).slice(2)}`;
  }
}

/** Solo una pestaña por estación crea retos; el resto espera. */
function tryBecomeLeader(stationId: string): boolean {
  const key = `${LEADER_KEY_PREFIX}${stationId || 'default'}`;
  const now = Date.now();
  const me = tabId();
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as { id?: string; at?: number };
      if (parsed.id && parsed.id !== me && typeof parsed.at === 'number' && now - parsed.at < LEADER_TTL_MS) {
        return false;
      }
    }
    localStorage.setItem(key, JSON.stringify({ id: me, at: now }));
    // Confirmar que ganamos (carrera entre pestañas).
    const confirm = JSON.parse(localStorage.getItem(key) || '{}') as { id?: string };
    return confirm.id === me;
  } catch {
    return true;
  }
}

function renewLeader(stationId: string): void {
  const key = `${LEADER_KEY_PREFIX}${stationId || 'default'}`;
  try {
    localStorage.setItem(key, JSON.stringify({ id: tabId(), at: Date.now() }));
  } catch {
    /* ignore */
  }
}

/**
 * Reto NFC continuo por estación: login y cambio de usuario con otra tarjeta.
 */
export function useNfcStationSession({ enabled, currentUserId = null, onError }: Options) {
  const challengeRef = useRef<{ id: string; poll: string } | null>(null);
  const pollTimer = useRef<number | null>(null);
  const restartTimer = useRef<number | null>(null);
  const leaderTimer = useRef<number | null>(null);
  const challengeGen = useRef(0);
  const starting = useRef(false);
  const applying = useRef(false);
  const wedgeBuffer = useRef('');
  const wedgeLastKeyAt = useRef(0);
  const submittingWedge = useRef(false);
  const onErrorRef = useRef(onError);
  const currentUserIdRef = useRef(currentUserId);
  onErrorRef.current = onError;
  currentUserIdRef.current = currentUserId;

  const clearTimers = useCallback(() => {
    if (pollTimer.current != null) {
      window.clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    if (restartTimer.current != null) {
      window.clearTimeout(restartTimer.current);
      restartTimer.current = null;
    }
  }, []);

  const scheduleRestartRef = useRef<(delayMs?: number) => void>(() => {});

  const applyCompleted = useCallback(async (access: string, refresh: string, userId?: string | null) => {
    if (applying.current) return;
    if (userId && currentUserIdRef.current && userId === currentUserIdRef.current) {
      scheduleRestartRef.current(RESTART_AFTER_SAME_USER_MS);
      return;
    }
    applying.current = true;
    try {
      await applySessionTokens(access, refresh);
    } finally {
      applying.current = false;
      // Tras login/cambio de usuario hay que recrear el reto waiting de inmediato.
      // Si no, el siguiente tag crea un pickup huérfano y Chrome no responde.
      scheduleRestartRef.current(RESTART_AFTER_LOGIN_MS);
    }
  }, []);

  const startChallenge = useCallback(async () => {
    if (!enabled || starting.current || applying.current) return;
    applyNfcStationFromUrl();
    const station_id = getNfcStationId();
    if (!tryBecomeLeader(station_id)) {
      // Otra pestaña lidera esta estación: no crear retos (evita supersede storm).
      scheduleRestartRef.current(RESTART_AFTER_SUPERSEDED_MS);
      return;
    }
    renewLeader(station_id);
    starting.current = true;
    clearTimers();
    const gen = ++challengeGen.current;
    try {
      const started = await callNfcAuth({ action: 'challenge.start', station_id });
      if (gen !== challengeGen.current) return;

      // No confiar en completed huérfanos (tokens a menudo ya revocados).
      if (
        String(started.status ?? '') === 'completed' &&
        started.access_token &&
        started.refresh_token
      ) {
        try {
          await applyCompleted(
            String(started.access_token),
            String(started.refresh_token),
            started.user_id ? String(started.user_id) : null,
          );
          return;
        } catch (e) {
          console.warn('nfc claim discarded', e);
          // Continuar creando un waiting limpio.
        }
      }

      const challenge_id = String(started.challenge_id ?? '');
      const poll_token = String(started.poll_token ?? '');
      if (!challenge_id || !poll_token) throw new Error('No se pudo iniciar lectura NFC');
      challengeRef.current = { id: challenge_id, poll: poll_token };

      pollTimer.current = window.setInterval(() => {
        void (async () => {
          if (gen !== challengeGen.current) return;
          const ch = challengeRef.current;
          if (!ch) return;
          renewLeader(station_id);
          try {
            const polled = await callNfcAuth({
              action: 'challenge.poll',
              challenge_id: ch.id,
              poll_token: ch.poll,
            });
            if (gen !== challengeGen.current) return;
            const status = String(polled.status ?? '');
            const errMsg = String(polled.error_message ?? '');
            if (status === 'completed') {
              clearTimers();
              const access = String(polled.access_token ?? '');
              const refresh = String(polled.refresh_token ?? '');
              const userId = polled.user_id ? String(polled.user_id) : null;
              if (!access || !refresh) {
                throw new Error('Sesión NFC incompleta; acerca de nuevo la tarjeta');
              }
              await applyCompleted(access, refresh, userId);
            } else if (status === 'failed' || status === 'expired') {
              clearTimers();
              if (errMsg === 'superseded') {
                // No reiniciar en 200ms: alimenta la guerra entre pestañas.
                const jitter = 500 + Math.floor(Math.random() * 1500);
                scheduleRestartRef.current(RESTART_AFTER_SUPERSEDED_MS + jitter);
                return;
              }
              if (errMsg) onErrorRef.current?.(errMsg);
              scheduleRestartRef.current(RESTART_AFTER_ERROR_MS);
            }
          } catch (e) {
            if (gen !== challengeGen.current) return;
            console.warn('nfc poll', e);
          }
        })();
      }, POLL_MS);
    } catch (e) {
      if (gen !== challengeGen.current) return;
      const msg = e instanceof Error ? e.message : 'No se pudo iniciar NFC';
      onErrorRef.current?.(msg);
      scheduleRestartRef.current(2000);
    } finally {
      starting.current = false;
    }
  }, [applyCompleted, clearTimers, enabled]);

  scheduleRestartRef.current = (delayMs = 800) => {
    if (!enabled) return;
    if (restartTimer.current != null) window.clearTimeout(restartTimer.current);
    restartTimer.current = window.setTimeout(() => {
      restartTimer.current = null;
      void startChallenge();
    }, delayMs);
  };

  const submitWedgeUid = useCallback(
    async (raw: string) => {
      const uid = normalizeNfcUid(raw);
      const ch = challengeRef.current;
      if (!ch || uid.length < 6 || submittingWedge.current) return;
      submittingWedge.current = true;
      try {
        await callNfcAuth({
          action: 'challenge.wedge',
          challenge_id: ch.id,
          poll_token: ch.poll,
          uid,
        });
        const polled = await callNfcAuth({
          action: 'challenge.poll',
          challenge_id: ch.id,
          poll_token: ch.poll,
        });
        if (String(polled.status) === 'completed') {
          clearTimers();
          await applyCompleted(
            String(polled.access_token ?? ''),
            String(polled.refresh_token ?? ''),
            polled.user_id ? String(polled.user_id) : null,
          );
        } else {
          throw new Error(String(polled.error_message ?? 'Tarjeta no reconocida'));
        }
      } catch (e) {
        onErrorRef.current?.(e instanceof Error ? e.message : 'Error NFC');
        scheduleRestartRef.current(800);
      } finally {
        wedgeBuffer.current = '';
        submittingWedge.current = false;
      }
    },
    [applyCompleted, clearTimers],
  );

  useEffect(() => {
    if (!enabled) {
      challengeGen.current += 1;
      clearTimers();
      if (leaderTimer.current != null) {
        window.clearInterval(leaderTimer.current);
        leaderTimer.current = null;
      }
      challengeRef.current = null;
      return;
    }

    let cancelled = false;
    void (async () => {
      const pickup = consumeNfcPickupFromUrl();
      if (pickup) {
        try {
          const polled = await callNfcAuth({
            action: 'challenge.poll',
            challenge_id: pickup.challengeId,
            poll_token: pickup.pollToken,
          });
          if (cancelled) return;
          if (String(polled.status) === 'completed') {
            await applyCompleted(
              String(polled.access_token ?? ''),
              String(polled.refresh_token ?? ''),
              polled.user_id ? String(polled.user_id) : null,
            );
            return;
          }
        } catch (e) {
          console.warn('nfc pickup', e);
        }
      }
      if (!cancelled) void startChallenge();
    })();

    // Renovar liderazgo periódicamente mientras esta pestaña está activa.
    leaderTimer.current = window.setInterval(() => {
      renewLeader(getNfcStationId());
    }, Math.floor(LEADER_TTL_MS / 2));

    const onKeyDown = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLElement) {
        const tag = t.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) {
          const input = t as HTMLInputElement;
          if (
            input.id === 'email' ||
            input.id === 'password' ||
            input.name === 'email' ||
            input.name === 'password' ||
            tag === 'TEXTAREA' ||
            tag === 'SELECT' ||
            t.isContentEditable
          ) {
            wedgeBuffer.current = '';
            return;
          }
        }
      }

      const now = Date.now();
      if (now - wedgeLastKeyAt.current > 800) wedgeBuffer.current = '';
      wedgeLastKeyAt.current = now;

      if (e.key === 'Enter') {
        if (wedgeBuffer.current.length >= 6) {
          e.preventDefault();
          e.stopPropagation();
          void submitWedgeUid(wedgeBuffer.current);
        }
        return;
      }
      if (e.key.length === 1 && /[0-9a-fA-F]/i.test(e.key)) {
        wedgeBuffer.current += e.key;
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      cancelled = true;
      challengeGen.current += 1;
      clearTimers();
      if (leaderTimer.current != null) {
        window.clearInterval(leaderTimer.current);
        leaderTimer.current = null;
      }
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [applyCompleted, clearTimers, enabled, startChallenge, submitWedgeUid]);
}
