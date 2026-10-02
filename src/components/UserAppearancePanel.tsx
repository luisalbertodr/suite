import React from 'react';
import { Check, Moon, Palette, Sun, Monitor } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  useUserAppearance,
  type AppearanceTheme,
} from '@/hooks/useUserAppearance';

const colorOptions = [
  { name: 'blue', label: 'Azul', bgClass: 'bg-blue-600' },
  { name: 'green', label: 'Verde', bgClass: 'bg-green-600' },
  { name: 'purple', label: 'Morado', bgClass: 'bg-purple-600' },
  { name: 'red', label: 'Rojo', bgClass: 'bg-red-600' },
  { name: 'gray', label: 'Gris', bgClass: 'bg-gray-600' },
  { name: 'indigo', label: 'Índigo', bgClass: 'bg-indigo-600' },
  { name: 'teal', label: 'Verde azulado', bgClass: 'bg-teal-600' },
  { name: 'orange', label: 'Naranja', bgClass: 'bg-orange-600' },
];

const themeOptions: Array<{
  value: AppearanceTheme;
  label: string;
  icon: React.ReactNode;
}> = [
  { value: 'light', label: 'Claro', icon: <Sun className="h-4 w-4 text-amber-500" /> },
  { value: 'dark', label: 'Nocturno', icon: <Moon className="h-4 w-4 text-indigo-500" /> },
  { value: 'system', label: 'Sistema', icon: <Monitor className="h-4 w-4 text-muted-foreground" /> },
];

export type UserAppearancePanelProps = {
  /** Usuario cuyas preferencias se editan. Por defecto: sesión actual. */
  userId?: string | null;
  /** Si false, no aplica el tema en vivo (edición de otro usuario). */
  applyTheme?: boolean;
  /** Envuelve el contenido en Card. Por defecto true. */
  asCard?: boolean;
  /** Texto opcional bajo el título. */
  description?: string;
  title?: string;
};

export const UserAppearancePanel: React.FC<UserAppearancePanelProps> = ({
  userId,
  applyTheme,
  asCard = true,
  title = 'Apariencia personal',
  description = 'Color del sidebar y tema de la interfaz para este usuario. Ayuda a distinguir de quién es la sesión iniciada.',
}) => {
  const {
    sidebarColor,
    themePreference,
    updateSidebarColor,
    updateThemePreference,
    loading,
  } = useUserAppearance({
    userId,
    applyTheme,
  });

  const body = loading ? (
    <p className="text-sm text-muted-foreground py-4">Cargando preferencias de apariencia…</p>
  ) : (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium mb-2">Tema de la interfaz</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Se aplica al iniciar sesión con este usuario.
        </p>
        <div className="flex flex-wrap gap-2">
          {themeOptions.map((opt) => (
            <Button
              key={opt.value}
              type="button"
              variant={themePreference === opt.value ? 'default' : 'outline'}
              className="gap-2"
              onClick={() => void updateThemePreference(opt.value)}
            >
              {opt.icon}
              {opt.label}
              {themePreference === opt.value ? <Check className="h-3.5 w-3.5" /> : null}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Color del sidebar</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Cada usuario puede tener un color distinto para reconocer la sesión de un vistazo.
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {colorOptions.map((color) => (
            <Button
              key={color.name}
              type="button"
              variant={sidebarColor === color.name ? 'default' : 'outline'}
              className="h-16 flex flex-col items-center justify-center space-y-2 relative"
              onClick={() => void updateSidebarColor(color.name)}
            >
              <div className={`w-8 h-8 rounded-full ${color.bgClass}`} />
              <span className="text-xs">{color.label}</span>
              {sidebarColor === color.name ? (
                <Check className="absolute top-1 right-1 h-4 w-4" />
              ) : null}
            </Button>
          ))}
        </div>

        <div className="mt-4 p-3 bg-muted/60 border border-border rounded-lg">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Color actual</Badge>
            <span className="text-sm">
              {colorOptions.find((c) => c.name === sidebarColor)?.label || 'Azul'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Los cambios se guardan de inmediato y se sincronizan con la cuenta del usuario.
          </p>
        </div>
      </div>
    </div>
  );

  if (!asCard) return body;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Palette className="h-4 w-4" />
          <span>{title}</span>
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
};

export { colorOptions };
