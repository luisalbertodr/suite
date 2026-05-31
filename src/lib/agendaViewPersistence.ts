/**
 * Vista de agenda por usuario (localStorage): último día y scroll vertical por día.
 * Migra el formato antiguo { dateYmd, scrollTop } si existía.
 */

export type AgendaViewPersisted = {
  lastDateYmd: string;
  scrollByYmd: Record<string, number>;
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
    return { lastDateYmd: o.lastDateYmd, scrollByYmd };
  }
  if (typeof o.dateYmd === 'string' && typeof o.scrollTop === 'number' && Number.isFinite(o.scrollTop)) {
    return {
      lastDateYmd: o.dateYmd,
      scrollByYmd: { [o.dateYmd]: o.scrollTop },
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
): AgendaViewPersisted {
  const scrollByYmd = { ...(prev?.scrollByYmd ?? {}) };
  const prevTop = scrollByYmd[dateYmd] ?? 0;
  // Evita pisar scroll guardado con 0 al desmontar la cuadrícula vacía o en transición.
  if (scrollTop <= 0 && prevTop > 0) {
    return {
      lastDateYmd: dateYmd,
      scrollByYmd,
    };
  }
  scrollByYmd[dateYmd] = scrollTop;
  return {
    lastDateYmd: dateYmd,
    scrollByYmd,
  };
}

export function mergePersistedLastDate(
  prev: AgendaViewPersisted | null,
  dateYmd: string,
): AgendaViewPersisted {
  return {
    lastDateYmd: dateYmd,
    scrollByYmd: { ...(prev?.scrollByYmd ?? {}) },
  };
}
