import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTabletUnlockSettings } from '@/hooks/useTabletUnlockSettings';
import { validateTabletUnlockCode } from '@/lib/tabletUnlockSettings';
import { exitPatientKiosk } from '@/lib/kioskExit';

type Props = {
  companyId: string | null | undefined;
  /** Si true, el botón solo aparece en pantallas bloqueadas (espera / completado). */
  onlyWhenLocked?: boolean;
  locked?: boolean;
};

export function TabletKioskUnlockButton({ companyId, onlyWhenLocked = false, locked = true }: Props) {
  const { settings } = useTabletUnlockSettings(companyId);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (onlyWhenLocked && !locked) return null;
  if (!companyId) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateTabletUnlockCode(code, settings.unlockCode)) {
      setError('Clave incorrecta');
      return;
    }
    setOpen(false);
    setCode('');
    setError(null);
    exitPatientKiosk();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setCode('');
          setOpen(true);
        }}
        className="fixed bottom-3 right-3 z-50 flex h-8 w-8 items-center justify-center rounded-full border border-border/40 bg-background/40 text-muted-foreground/40 shadow-sm backdrop-blur-sm transition-opacity hover:border-border hover:bg-background/80 hover:text-muted-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Desbloquear tablet"
        title="Desbloquear (personal)"
      >
        <Lock className="h-3.5 w-3.5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Desbloquear tablet</DialogTitle>
              <DialogDescription>
                Introduzca la clave de personal para salir del modo cliente.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-2">
              <Label htmlFor="tablet-unlock-code">Clave</Label>
              <Input
                id="tablet-unlock-code"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError(null);
                }}
                autoFocus
              />
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Desbloquear</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
