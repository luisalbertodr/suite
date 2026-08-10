import React from 'react';
import { useLockPageScroll } from '@/hooks/useLockPageScroll';
import { useRoutePanelActive } from '@/contexts/RoutePanelContext';

/** Contenedor fijo a pantalla completa para vistas de agenda (sin scroll de página). */
export function AgendaFullViewportShell({ children }: { children: React.ReactNode }) {
  const panelActive = useRoutePanelActive();
  useLockPageScroll(panelActive);

  return (
    <div className="suite-h-agenda-viewport fixed inset-x-0 top-12 z-[1] flex flex-col overflow-hidden px-1.5 sm:px-4 md:px-6">
      {children}
    </div>
  );
}
