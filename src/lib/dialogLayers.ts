/** z-index de banners de aviso (parte superior, por debajo del dock). */
export const SUITE_TOP_BANNER_Z = 'z-[280]';

/** z-index del DockBar: por encima de modales y popovers para poder cambiar de pestaña. */
export const DOCK_BAR_Z = 'z-[300]';

/** Franja inferior libre (dock fijo bottom-4 + altura ~4.5rem). */
export const DOCK_CLEARANCE_BOTTOM = 'bottom-[6.5rem]';

/** z-index de diálogos estándar (por debajo del dock). */
export const ABOVE_DOCK_DIALOG_Z = 'z-[125]';

/**
 * Ancla el diálogo entre el margen superior y el dock (bottom-4 + ~4.5rem).
 * Evita que el pie del modal quede bajo la barra aunque use translate-y centrado.
 */
export const ABOVE_DOCK_DIALOG_POSITION =
  '!top-4 !bottom-[6.5rem] !translate-y-0';

/** Altura máxima para diálogos que siguen centrados con translate-y. */
export const ABOVE_DOCK_DIALOG_MAX_H = 'max-h-[min(90vh,calc(100dvh-12rem))]';

/** Centrado vertical conservador si no se usa posición anclada. */
export const ABOVE_DOCK_DIALOG_TOP = '!top-[42%]';

/** Evita que Alt+Tab / cambio de app cierre modales Radix (onFocusOutside). */
export function preventRadixFocusOutsideDismiss(event: Event) {
  event.preventDefault();
}
