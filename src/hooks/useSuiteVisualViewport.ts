import { useEffect } from 'react';

/**
 * Sincroniza `--suite-vh` con la altura visible real (visualViewport).
 * En iOS, `100vh`/`100dvh` suelen ser más altos que la pantalla útil →
 * el dock fijo y el pie de Agenda quedan fuera y no se puede hacer scroll
 * porque el body tiene overflow:hidden.
 */
export function useSuiteVisualViewport(): void {
  useEffect(() => {
    const root = document.documentElement;
    let raf = 0;

    const apply = () => {
      raf = 0;
      const vv = window.visualViewport;
      const h = Math.round(vv?.height ?? window.innerHeight);
      if (h > 0) {
        root.style.setProperty('--suite-vh', `${h}px`);
      }
    };

    const schedule = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(apply);
    };

    apply();
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    window.addEventListener('orientationchange', schedule);

    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('orientationchange', schedule);
    };
  }, []);
}
