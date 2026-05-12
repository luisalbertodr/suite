import React, { forwardRef } from 'react';
import { ShieldOff } from 'lucide-react';
import { Button, type ButtonProps } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { usePermissions } from '@/hooks/usePermissions';

interface PermissionButtonProps extends ButtonProps {
  /** Recurso requerido (e.g. 'sales', 'agenda', 'users') */
  resource: string;
  /** Acción requerida (e.g. 'create', 'update', 'delete', 'read') */
  action: string;
  /**
   * Comportamiento cuando no se tiene permiso:
   *  - 'disable' (por defecto): muestra el botón deshabilitado con tooltip.
   *  - 'hide': no se renderiza nada.
   */
  whenForbidden?: 'disable' | 'hide';
  /** Texto del tooltip cuando está bloqueado. */
  forbiddenLabel?: string;
}

/**
 * Botón con gate por permiso efectivo (rol + overrides).
 * Wrapper directo de <Button /> que respeta `usePermissions().hasPermission`.
 *
 * Uso:
 *   <PermissionButton resource="sales" action="create" onClick={cobrar}>Cobrar</PermissionButton>
 */
export const PermissionButton = forwardRef<HTMLButtonElement, PermissionButtonProps>(
  (
    {
      resource,
      action,
      whenForbidden = 'disable',
      forbiddenLabel,
      disabled,
      children,
      ...rest
    },
    ref,
  ) => {
    const { hasPermission, loading } = usePermissions();
    const allowed = loading ? false : hasPermission(resource, action);

    if (!allowed && whenForbidden === 'hide' && !loading) {
      return null;
    }

    const label =
      forbiddenLabel ??
      `Necesitas el permiso ${resource}:${action} para esta acción.`;

    if (!allowed) {
      return (
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="inline-flex">
                <Button
                  ref={ref}
                  disabled
                  aria-disabled
                  {...rest}
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-1 opacity-60">
                      {children}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 opacity-70">
                      <ShieldOff className="h-3.5 w-3.5" />
                      {children}
                    </span>
                  )}
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <Button ref={ref} disabled={disabled} {...rest}>
        {children}
      </Button>
    );
  },
);
PermissionButton.displayName = 'PermissionButton';

export default PermissionButton;
