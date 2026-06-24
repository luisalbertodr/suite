import { useCallback, useEffect, useRef } from 'react';
import { useRoutePanelActive } from '@/contexts/RoutePanelContext';

/**
 * Oculta diálogos al cambiar de pestaña del dock sin resetear el estado `open` del padre.
 */
export function usePanelAwareOpen(
  open: boolean | undefined,
  onOpenChange?: (open: boolean) => void,
) {
  const panelActive = useRoutePanelActive();
  const panelActiveRef = useRef(panelActive);
  panelActiveRef.current = panelActive;
  const documentHiddenRef = useRef(
    typeof document !== 'undefined' && document.visibilityState === 'hidden',
  );

  useEffect(() => {
    const onVisibility = () => {
      documentHiddenRef.current = document.visibilityState === 'hidden';
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const effectiveOpen = open === undefined ? undefined : open && panelActive;

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && open === true) {
        if (!panelActiveRef.current) return;
        if (documentHiddenRef.current) return;
      }
      onOpenChange?.(next);
    },
    [open, onOpenChange],
  );

  return {
    effectiveOpen,
    handleOpenChange: onOpenChange ? handleOpenChange : undefined,
  };
}

/** Para overlays/portales custom: ocultar al cambiar de pestaña sin cerrar el estado. */
export function usePanelAwareVisible(open: boolean): boolean {
  const panelActive = useRoutePanelActive();
  return open && panelActive;
}
