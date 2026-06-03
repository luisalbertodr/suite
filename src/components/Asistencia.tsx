import React, { useState } from 'react';
import { MapPin, Clock, LogIn, LogOut, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useAgendaEmployees } from '@/hooks/useAgendaEmployees';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRegisterTopBarContent } from '@/components/TopBarContentContext';

const getLocation = (): Promise<{ lat: number; lng: number }> =>
  new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('No GPS'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

export const Asistencia: React.FC = () => {
  const { companyId } = useCompanyFilter();
  const { employees } = useAgendaEmployees();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [gettingLocation, setGettingLocation] = useState(false);
  const today = format(new Date(), 'yyyy-MM-dd');

  useRegisterTopBarContent(
    {
      title: (
        <span className="inline-flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-500" />
          Fichaje y Asistencia
        </span>
      ),
      actions: (
        <span className="text-xs text-muted-foreground tabular-nums">
          {format(new Date(), "EEEE, d 'de' MMMM yyyy", { locale: es })}
        </span>
      ),
    },
    [],
  );

  const { data: records, isLoading } = useQuery({
    queryKey: ['attendance', companyId, today],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await (supabase as any)
        .from('attendance_records')
        .select('*, agenda_employees(name)')
        .eq('company_id', companyId)
        .eq('date', today)
        .order('check_in', { ascending: false });
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id as string,
        employee_id: r.employee_id as string,
        check_in: r.check_in as string,
        check_out: r.check_out as string | null,
        check_in_lat: r.check_in_lat as number | null,
        check_in_lng: r.check_in_lng as number | null,
        employee_name: r.agenda_employees?.name || 'Desconocido',
      }));
    },
    enabled: !!companyId,
  });

  const checkInMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !selectedEmployee) throw new Error('Selecciona un empleado');
      setGettingLocation(true);
      let loc: { lat: number; lng: number } | null = null;
      try { loc = await getLocation(); } catch { /* continue */ }
      setGettingLocation(false);

      const { error } = await (supabase as any).from('attendance_records').insert({
        company_id: companyId,
        employee_id: selectedEmployee,
        date: today,
        check_in: new Date().toISOString(),
        check_in_lat: loc?.lat || null,
        check_in_lng: loc?.lng || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast({ title: 'Entrada registrada ✓' });
    },
    onError: (e: any) => {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: async (recordId: string) => {
      setGettingLocation(true);
      let loc: { lat: number; lng: number } | null = null;
      try { loc = await getLocation(); } catch { /* continue */ }
      setGettingLocation(false);

      const { error } = await (supabase as any)
        .from('attendance_records')
        .update({
          check_out: new Date().toISOString(),
          check_out_lat: loc?.lat || null,
          check_out_lng: loc?.lng || null,
        })
        .eq('id', recordId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast({ title: 'Salida registrada ✓' });
    },
    onError: (e: any) => {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });

  const openRecord = records?.find(
    (r) => r.employee_id === selectedEmployee && !r.check_out
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Registrar Fichaje</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona empleado..." />
            </SelectTrigger>
            <SelectContent>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-3">
            {openRecord ? (
              <Button
                className="flex-1"
                variant="destructive"
                disabled={checkOutMutation.isPending || gettingLocation}
                onClick={() => checkOutMutation.mutate(openRecord.id)}
              >
                {checkOutMutation.isPending || gettingLocation
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <LogOut className="w-4 h-4 mr-2" />}
                Fichar Salida
              </Button>
            ) : (
              <Button
                className="flex-1"
                disabled={!selectedEmployee || checkInMutation.isPending || gettingLocation}
                onClick={() => checkInMutation.mutate()}
              >
                {checkInMutation.isPending || gettingLocation
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <LogIn className="w-4 h-4 mr-2" />}
                Fichar Entrada
              </Button>
            )}
          </div>

          {gettingLocation && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3 h-3 animate-pulse" /> Obteniendo ubicación GPS...
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4" /> Registros de Hoy
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!records?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Sin fichajes registrados hoy</p>
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((record) => (
                <div key={record.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">
                        {record.employee_name?.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{record.employee_name}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <LogIn className="w-3 h-3 text-emerald-500" />
                          {format(new Date(record.check_in), 'HH:mm')}
                        </span>
                        {record.check_out && (
                          <span className="flex items-center gap-1">
                            <LogOut className="w-3 h-3 text-destructive" />
                            {format(new Date(record.check_out), 'HH:mm')}
                          </span>
                        )}
                        {record.check_in_lat && <MapPin className="w-3 h-3 text-emerald-500" />}
                      </div>
                    </div>
                  </div>
                  <Badge variant={record.check_out ? 'secondary' : 'default'}>
                    {record.check_out ? 'Completado' : 'Trabajando'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
