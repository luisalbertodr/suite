/**
 * Vista de agenda por usuario (localStorage): último día y scroll vertical por día.
 * Migra el formato antiguo { dateYmd, scrollTop } si existía.
 */

export type AgendaViewPersisted = {
  lastDateYmd: string;
  scrollByYmd: Record<string, number>;
  /** Hora visible preferida por día (HH:mm), más fiable que scrollTop tras recargar citas. */
  timeByYmd: Record<string, string>;
};

const PREFIX_V2 = 'suite:agenda:view:v2:';
/** Formato plano antiguo (una sola fecha + scroll) */
const PREFIX_V1 = 'suite:agenda:view:';

export function agendaViewStorageKey(userId: string | undefined | null): string | null {
  if (!userId) return null;
  return `${PREFIX_V2}${userId}`;
}

/** userId explícito o el de sesión (disponible antes de que resuelva useAuth). */
export function resolveAgendaPersistUserId(explicitUserId?: string | null): string | null {
  if (explicitUserId) return explicitUserId;
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem('current_user_id');
  } catch {
    return null;
  }
}

/** yyyy-MM-dd persistido para inicializar la fecha sin parpadear en «hoy». */
export function loadInitialAgendaDateYmd(userId?: string | null): string | null {
  const p = loadAgendaViewPersisted(resolveAgendaPersistUserId(userId));
  return p?.lastDateYmd ?? null;
}

function normalizePersisted(raw: unknown): AgendaViewPersisted | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.lastDateYmd === 'string' && o.scrollByYmd && typeof o.scrollByYmd === 'object' && !Array.isArray(o.scrollByYmd)) {
    const scrollByYmd = { ...(o.scrollByYmd as Record<string, number>) };
    for (const k of Object.keys(scrollByYmd)) {
      const v = scrollByYmd[k];
      if (typeof v !== 'number' || !Number.isFinite(v)) delete scrollByYmd[k];
    }
    const timeByYmd: Record<string, string> = {};
    if (o.timeByYmd && typeof o.timeByYmd === 'object' && !Array.isArray(o.timeByYmd)) {
      for (const [k, v] of Object.entries(o.timeByYmd as Record<string, unknown>)) {
        if (typeof v === 'string' && /^\d{1,2}:\d{2}$/.test(v.trim())) {
          const [h, m] = v.trim().split(':').map(Number);
          if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
            timeByYmd[k] = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          }
        }
      }
    }
    return { lastDateYmd: o.lastDateYmd, scrollByYmd, timeByYmd };
  }
  if (typeof o.dateYmd === 'string' && typeof o.scrollTop === 'number' && Number.isFinite(o.scrollTop)) {
    return {
      lastDateYmd: o.dateYmd,
      scrollByYmd: { [o.dateYmd]: o.scrollTop },
      timeByYmd: {},
    };
  }
  return null;
}

export function loadAgendaViewPersisted(userId: string | undefined | null): AgendaViewPersisted | null {
  if (!userId || typeof window === 'undefined') return null;
  try {
    const keyV2 = `${PREFIX_V2}${userId}`;
    const rawV2 = localStorage.getItem(keyV2);
    if (rawV2) {
      const p = normalizePersisted(JSON.parse(rawV2));
      if (p) return p;
    }
    const rawV1 = localStorage.getItem(`${PREFIX_V1}${userId}`);
    if (rawV1) {
      const p = normalizePersisted(JSON.parse(rawV1));
      if (p) return p;
    }
  } catch {
    return null;
  }
  return null;
}

export function saveAgendaViewPersisted(userId: string | undefined | null, state: AgendaViewPersisted): void {
  const key = agendaViewStorageKey(userId);
  if (!key || typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    /* quota */
  }
}

export function mergePersistedScroll(
  prev: AgendaViewPersisted | null,
  dateYmd: string,
  scrollTop: number,
  timeHhmm?: string | null,
): AgendaViewPersisted {
  const scrollByYmd = { ...(prev?.scrollByYmd ?? {}) };
  const timeByYmd = { ...(prev?.timeByYmd ?? {}) };
  const prevTop = scrollByYmd[dateYmd] ?? 0;
  // Evita pisar scroll guardado con 0 al desmontar la cuadrícula vacía o en transición.
  if (scrollTop <= 0 && prevTop > 0) {
    const next: AgendaViewPersisted = {
      lastDateYmd: dateYmd,
      scrollByYmd,
      timeByYmd,
    };
    if (timeHhmm) {
      next.timeByYmd = { ...timeByYmd, [dateYmd]: timeHhmm };
    }
    return next;
  }
  scrollByYmd[dateYmd] = scrollTop;
  if (timeHhmm) {
    timeByYmd[dateYmd] = timeHhmm;
  }
  return {
    lastDateYmd: dateYmd,
    scrollByYmd,
    timeByYmd,
  };
}

export function mergePersistedAnchorTime(
  prev: AgendaViewPersisted | null,
  dateYmd: string,
  timeHhmm: string,
): AgendaViewPersisted {
  const timeByYmd = { ...(prev?.timeByYmd ?? {}) };
  timeByYmd[dateYmd] = timeHhmm;
  return {
    lastDateYmd: dateYmd,
    scrollByYmd: { ...(prev?.scrollByYmd ?? {}) },
    timeByYmd,
  };
}

export function mergePersistedLastDate(
  prev: AgendaViewPersisted | null,
  dateYmd: string,
): AgendaViewPersisted {
  return {
    lastDateYmd: dateYmd,
    scrollByYmd: { ...(prev?.scrollByYmd ?? {}) },
    timeByYmd: { ...(prev?.timeByYmd ?? {}) },
  };
}

/** Calcula HH:mm aproximado según scroll vertical de la cuadrícula. */
export function anchorTimeFromScrollTop(
  scrollTop: number,
  opts: {
    headerHeight: number;
    gridStartMin: number;
    gridEndMin: number;
    slotMinutes: number;
    cellHeight: number;
    viewportHeight: number;
  },
): string | null {
  const { headerHeight, gridStartMin, gridEndMin, slotMinutes, cellHeight, viewportHeight } = opts;
  if (slotMinutes <= 0 || cellHeight <= 0) return null;
  const centerY = scrollTop + viewportHeight * 0.35 - headerHeight;
  if (centerY < 0) return null;
  const minutesFromStart = (centerY / cellHeight) * slotMinutes;
  const targetMin = Math.max(gridStartMin, Math.min(gridEndMin, gridStartMin + minutesFromStart));
  const h = Math.floor(targetMin / 60);
  const m = Math.round(targetMin % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
