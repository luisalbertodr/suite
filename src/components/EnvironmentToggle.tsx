import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Cloud, Server } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  getActiveEnvironment, 
  SUPABASE_ENVIRONMENTS 
} from '@/config/supabase-environments';
import { switchSupabaseEnvironment } from '@/integrations/supabase/client';

export const EnvironmentToggle = () => {
  const [currentEnv, setCurrentEnv] = useState<'cloud' | 'local'>(getActiveEnvironment());
  const [isChanging, setIsChanging] = useState(false);

  useEffect(() => {
    setCurrentEnv(getActiveEnvironment());
  }, []);

  const handleToggle = (checked: boolean) => {
    const newEnv = checked ? 'cloud' : 'local';
    if (newEnv !== currentEnv) {
      setIsChanging(true);
      // Small delay to show the UI change before reload
      setTimeout(() => {
        switchSupabaseEnvironment(newEnv);
      }, 300);
    }
  };

  const isCloud = currentEnv === 'cloud';
  const config = SUPABASE_ENVIRONMENTS[currentEnv];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isCloud ? <Cloud className="h-5 w-5" /> : <Server className="h-5 w-5" />}
          Entorno de Supabase
        </CardTitle>
        <CardDescription>
          Alterna entre Supabase Cloud y tu instancia Local
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Label htmlFor="env-toggle" className="flex items-center gap-2">
              <Server className={`h-4 w-4 ${!isCloud ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={!isCloud ? 'font-medium' : 'text-muted-foreground'}>Local</span>
            </Label>
            <Switch
              id="env-toggle"
              checked={isCloud}
              onCheckedChange={handleToggle}
              disabled={isChanging}
            />
            <Label htmlFor="env-toggle" className="flex items-center gap-2">
              <Cloud className={`h-4 w-4 ${isCloud ? 'text-primary' : 'text-muted-foreground'}`} />
              <span className={isCloud ? 'font-medium' : 'text-muted-foreground'}>Cloud</span>
            </Label>
          </div>
          <Badge variant={isCloud ? 'default' : 'secondary'}>
            {isCloud ? 'Cloud' : 'Local'}
          </Badge>
        </div>

        <div className="rounded-md bg-muted p-3 text-sm">
          <div className="font-medium mb-1">Conexión actual:</div>
          <code className="text-xs break-all">{config.url}</code>
        </div>

        <Alert variant="destructive" className="border-yellow-500 bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Importante:</strong> Al cambiar de entorno, los datos son diferentes. 
            Los usuarios y registros de un entorno no existen en el otro.
          </AlertDescription>
        </Alert>

        {isChanging && (
          <div className="text-center text-sm text-muted-foreground animate-pulse">
            Cambiando entorno...
          </div>
        )}
      </CardContent>
    </Card>
  );
};
