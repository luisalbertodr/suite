import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useDockKeepAlive } from '@/contexts/DockKeepAliveContext';
import { RoutePanelProvider } from '@/contexts/RoutePanelContext';
import { DOCK_ROUTE_DEFS, matchDockRoute } from '@/lib/dockRoutes';

function DockPanel({
  active,
  panelKey,
  children,
}: {
  active: boolean;
  panelKey: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.inert = !active;
    if (!active && el.contains(document.activeElement)) {
      (document.activeElement as HTMLElement)?.blur();
    }
  }, [active]);

  return (
    <div
      ref={ref}
      className={active ? undefined : 'hidden'}
      data-dock-panel={panelKey}
      data-dock-active={active ? 'true' : 'false'}
    >
      {children}
    </div>
  );
}

/**
 * Mantiene montadas las pestañas del dock ya visitadas para conservar estado y popups abiertos.
 */
export const PersistentDockRoutes: React.FC = () => {
  const { pathname } = useLocation();
  const activeKey = matchDockRoute(pathname);
  const { mountedKeys, mountPanel } = useDockKeepAlive();

  useEffect(() => {
    if (activeKey) mountPanel(activeKey);
  }, [activeKey, mountPanel]);

  useEffect(() => {
    if (!activeKey) return;
    const inactive = document.querySelectorAll<HTMLElement>(
      '[data-dock-panel][data-dock-active="false"]',
    );
    const activeEl = document.activeElement;
    inactive.forEach((panel) => {
      if (activeEl && panel.contains(activeEl)) {
        (activeEl as HTMLElement).blur();
      }
    });
  }, [activeKey]);

  if (!activeKey) return null;

  return (
    <>
      {DOCK_ROUTE_DEFS.map(({ key, Page }) => {
        if (!mountedKeys.has(key)) return null;
        const active = key === activeKey;
        return (
          <RoutePanelProvider key={key} active={active}>
            <DockPanel active={active} panelKey={key}>
              <Page />
            </DockPanel>
          </RoutePanelProvider>
        );
      })}
    </>
  );
};
