/** Preferencia de estación: volver a login tras 30s de inactividad. */
const STORAGE_KEY = 'suite_idle_login_30s';

export const IDLE_LOGIN_MS = 30_000;

export function getIdleLoginEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setIdleLoginEnabled(enabled: boolean): void {
  localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  window.dispatchEvent(new CustomEvent('suite:idle-login-pref', { detail: { enabled } }));
}
