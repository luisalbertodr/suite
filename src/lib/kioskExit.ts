/** Cierra la ventana kiosk o vuelve al inicio de Suite. */
export function exitPatientKiosk() {
  try {
    window.close();
  } catch {
    /* ignore */
  }
  window.setTimeout(() => {
    if (!window.closed) {
      window.location.href = '/';
    }
  }, 120);
}
