import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'suite-dock-collapsed';

function readStored(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function applyHtmlClass(collapsed: boolean) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('suite-dock-collapsed', collapsed);
}

if (typeof document !== 'undefined') {
  applyHtmlClass(readStored());
}

export function useDockCollapsed() {
  const [collapsed, setCollapsedState] = useState(readStored);

  useEffect(() => {
    applyHtmlClass(collapsed);
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore quota / private mode */
    }
  }, [collapsed]);

  const setCollapsed = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    setCollapsedState((prev) => (typeof next === 'function' ? next(prev) : next));
  }, []);

  return { collapsed, setCollapsed };
}
