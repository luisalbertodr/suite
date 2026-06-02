export type NotificationSoundKind = 'whatsapp' | 'marketing' | 'bell';

const STORAGE_KEY = 'suite_notification_sounds_v1';

export type NotificationSoundPrefs = {
  enabled: boolean;
  volume: number;
};

const DEFAULT_PREFS: NotificationSoundPrefs = {
  enabled: true,
  volume: 0.55,
};

function readPrefs(): NotificationSoundPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<NotificationSoundPrefs>;
    return {
      enabled: parsed.enabled ?? DEFAULT_PREFS.enabled,
      volume: clampVolume(parsed.volume ?? DEFAULT_PREFS.volume),
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function clampVolume(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_PREFS.volume;
  return Math.max(0, Math.min(1, v));
}

export function getNotificationSoundPrefs(): NotificationSoundPrefs {
  return readPrefs();
}

export function setNotificationSoundPrefs(patch: Partial<NotificationSoundPrefs>): void {
  if (typeof window === 'undefined') return;
  const next = { ...readPrefs(), ...patch };
  if (patch.volume !== undefined) next.volume = clampVolume(next.volume);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

let audioCtx: AudioContext | null = null;
let unlockBound = false;
let audioUnlocked = false;

/** Necesario en muchos navegadores antes del primer sonido. */
export function unlockNotificationAudio(): void {
  if (typeof window === 'undefined' || unlockBound) return;
  unlockBound = true;
  const unlock = () => {
    // Crear el contexto (si no existe) y reanudarlo tras un gesto de usuario.
    void (async () => {
      const ctx = await ensureAudioContext();
      if (!ctx) return;
      try {
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        if (ctx.state === 'running') {
          audioUnlocked = true;
        }
      } catch {
        // Si falla aquí, el navegador seguirá mostrando el warning habitual;
        // simplemente no sonará hasta el siguiente gesto válido.
      }
    })();
  };
  window.addEventListener('pointerdown', unlock, { once: true, capture: true });
  window.addEventListener('keydown', unlock, { once: true, capture: true });
}

async function ensureAudioContext(): Promise<AudioContext | null> {
  if (typeof window === 'undefined') return null;
  const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  return audioCtx;
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine',
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

function playWhatsappTone(ctx: AudioContext, volume: number, now: number) {
  playTone(ctx, 880, now, 0.08, volume * 0.9, 'sine');
  playTone(ctx, 1174, now + 0.1, 0.1, volume * 0.75, 'sine');
}

function playMarketingTone(ctx: AudioContext, volume: number, now: number) {
  playTone(ctx, 660, now, 0.12, volume * 0.85, 'triangle');
  playTone(ctx, 880, now + 0.14, 0.08, volume * 0.55, 'sine');
}

function playBellTone(ctx: AudioContext, volume: number, now: number) {
  playTone(ctx, 784, now, 0.18, volume, 'sine');
  playTone(ctx, 988, now + 0.22, 0.12, volume * 0.55, 'sine');
  playTone(ctx, 1318, now + 0.38, 0.2, volume * 0.35, 'triangle');
}

const lastPlayedAt: Partial<Record<NotificationSoundKind, number>> = {};

export function playNotificationSound(kind: NotificationSoundKind): void {
  const prefs = readPrefs();
  if (!prefs.enabled) return;
  // Evita intentar reproducir desde efectos automáticos antes del primer gesto.
  if (!audioUnlocked) return;

  const now = Date.now();
  const minGapMs = kind === 'whatsapp' ? 400 : 700;
  const last = lastPlayedAt[kind] ?? 0;
  if (now - last < minGapMs) return;
  lastPlayedAt[kind] = now;

  void (async () => {
    const ctx = await ensureAudioContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const vol = prefs.volume;
    if (kind === 'whatsapp') playWhatsappTone(ctx, vol, t);
    else if (kind === 'marketing') playMarketingTone(ctx, vol, t);
    else playBellTone(ctx, vol, t);
  })();
}
