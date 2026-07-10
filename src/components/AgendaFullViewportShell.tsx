import React from 'react';
import { useLockPageScroll } from '@/hooks/useLockPageScroll';
import { useRoutePanelActive } from '@/contexts/RoutePanelContext';

/** Altura útil entre topbar (pt-14) y dock (pb-24). */
export const AGENDA_VIEWPORT_HEIGHT = 'calc(100dvh - 3.5rem - 6rem)';

/** Contenedor fijo a pantalla completa para vistas de agenda (sin scroll de página). */
export function AgendaFullViewportShell({ children }: { children: React.ReactNode }) {
  const panelActive = useRoutePanelActive();
  useLockPageScroll(panelActive);

  return (    <div
      className="fixed inset-x-0 top-14 z-[1] flex flex-col overflow-hidden px-4 sm:px-6"
      style={{ height: AGENDA_VIEWPORT_HEIGHT, maxHeight: AGENDA_VIEWPORT_HEIGHT }}
    >
      {children}
    </div>
  );
}
