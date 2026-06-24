import React from 'react';
import { createPortal } from 'react-dom';
import { usePanelAwareVisible } from '@/hooks/usePanelAwareOpen';

type Props = {
  open: boolean;
  children: React.ReactNode;
};

/** Portal a document.body que se oculta al cambiar de pestaña del dock (estado `open` se conserva). */
export function PanelAwareBodyPortal({ open, children }: Props) {
  const visible = usePanelAwareVisible(open);
  if (!visible || typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}
