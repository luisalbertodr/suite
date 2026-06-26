import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { type DockRouteKey } from '@/lib/dockRoutes';

type DockKeepAliveValue = {
  mountedKeys: Set<DockRouteKey>;
  mountPanel: (key: DockRouteKey) => void;
};

const DockKeepAliveContext = createContext<DockKeepAliveValue>({
  mountedKeys: new Set(),
  mountPanel: () => {},
});

export function DockKeepAliveProvider({ children }: { children: React.ReactNode }) {
  const [mountedKeys, setMountedKeys] = useState<Set<DockRouteKey>>(() => new Set());

  const mountPanel = useCallback((key: DockRouteKey) => {
    setMountedKeys((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  useEffect(() => {
    const idle = (
      window as Window & {
        requestIdleCallback?: (
          cb: IdleRequestCallback,
          opts?: IdleRequestOptions,
        ) => number;
        cancelIdleCallback?: (id: number) => void;
      }
    ).requestIdleCallback;
    const cancelIdle = (
      window as Window & { cancelIdleCallback?: (id: number) => void }
    ).cancelIdleCallback;

    // Precarga solo las pestañas más usadas en el flujo recepción/marketing (no todas a la vez).
    const prefetchKeys: DockRouteKey[] = ['agenda', 'clientes', 'marketing', 'whatsapp'];
    const run = () => {
      setMountedKeys((prev) => {
        const next = new Set(prev);
        for (const key of prefetchKeys) next.add(key);
        return next.size === prev.size ? prev : next;
      });
    };

    if (idle) {
      const id = idle(run, { timeout: 8000 });
      return () => cancelIdle?.(id);
    }

    const t = window.setTimeout(run, 5000);
    return () => window.clearTimeout(t);
  }, []);

  const value = useMemo(
    () => ({ mountedKeys, mountPanel }),
    [mountedKeys, mountPanel],
  );

  return (
    <DockKeepAliveContext.Provider value={value}>{children}</DockKeepAliveContext.Provider>
  );
}

export function useDockKeepAlive(): DockKeepAliveValue {
  return useContext(DockKeepAliveContext);
}

/** Monta una pestaña del dock antes del clic (hover en la barra inferior). */
export function usePrefetchDockPanel(): (key: DockRouteKey) => void {
  return useDockKeepAlive().mountPanel;
}
