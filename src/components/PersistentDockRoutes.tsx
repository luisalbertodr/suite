import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { RoutePanelProvider } from '@/contexts/RoutePanelContext';
import { DOCK_ROUTE_DEFS, matchDockRoute } from '@/lib/dockRoutes';

/**
 * Mantiene montadas las pestañas del dock ya visitadas para conservar estado y popups abiertos.
 */
export const PersistentDockRoutes: React.FC = () => {
  const { pathname } = useLocation();
  const activeKey = matchDockRoute(pathname);
  const [mountedKeys, setMountedKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (activeKey) {
      setMountedKeys((prev) => {
        if (prev.has(activeKey)) return prev;
        const next = new Set(prev);
        next.add(activeKey);
        return next;
      });
    }
  }, [activeKey]);

  if (!activeKey) return null;

  return (
    <>
      {DOCK_ROUTE_DEFS.map(({ key, Page }) => {
        if (!mountedKeys.has(key)) return null;
        const active = key === activeKey;
        return (
          <RoutePanelProvider key={key} active={active}>
            <div
              className={active ? undefined : 'hidden'}
              aria-hidden={active ? 'false' : 'true'}
              data-dock-panel={key}
            >
              <Page />
            </div>
          </RoutePanelProvider>
        );
      })}
    </>
  );
};
