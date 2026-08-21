import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User, Lock, Eye, EyeOff } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { callNfcAuth, getNfcStationId, normalizeNfcUid } from '@/lib/nfcAuth';
import { checkNetworkAccess, NETWORK_ACCESS_DENIED_MESSAGE } from '@/lib/networkAccess';

function isTypingInLoginForm(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable) return true;
  if (el.tagName !== 'INPUT') return false;
  const input = el as HTMLInputElement;
  return input.id === 'email' || input.id === 'password' || input.name === 'email' || input.name === 'password';
}

function buildPublicBrandingLogoUrl(variant: 'light' | 'dark'): string | null {
  const base = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, '');
  const anon =
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined);
  if (!base || !anon) return null;
  const qs = new URLSearchParams({
    variant,
    apikey: anon,
  });
  return `${base}/functions/v1/public-branding?${qs.toString()}`;
}

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showTextLogin, setShowTextLogin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => new Date());
  const wedgeBuffer = useRef('');
  const wedgeLastKeyAt = useRef(0);
  const challengeRef = useRef<{ id: string; poll: string } | null>(null);
  const pollTimer = useRef<number | null>(null);
  const submittingWedge = useRef(false);
  const { signIn } = useAuth();
  const { theme, resolvedTheme } = useTheme();
  const [themeReady, setThemeReady] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    setThemeReady(true);
  }, []);

  useEffect(() => {
    const lastEmail = localStorage.getItem('last_login_email');
    if (lastEmail) setEmail(lastEmail);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const isDark = (resolvedTheme ?? theme) === 'dark';
  const logoSrc = useMemo(() => {
    const fallback = isDark ? '/lipoout-logo-dark.png' : '/lipoout-logo-light.png';
    if (logoFailed) return fallback;
    return buildPublicBrandingLogoUrl(isDark ? 'dark' : 'light') ?? fallback;
  }, [isDark, logoFailed]);

  useEffect(() => {
    setLogoFailed(false);
  }, [isDark]);

  const clearPoll = () => {
    if (pollTimer.current != null) {
      window.clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  };

  const applySessionTokens = useCallback(async (access_token: string, refresh_token: string) => {
    const { error: setErr } = await supabase.auth.setSession({ access_token, refresh_token });
    if (setErr) throw setErr;
    const gate = await checkNetworkAccess();
    if (!gate.allowed) {
      await supabase.auth.signOut();
      throw new Error(
        NETWORK_ACCESS_DENIED_MESSAGE + (gate.clientIp ? ` (IP: ${gate.clientIp})` : ''),
      );
    }
  }, []);

  const startNfcChallenge = useCallback(async () => {
    clearPoll();
    setError('');
    try {
      const station_id = getNfcStationId();
      const started = await callNfcAuth({ action: 'challenge.start', station_id });
      const challenge_id = String(started.challenge_id ?? '');
      const poll_token = String(started.poll_token ?? '');
      if (!challenge_id || !poll_token) throw new Error('No se pudo iniciar lectura NFC');
      challengeRef.current = { id: challenge_id, poll: poll_token };

      pollTimer.current = window.setInterval(() => {
        void (async () => {
          const ch = challengeRef.current;
          if (!ch) return;
          try {
            const polled = await callNfcAuth({
              action: 'challenge.poll',
              challenge_id: ch.id,
              poll_token: ch.poll,
            });
            const status = String(polled.status ?? '');
            if (status === 'completed') {
              clearPoll();
              await applySessionTokens(
                String(polled.access_token ?? ''),
                String(polled.refresh_token ?? ''),
              );
            } else if (status === 'failed' || status === 'expired') {
              clearPoll();
              setError(String(polled.error_message ?? 'Lectura NFC caducada o fallida'));
              window.setTimeout(() => void startNfcChallenge(), 800);
            }
          } catch (e) {
            console.warn('nfc poll', e);
          }
        })();
      }, 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar NFC');
    }
  }, [applySessionTokens]);

  const submitWedgeUid = useCallback(
    async (raw: string) => {
      const uid = normalizeNfcUid(raw);
      const ch = challengeRef.current;
      if (!ch || uid.length < 6 || submittingWedge.current) return;
      submittingWedge.current = true;
      setError('');
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
          clearPoll();
          await applySessionTokens(
            String(polled.access_token ?? ''),
            String(polled.refresh_token ?? ''),
          );
        } else {
          throw new Error(String(polled.error_message ?? 'Tarjeta no reconocida'));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error NFC');
        void startNfcChallenge();
      } finally {
        wedgeBuffer.current = '';
        submittingWedge.current = false;
      }
    },
    [applySessionTokens, startNfcChallenge],
  );

  useEffect(() => {
    void startNfcChallenge();

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingInLoginForm(e.target) || isTypingInLoginForm(document.activeElement)) {
        wedgeBuffer.current = '';
        return;
      }

      const nowKey = Date.now();
      if (nowKey - wedgeLastKeyAt.current > 800) wedgeBuffer.current = '';
      wedgeLastKeyAt.current = nowKey;

      if (e.key === 'Enter') {
        if (wedgeBuffer.current.length >= 6) {
          e.preventDefault();
          e.stopPropagation();
          void submitWedgeUid(wedgeBuffer.current);
        }
        return;
      }

      if (e.key.length === 1 && /[0-9a-fA-F]/.test(e.key)) {
        wedgeBuffer.current += e.key;
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      clearPoll();
      window.removeEventListener('keydown', onKeyDown, true);
    };
  }, [startNfcChallenge, submitWedgeUid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const { error } = await signIn(email, password);
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          setError('Credenciales incorrectas');
        } else {
          setError(error.message);
        }
      } else {
        localStorage.setItem('last_login_email', email);
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setIsLoading(false);
    }
  };

  const shellClass = isDark
    ? 'min-h-screen relative flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6'
    : 'min-h-screen relative flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 p-6';

  const dateClass = isDark
    ? 'text-lg sm:text-xl text-white/55 font-light capitalize tracking-wide'
    : 'text-lg sm:text-xl text-slate-500 font-light capitalize tracking-wide';
  const timeClass = isDark
    ? 'text-7xl sm:text-8xl md:text-9xl font-extralight text-white tracking-wider tabular-nums leading-none'
    : 'text-7xl sm:text-8xl md:text-9xl font-extralight text-slate-800 tracking-wider tabular-nums leading-none';
  const footerClass = isDark ? 'text-emerald-50/70' : 'text-slate-500';

  const labelClass = isDark
    ? 'block text-sm font-medium text-gray-200 mb-2'
    : 'block text-sm font-medium text-slate-700 mb-2';
  const inputClass = isDark
    ? 'w-full pl-10 pr-3 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm'
    : 'w-full pl-10 pr-3 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const passwordInputClass = isDark
    ? 'w-full pl-10 pr-12 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm'
    : 'w-full pl-10 pr-12 py-3 bg-white border border-slate-300 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const panelClass = isDark
    ? 'w-full max-w-md mt-8 bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-8 border border-white/20'
    : 'w-full max-w-md mt-8 bg-white/90 backdrop-blur-lg rounded-xl shadow-xl p-8 border border-slate-200';

  const dateLabel = now.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const timeLabel = now.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={shellClass}>
      <div className="flex flex-col items-center w-full max-w-3xl gap-6 text-center">
        {themeReady && (
          <img
            key={logoSrc}
            src={logoSrc}
            alt="Lipoout"
            className="h-28 sm:h-36 md:h-44 w-auto max-w-[min(90vw,42rem)] object-contain drop-shadow-2xl select-none"
            draggable={false}
            onError={() => setLogoFailed(true)}
          />
        )}

        <div className="space-y-3">
          <p className={dateClass}>{dateLabel}</p>
          <p className={timeClass}>{timeLabel}</p>
        </div>

        {showTextLogin && (
          <div className={panelClass}>
            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-700 dark:text-red-200 text-sm text-left">
                {error}
              </div>
            )}

            <form className="space-y-6 text-left" onSubmit={handleSubmit}>
              <div>
                <label htmlFor="email" className={labelClass}>
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    placeholder="Ingrese su email"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className={labelClass}>
                  Contraseña
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={passwordInputClass}
                    placeholder="Ingrese su contraseña"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-300" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400 hover:text-gray-300" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Iniciando sesión...
                  </div>
                ) : (
                  'Iniciar Sesión'
                )}
              </button>
            </form>
          </div>
        )}
      </div>

      <p className={`absolute bottom-3 right-4 text-[11px] leading-none select-none ${footerClass}`}>
        Lipoout{' '}
        <button
          type="button"
          onClick={() => setShowTextLogin((v) => !v)}
          className="inline p-0 m-0 border-0 bg-transparent appearance-none font-inherit text-inherit leading-none cursor-default focus:outline-none"
          aria-label={showTextLogin ? 'Ocultar acceso con email' : 'Mostrar acceso con email'}
          aria-pressed={showTextLogin}
        >
          ©
        </button>{' '}
        2026
      </p>
    </div>
  );
};
