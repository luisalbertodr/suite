import React, { useCallback, useEffect, useRef, useState } from 'react';
import { User, Lock, Eye, EyeOff, CreditCard } from 'lucide-react';
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

export const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showTextLogin, setShowTextLogin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [nfcStatus, setNfcStatus] = useState<'idle' | 'waiting' | 'working'>('idle');
  const [nfcHint, setNfcHint] = useState('Acerca tu tarjeta al lector ACR122U');
  const wedgeBuffer = useRef('');
  const wedgeLastKeyAt = useRef(0);
  const challengeRef = useRef<{ id: string; poll: string } | null>(null);
  const pollTimer = useRef<number | null>(null);
  const submittingWedge = useRef(false);
  const { signIn } = useAuth();

  useEffect(() => {
    const lastEmail = localStorage.getItem('last_login_email');
    if (lastEmail) setEmail(lastEmail);
  }, []);

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
    setNfcStatus('waiting');
    setNfcHint('Acerca tu tarjeta al lector ACR122U');
    try {
      const station_id = getNfcStationId();
      const started = await callNfcAuth({ action: 'challenge.start', station_id });
      const challenge_id = String(started.challenge_id ?? '');
      const poll_token = String(started.poll_token ?? '');
      if (!challenge_id || !poll_token) throw new Error('No se pudo iniciar lectura NFC');
      challengeRef.current = { id: challenge_id, poll: poll_token };
      setNfcHint(`Esperando tarjeta… estación ${station_id}`);

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
              setNfcStatus('working');
              await applySessionTokens(
                String(polled.access_token ?? ''),
                String(polled.refresh_token ?? ''),
              );
            } else if (status === 'failed' || status === 'expired') {
              clearPoll();
              setNfcStatus('idle');
              setError(String(polled.error_message ?? 'Lectura NFC caducada o fallida'));
              window.setTimeout(() => void startNfcChallenge(), 800);
            }
          } catch (e) {
            console.warn('nfc poll', e);
          }
        })();
      }, 900);
    } catch (e) {
      setNfcStatus('idle');
      setError(e instanceof Error ? e.message : 'No se pudo iniciar NFC');
    }
  }, [applySessionTokens]);

  const submitWedgeUid = useCallback(
    async (raw: string) => {
      const uid = normalizeNfcUid(raw);
      const ch = challengeRef.current;
      if (!ch || uid.length < 6 || submittingWedge.current) return;
      submittingWedge.current = true;
      setNfcStatus('working');
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
        setNfcStatus('waiting');
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

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="flex flex-col items-center w-full max-w-md gap-8">
        {/* Logo PNG centrado: todo el logo abre/cierra login por email */}
        <button
          type="button"
          title={showTextLogin ? 'Ocultar acceso con email' : 'Acceso con email'}
          aria-label={showTextLogin ? 'Ocultar acceso con email' : 'Mostrar acceso con email'}
          aria-pressed={showTextLogin}
          onClick={() => setShowTextLogin((v) => !v)}
          className="group relative flex items-center justify-center rounded-full focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-400/70 transition-transform hover:scale-[1.03] active:scale-[0.98] cursor-pointer"
        >
          <img
            src="/lipoout-logo.png"
            alt="Lipoout"
            className="h-40 w-40 sm:h-48 sm:w-48 object-contain drop-shadow-2xl pointer-events-none select-none"
            draggable={false}
          />
        </button>

        <div className="w-full bg-white/10 backdrop-blur-lg rounded-xl shadow-2xl p-8 border border-white/20">
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-5">
            <div className="flex items-center gap-3 text-emerald-100">
              <CreditCard
                className={`h-7 w-7 shrink-0 ${nfcStatus === 'waiting' ? 'animate-pulse' : ''}`}
              />
              <div>
                <p className="font-medium text-sm">Acerca tu tarjeta NFC</p>
                <p className="text-xs text-emerald-100/80 mt-0.5">{nfcHint}</p>
              </div>
            </div>
          </div>

          {showTextLogin && (
            <>
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/20" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-transparent px-2 text-gray-300">acceso con email</span>
                </div>
              </div>

              <form className="space-y-6" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-200 mb-2">
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
                      className="w-full pl-10 pr-3 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
                      placeholder="Ingrese su email"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-200 mb-2">
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
                      className="w-full pl-10 pr-12 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm"
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};
