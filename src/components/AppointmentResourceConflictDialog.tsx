import React from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: string[];
}

export const AppointmentResourceConflictDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  messages,
}) => {
  const unique = [...new Set(messages.filter(Boolean))];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogPortal>
        <AlertDialogOverlay className="z-[110]" />
        <AlertDialogPrimitive.Content
          className={cn(
            'fixed left-[50%] top-[50%] z-[110] grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg',
          )}
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              Conflicto de recurso o cabina
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left text-sm text-muted-foreground">
                <p>No se puede guardar la cita: algún servicio solapa una cabina o recurso ya reservado.</p>
                {unique.length > 0 && (
                  <ul className="list-disc pl-4 space-y-1 text-foreground/90">
                    {unique.map((msg) => (
                      <li key={msg}>{msg}</li>
                    ))}
                  </ul>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => onOpenChange(false)}>Entendido</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogPrimitive.Content>
      </AlertDialogPortal>
    </AlertDialog>
  );
};
