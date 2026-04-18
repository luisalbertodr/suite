import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { useAgendaEmployees } from '@/hooks/useAgendaEmployees';
import { useAgendaPreferences } from '@/hooks/useAgendaPreferences';
import { useToast } from '@/hooks/use-toast';

export const AgendaPreferencesConfig: React.FC = () => {
  const { toast } = useToast();
  const { employees } = useAgendaEmployees();
  const { preferences, isLoading, savePreferences, isSaving, defaultPreferences } = useAgendaPreferences();
  const [local, setLocal] = useState(preferences);

  useEffect(() => {
    setLocal(preferences);
  }, [preferences]);

  const employeeIds = useMemo(() => employees.map((e) => e.id), [employees]);
  const effectiveSelected = local.visibleEmployeeIds.length ? local.visibleEmployeeIds : employeeIds;

  const toggleEmployee = (id: string) => {
    setLocal((prev) => {
      const exists = prev.visibleEmployeeIds.includes(id);
      return {
        ...prev,
        visibleEmployeeIds: exists
          ? prev.visibleEmployeeIds.filter((x) => x !== id)
          : [...prev.visibleEmployeeIds, id],
      };
    });
  };

  const toggleField = (field: keyof typeof local.visibleFields) => {
    setLocal((prev) => ({
      ...prev,
      visibleFields: {
        ...prev.visibleFields,
        [field]: !prev.visibleFields[field],
      },
    }));
  };

  const handleSave = async () => {
    try {
      await savePreferences(local);
      toast({
        title: 'Preferencias de agenda guardadas',
        description: 'Se aplicarán en tu sesión y en próximos accesos.',
      });
    } catch (error: any) {
      toast({
        title: 'Error al guardar',
        description: error?.message || 'No se pudo guardar la configuración de agenda.',
        variant: 'destructive',
      });
    }
  };

  const handleReset = () => {
    setLocal(defaultPreferences);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agenda</CardTitle>
          <CardDescription>Cargando preferencias...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Preferencias de Agenda</CardTitle>
          <CardDescription>
            Configura qué ves en Agenda. Los cambios son persistentes por usuario.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Empleados visibles por defecto</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLocal((prev) => ({ ...prev, visibleEmployeeIds: [] }))}
              >
                Todos
              </Button>
              {employees.map((emp) => {
                const active = effectiveSelected.includes(emp.id);
                return (
                  <Button
                    key={emp.id}
                    size="sm"
                    variant={active ? 'default' : 'outline'}
                    onClick={() => toggleEmployee(emp.id)}
                  >
                    {emp.name}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Campos visibles en citas</Label>
            <div className="flex flex-wrap gap-2">
              {([
                ['clientName', 'Cliente'],
                ['service', 'Servicio'],
                ['description', 'Descripción'],
                ['timeRange', 'Rango horario'],
                ['status', 'Estado'],
                ['legacyCodes', 'Códigos legacy'],
              ] as [keyof typeof local.visibleFields, string][]).map(([key, label]) => (
                <Button
                  key={key}
                  size="sm"
                  variant={local.visibleFields[key] ? 'default' : 'outline'}
                  onClick={() => toggleField(key)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Duración del slot (minutos)</Label>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={local.slotMinutes === 15 ? 'default' : 'outline'}
                onClick={() => setLocal((prev) => ({ ...prev, slotMinutes: 15 }))}
              >
                15 min
              </Button>
              <Button
                size="sm"
                variant={local.slotMinutes === 30 ? 'default' : 'outline'}
                onClick={() => setLocal((prev) => ({ ...prev, slotMinutes: 30 }))}
              >
                30 min
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <Label>Altura de celda: {local.cellHeight}px</Label>
            <Slider
              value={[local.cellHeight]}
              min={24}
              max={64}
              step={2}
              onValueChange={(v) => setLocal((prev) => ({ ...prev, cellHeight: v[0] ?? prev.cellHeight }))}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Guardando...' : 'Guardar preferencias'}
            </Button>
            <Button variant="outline" onClick={handleReset} disabled={isSaving}>
              Restablecer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

