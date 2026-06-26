import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tablet } from 'lucide-react';
import { useTabletUnlockSettings } from '@/hooks/useTabletUnlockSettings';
import { useToast } from '@/hooks/use-toast';
import { DEFAULT_TABLET_UNLOCK_CODE } from '@/lib/tabletUnlockSettings';

export const TabletUnlockConfig: React.FC = () => {
  const { toast } = useToast();
  const { settings, isLoading, saveSettings, isSaving, defaultSettings } = useTabletUnlockSettings();
  const [code, setCode] = useState(settings.unlockCode);

  useEffect(() => {
    setCode(settings.unlockCode);
  }, [settings.unlockCode]);

  const handleSave = async () => {
    const trimmed = code.trim();
    if (!trimmed) {
      toast({ title: 'La clave no puede estar vacía', variant: 'destructive' });
      return;
    }
    try {
      await saveSettings({ unlockCode: trimmed });
      toast({
        title: 'Clave de tablet guardada',
        description: 'Se usará para desbloquear consentimiento y cuestionario en modo cliente.',
      });
    } catch (error: unknown) {
      toast({
        title: 'Error al guardar',
        description: error instanceof Error ? error.message : 'No se pudo guardar.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Tablet className="h-5 w-5" />
            Modo tablet
          </CardTitle>
          <CardDescription>Cargando…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tablet className="h-5 w-5" />
          Modo tablet (consentimiento y cuestionario)
        </CardTitle>
        <CardDescription>
          Clave para que el personal salga del modo cliente cuando la pantalla está bloqueada tras
          enviar el cuestionario o firmar un consentimiento.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 max-w-md">
        <div className="space-y-2">
          <Label htmlFor="tablet-unlock-code-config">Clave de desbloqueo</Label>
          <Input
            id="tablet-unlock-code-config"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={DEFAULT_TABLET_UNLOCK_CODE}
          />
          <p className="text-xs text-muted-foreground">
            Por defecto: {defaultSettings.unlockCode}. Compártala solo con el personal autorizado.
          </p>
        </div>
        <Button onClick={() => void handleSave()} disabled={isSaving}>
          {isSaving ? 'Guardando…' : 'Guardar clave'}
        </Button>
      </CardContent>
    </Card>
  );
};
