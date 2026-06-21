/** z-index por encima del DockBar fijo (`z-[120]`). */
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
