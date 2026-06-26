export const TABLET_UNLOCK_SETTINGS_KEY = 'tablet_unlock_settings';

export const DEFAULT_TABLET_UNLOCK_CODE = '2222';

export interface TabletUnlockSettings {
  /** Clave para desbloquear modo tablet (consentimiento / cuestionario). */
  unlockCode: string;
}

export const DEFAULT_TABLET_UNLOCK_SETTINGS: TabletUnlockSettings = {
  unlockCode: DEFAULT_TABLET_UNLOCK_CODE,
};

export function normalizeTabletUnlockSettings(raw: unknown): TabletUnlockSettings {
  const parsed = raw && typeof raw === 'object' ? (raw as Partial<TabletUnlockSettings>) : {};
  const code = typeof parsed.unlockCode === 'string' ? parsed.unlockCode.trim() : '';
  return {
    unlockCode: code || DEFAULT_TABLET_UNLOCK_CODE,
  };
}

export function validateTabletUnlockCode(input: string, expected: string): boolean {
  return input.trim() === expected.trim();
}
