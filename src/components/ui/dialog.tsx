import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { usePanelAwareOpen } from "@/hooks/usePanelAwareOpen"
import {
  DOCK_CLEARANCE_BOTTOM,
  DOCK_SAFE_MODAL_SHELL,
  preventRadixFocusOutsideDismiss,
} from "@/lib/dialogLayers"

type DialogProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>

const Dialog = ({ open, onOpenChange, ...props }: DialogProps) => {
  const { effectiveOpen, handleOpenChange } = usePanelAwareOpen(open, onOpenChange);
  return (
    <DialogPrimitive.Root
      modal={false}
      open={effectiveOpen}
      onOpenChange={handleOpenChange ?? onOpenChange}
      {...props}
    />
  );
}

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-x-0 top-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      DOCK_CLEARANCE_BOTTOM,
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    /** z-index compartido overlay + contenido (p. ej. z-[110] sobre ficha cliente z-[95]). */
    overlayClassName?: string;
  }
>(({ className, overlayClassName, children, onFocusOutside, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay className={overlayClassName} />
    {/*
      El dock (z-300) queda libre debajo; el popup se centra en la zona segura
      para que Aceptar/Cancelar nunca queden tapados por la barra inferior.
    */}
    <div
      className={cn(DOCK_SAFE_MODAL_SHELL, "z-50 pointer-events-none", overlayClassName)}
      data-suite-dialog-safe-shell
    >
      <DialogPrimitive.Content
        ref={ref}
        onFocusOutside={(event) => {
          preventRadixFocusOutsideDismiss(event);
          onFocusOutside?.(event);
        }}
        className={cn(
          "pointer-events-auto relative z-50 grid w-full max-w-lg max-h-full overflow-y-auto gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </div>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
