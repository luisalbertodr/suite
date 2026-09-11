import { useCallback, useEffect, useState } from 'react';

export type DockOrientation = 'horizontal' | 'vertical';

const STORAGE_KEY = 'suite-dock-orientation';

function readStored(): DockOrientation {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'vertical' ? 'vertical' : 'horizontal';
  } catch {
    return 'horizontal';
  }
}

function applyHtmlClass(orientation: DockOrientation) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('suite-dock-vertical', orientation === 'vertical');
}

if (typeof document !== 'undefined') {
  applyHtmlClass(readStored());
}

export function useDockOrientation() {
  const [orientation, setOrientationState] = useState<DockOrientation>(readStored);

  useEffect(() => {
    applyHtmlClass(orientation);
    try {
      localStorage.setItem(STORAGE_KEY, orientation);
    } catch {
      /* ignore quota / private mode */
    }
  }, [orientation]);

  const setOrientation = useCallback(
    (next: DockOrientation | ((prev: DockOrientation) => DockOrientation)) => {
      setOrientationState((prev) => (typeof next === 'function' ? next(prev) : next));
    },
    [],
  );

  const toggleOrientation = useCallback(() => {
    setOrientationState((prev) => (prev === 'horizontal' ? 'vertical' : 'horizontal'));
  }, []);

  return {
    orientation,
    setOrientation,
    toggleOrientation,
    isVertical: orientation === 'vertical',
  };
}
