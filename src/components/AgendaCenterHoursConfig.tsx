import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Json } from '@/integrations/supabase/types';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useToast } from '@/hooks/use-toast';
import {
  type AgendaDayHoursMap,
  type AgendaTimeSegment,
  DEFAULT_AGENDA_CENTER_HOURS,
  parseAgendaDayHoursMap,
} from '@/lib/agendaHours';

const DAY_ROWS: { key: string; label: string }[] = [
  { key: '0', label: 'Domingo' },
  { key: '1', label: 'Lunes' },
  { key: '2', label: 'Martes' },
  { key: '3', label: 'Miércoles' },
  { key: '4', label: 'Jueves' },
  { key: '5', label: 'Viernes' },
  { key: '6', label: 'Sábado' },
];

function firstSeg(day: AgendaTimeSegment[] | undefined): { open: string; close: string } {
  const s = day?.[0];
  return { open: s?.open ?? '10:00', close: s?.close ?? '20:30' };
}

export const AgendaCenterHoursConfig: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId, loading: companyLoading } = useCompanyFilter();
  const [local, setLocal] = useState<AgendaDayHoursMap>({ ...DEFAULT_AGENDA_CENTER_HOURS });

  const { data, isLoading } = useQuery({
    queryKey: ['company-agenda-center-hours', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data: row, error } = await supabase
        .from('companies')
        .select('agenda_center_hours')
        .eq('id', companyId)
        .single();
      if (error) throw error;
      return row;
    },
    enabled: !!companyId && !companyLoading,
  });

  useEffect(() => {
    setLocal(parseAgendaDayHoursMap(data?.agenda_center_hours));
  }, [data?.agenda_center_hours]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error('Sin empresa');
      const { error } = await supabase
        .from('companies')
        .update({ agenda_center_hours: local as unknown as Json })
        .eq('id', companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-agenda-center-hours'] });
      queryClient.invalidateQueries({ queryKey: ['company'] });
      toast({ title: 'Horario del centro guardado' });
    },
    onError: (e: Error) => {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });

  if (!companyId || companyLoading) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Horario del centro (agenda)</CardTitle>
        <CardDescription>
          Tramos abiertos por día. Día cerrado = sin tramos. Los huecos fuera de horario aparecen sombreados en la
          agenda.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <div className="space-y-3">
            {DAY_ROWS.map(({ key, label }) => {
              const segs = local[key] ?? [];
              const closed = segs.length === 0;
              const { open, close } = firstSeg(segs);
              return (
                <div key={key} className="flex flex-wrap items-end gap-3 border-b pb-3">
                  <div className="w-28 text-sm font-medium">{label}</div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`c-${key}-closed`}
                      checked={closed}
                      onCheckedChange={(v) => {
                        const on = v === true;
                        setLocal((prev) => ({
                          ...prev,
                          [key]: on ? [] : [{ open: '10:00', close: '20:30' }],
                        }));
                      }}
                    />
                    <Label htmlFor={`c-${key}-closed`} className="text-xs font-normal cursor-pointer">
                      Cerrado
                    </Label>
                  </div>
                  {!closed && (
                    <div className="flex flex-wrap items-center gap-2">
                      <div>
                        <Label className="text-xs">Apertura</Label>
                        <Input
                          type="time"
                          className="h-8 w-32"
                          value={open}
                          onChange={(e) =>
                            setLocal((prev) => ({
                              ...prev,
                              [key]: [{ open: e.target.value, close }],
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Cierre</Label>
                        <Input
                          type="time"
                          className="h-8 w-32"
                          step={300}
                          value={close}
                          onChange={(e) =>
                            setLocal((prev) => ({
                              ...prev,
                              [key]: [{ open, close: e.target.value }],
                            }))
                          }
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isLoading}>
          {saveMutation.isPending ? 'Guardando…' : 'Guardar horario del centro'}
        </Button>
      </CardContent>
    </Card>
  );
};
