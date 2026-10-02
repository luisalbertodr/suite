import React, { useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Palette, Upload, X, Image, Volume2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import {
  getNotificationSoundPrefs,
  setNotificationSoundPrefs,
  playNotificationSound,
} from '@/lib/notificationSounds';
import { getIdleLoginEnabled, setIdleLoginEnabled } from '@/lib/idleLoginPrefs';
import { UserAppearancePanel } from '@/components/UserAppearancePanel';
import { useWorkCenterBranding } from '@/hooks/useWorkCenterBranding';
import { useToast } from '@/hooks/use-toast';

export const AppearanceConfig: React.FC = () => {
  const { toast } = useToast();
  const {
    displayName,
    logoUrlLight,
    logoUrlDark,
    updateLogo,
    removeLogo,
    isLoading: brandingLoading,
    hasWorkCenter,
  } = useWorkCenterBranding();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const darkFileInputRef = useRef<HTMLInputElement>(null);
  const [idleLogin30s, setIdleLogin30s] = useState(() => getIdleLoginEnabled());

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>, variant: 'light' | 'dark') => {
    const file = event.target.files?.[0];
    if (file?.type.startsWith('image/')) {
      updateLogo.mutate({ file, variant });
    }
    event.target.value = '';
  };

  if (brandingLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center p-8">
          <p>Cargando configuración de apariencia...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <UserAppearancePanel
        title="Apariencia de tu usuario"
        description="Personaliza el color del sidebar y el tema de tu sesión. Así se distingue de un vistazo quién tiene la sesión iniciada."
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Palette className="h-5 w-5" />
            <span>Estación y centro de trabajo</span>
          </CardTitle>
          <CardDescription>
            Preferencias de esta estación y branding compartido del centro
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-lg font-medium mb-4">Sonidos de notificación</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Avisos sonoros para WhatsApp, marketing y la campanita. Puedes activarlos/desactivarlos, ajustar volumen y probar cada sonido.
            </p>
            <SoundPrefsEditor />
          </div>

          <div>
            <h3 className="text-lg font-medium mb-2">Pantalla de login por inactividad</h3>
            <p className="text-sm text-muted-foreground mb-3">
              En esta estación, tras 30 segundos sin actividad se cierra la sesión y se vuelve a la
              pantalla de login (útil en recepción / kiosco).
            </p>
            <div className="flex items-start gap-3 rounded-lg border border-border p-3">
              <Checkbox
                id="idle-login-30s"
                checked={idleLogin30s}
                onCheckedChange={(checked) => {
                  const enabled = checked === true;
                  setIdleLogin30s(enabled);
                  setIdleLoginEnabled(enabled);
                  toast({
                    title: enabled ? 'Login por inactividad activado' : 'Login por inactividad desactivado',
                    description: enabled
                      ? 'Tras 30 s sin actividad se mostrará de nuevo el login.'
                      : 'La sesión ya no se cerrará automáticamente por inactividad.',
                  });
                }}
              />
              <Label htmlFor="idle-login-30s" className="text-sm font-medium leading-snug cursor-pointer">
                Habilitar pantalla de login cada 30 segundos de inactividad
              </Label>
            </div>
          </div>

          <div className="mt-2">
            <h3 className="text-lg font-medium mb-4">Centro de trabajo</h3>
            <p className="text-sm text-muted-foreground mb-2">
              Nombre y logo que se muestran en la barra superior de la aplicación
              {hasWorkCenter ? ' (centro laboral compartido)' : ''}.
            </p>
            <p className="text-sm font-medium text-foreground mb-4">{displayName}</p>
            <h4 className="text-sm font-medium mb-3">Logo app (modo día / noche)</h4>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Modo día</h5>
                  {logoUrlLight ? (
                    <div className="flex items-center space-x-3">
                      <div className="w-32 h-20 border border-border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                        <img
                          src={logoUrlLight}
                          alt="Logo modo día"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Cambiar
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => removeLogo.mutate('light')}
                          disabled={removeLogo.isPending}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full max-w-sm">
                      <div
                        className="w-32 h-20 border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <div className="text-center">
                          <Image className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
                          <p className="text-xs text-muted-foreground">Subir</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Modo noche</h5>
                  {logoUrlDark ? (
                    <div className="flex items-center space-x-3">
                      <div className="w-32 h-20 border border-border rounded-lg overflow-hidden bg-zinc-900 flex items-center justify-center">
                        <img
                          src={logoUrlDark}
                          alt="Logo modo noche"
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          variant="outline"
                          onClick={() => darkFileInputRef.current?.click()}
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Cambiar
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => removeLogo.mutate('dark')}
                          disabled={removeLogo.isPending}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Eliminar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full max-w-sm">
                      <div
                        className="w-32 h-20 border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer hover:border-muted-foreground/50 transition-colors bg-zinc-900"
                        onClick={() => darkFileInputRef.current?.click()}
                      >
                        <div className="text-center">
                          <Image className="w-6 h-6 mx-auto text-zinc-300 mb-1" />
                          <p className="text-xs text-zinc-300">Subir</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                aria-label="Subir logo"
                accept="image/*"
                onChange={(e) => handleLogoUpload(e, 'light')}
                className="hidden"
              />
              <input
                ref={darkFileInputRef}
                type="file"
                aria-label="Subir logo nocturno"
                accept="image/*"
                onChange={(e) => handleLogoUpload(e, 'dark')}
                className="hidden"
              />

              <div className="p-3 bg-muted border border-border rounded-lg">
                <p className="text-xs text-muted-foreground">
                  El logo de día y de noche se muestran en la barra superior según el tema activo.
                  En los PDFs se usa el logo de día. Formatos: JPG, PNG, GIF.
                  Tamaño recomendado: 200×100 px. Requiere permisos de administrador para guardar.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

function SoundPrefsEditor() {
  const [prefs, setPrefs] = useState(() => getNotificationSoundPrefs());
  const applyPrefs = (patch: Parameters<typeof setNotificationSoundPrefs>[0]) => {
    setNotificationSoundPrefs(patch);
    setPrefs(getNotificationSoundPrefs());
  };

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor="sound-enabled" className="text-sm font-medium">
          Sonidos activos
        </Label>
        <div className="flex items-center gap-2">
          <Switch
            id="sound-enabled"
            checked={prefs.enabled}
            onCheckedChange={(checked) => applyPrefs({ enabled: checked })}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Volume2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <Slider
          value={[Math.round(prefs.volume * 100)]}
          max={100}
          step={5}
          className="flex-1"
          onValueChange={([v]) => applyPrefs({ volume: (v ?? 55) / 100 })}
        />
        <span className="text-xs text-muted-foreground w-10 text-right tabular-nums">
          {Math.round(prefs.volume * 100)}%
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => playNotificationSound('whatsapp')}>
          Probar WhatsApp
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => playNotificationSound('marketing')}>
          Probar Marketing
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => playNotificationSound('bell')}>
          Probar Campanita
        </Button>
      </div>
    </div>
  );
}
