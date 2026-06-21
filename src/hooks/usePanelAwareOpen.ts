import { useCallback, useRef } from 'react';
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

  const effectiveOpen = open === undefined ? undefined : open && panelActive;

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next && open === true && !panelActiveRef.current) return;
      onOpenChange?.(next);
    },
    [open, onOpenChange],
  );

  return {
    effectiveOpen,
    handleOpenChange: onOpenChange ? handleOpenChange : undefined,
  };
}
