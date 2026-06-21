import React, { createContext, useContext } from 'react';

const RoutePanelContext = createContext(true);

/** false cuando la pestaña del dock está montada pero oculta (keep-alive). */
export function RoutePanelProvider({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return <RoutePanelContext.Provider value={active}>{children}</RoutePanelContext.Provider>;
}

export function useRoutePanelActive(): boolean {
  return useContext(RoutePanelContext);
}
