import { useEffect } from 'react';

const LOCK_CLASS = 'suite-page-scroll-lock';

/** Impide scroll del documento solo mientras la vista activa lo pide (p. ej. Agenda en el dock). */
export function useLockPageScroll(active = true): void {
  useEffect(() => {
    const html = document.documentElement;
    if (active) {
      html.classList.add(LOCK_CLASS);
    } else {
      html.classList.remove(LOCK_CLASS);
    }
    return () => {
      html.classList.remove(LOCK_CLASS);
    };
  }, [active]);
}
