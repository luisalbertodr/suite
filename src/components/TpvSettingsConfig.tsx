import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useTpvSettings } from '@/hooks/useTpvSettings';
import { useToast } from '@/hooks/use-toast';
import { Receipt } from 'lucide-react';

export const TpvSettingsConfig: React.FC = () => {
  const { toast } = useToast();
  const { settings, isLoading, saveSettings, isSaving, defaultSettings } = useTpvSettings();
  const [local, setLocal] = useState(settings);

  useEffect(() => {
    setLocal(settings);
  }, [settings]);

  const handleSave = async () => {
    try {
      await saveSettings(local);
      toast({
        title: 'Configuración TPV guardada',
        description: 'Los cambios se aplican en los próximos cobros.',
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
            <Receipt className="h-5 w-5" />
            TPV
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
          <Receipt className="h-5 w-5" />
          Terminal TPV
        </CardTitle>
        <CardDescription>
          Comportamiento del cobro y la facturación desde el punto de venta.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
          <div className="space-y-1">
            <Label htmlFor="auto-invoice-appointment" className="text-base font-medium">
              Facturar automáticamente al cobrar una cita
            </Label>
            <p className="text-sm text-muted-foreground">
              Tras generar el ticket desde una cita (agenda → Cobrar en TPV), se emite la factura
              al instante si el ticket tiene cliente vinculado en ficha. Si falta el cliente, se
              abrirá el formulario de facturación con los datos precargados.
            </p>
          </div>
          <Switch
            id="auto-invoice-appointment"
            checked={local.autoInvoiceOnAppointmentCharge}
            onCheckedChange={(checked) =>
              setLocal((prev) => ({ ...prev, autoInvoiceOnAppointmentCharge: checked }))
            }
          />
        </div>

        <div className="flex gap-2">
          <Button onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? 'Guardando…' : 'Guardar'}
          </Button>
          <Button variant="outline" onClick={() => setLocal(defaultSettings)}>
            Restablecer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
