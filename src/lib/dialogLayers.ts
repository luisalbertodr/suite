/** z-index de banners de aviso (parte superior, por debajo del dock). */
export const SUITE_TOP_BANNER_Z = 'z-[280]';

/**
 * Diálogos / toasts que deben quedar por encima del banner de aviso
 * (p. ej. perfil «Pesar» o errores de guardado) y por debajo del dock.
 */
export const ABOVE_TOP_BANNER_Z = 'z-[290]';

/** Menús portaled (Select/Popover) sobre diálogos elevados. */
export const ABOVE_DIALOG_PORTAL_Z = 'z-[295]';

/** z-index del DockBar: por encima de modales y popovers para poder cambiar de pestaña. */
export const DOCK_BAR_Z = 'z-[300]';

/** Franja inferior libre para diálogos cuando el dock está expandido (CSS `--suite-dock-clearance`). */
export const DOCK_CLEARANCE_BOTTOM = 'suite-dock-clearance-bottom';

/** TopBar fija: deja el popup por debajo (`--suite-topbar-h` = 3rem o 6rem). */
export const TOP_BAR_CLEARANCE = 'top-[var(--suite-topbar-h,3rem)]';

/**
 * Contenedor full-viewport que deja libre el dock y centra el popup.
 * Usar en Dialog/AlertDialog y en modales custom `fixed inset-0`.
 */
export const DOCK_SAFE_MODAL_SHELL =
  'fixed inset-x-0 top-0 suite-dock-clearance-bottom flex items-center justify-center p-3 sm:p-4';

/**
 * Shell para modales de agenda (nueva/editar cita): libre de TopBar + dock,
 * anclado arriba para que el encabezado nunca quede fuera de pantalla.
 */
export const AGENDA_MODAL_SHELL =
  'fixed inset-x-0 top-[var(--suite-topbar-h,3rem)] suite-dock-clearance-bottom flex items-start justify-center overflow-y-auto p-3 sm:p-4';

/** z-index de diálogos estándar (por debajo del dock). */
export const ABOVE_DOCK_DIALOG_Z = 'z-[125]';

/**
 * Antes anclaba con top/bottom fijos; Dialog/AlertDialog ya usan DOCK_SAFE_MODAL_SHELL.
 * Se mantiene como max-height para callers legacy que lo pasan en className.
 */
export const ABOVE_DOCK_DIALOG_POSITION = 'max-h-full';

/** Altura máxima para diálogos que siguen centrados con translate-y. */
export const ABOVE_DOCK_DIALOG_MAX_H = 'suite-max-h-dialog-xl';

/** Centrado vertical conservador si no se usa posición anclada. */
export const ABOVE_DOCK_DIALOG_TOP = '!top-[42%]';

/** Evita que Alt+Tab / cambio de app cierre modales Radix (onFocusOutside). */
export function preventRadixFocusOutsideDismiss(event: Event) {
  event.preventDefault();
}
