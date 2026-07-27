import React, { useLayoutEffect, useRef, useState } from 'react';

/** Ancho aproximado de Hoy + Sync + Actualizar (con gaps). */
const EXTRAS_MIN_PX = 210;

/**
 * Muestra los extras de la barra de agenda solo si caben en la fila de acciones.
 * Evita apilar/scroll de «Hoy», Sync y «Actualizar» en iPhone.
 */
export function AgendaTopBarFitExtras({ children }: { children: React.ReactNode }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    const row = wrap?.parentElement;
    if (!wrap || !row) return;
    const container = row.parentElement ?? row;

    const check = () => {
      const others = Array.from(row.children).filter((node) => node !== wrap) as HTMLElement[];
      const used = others.reduce((acc, el) => acc + el.getBoundingClientRect().width, 0);
      const gapPx = 6;
      const gaps = Math.max(0, others.length) * gapPx;
      const free = container.getBoundingClientRect().width - used - gaps;
      setShow(free >= EXTRAS_MIN_PX);
    };

    const ro = new ResizeObserver(check);
    ro.observe(container);
    ro.observe(row);
    window.addEventListener('resize', check);
    check();
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', check);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      className={show ? 'flex items-center gap-1.5 shrink-0' : 'hidden'}
      aria-hidden={!show}
    >
      {children}
    </div>
  );
}
