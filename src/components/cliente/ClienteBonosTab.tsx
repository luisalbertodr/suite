import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Plus, Gift, X, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { format } from 'date-fns';

interface Props {
  customerId: string;
}

export const ClienteBonosTab: React.FC<Props> = ({ customerId }) => {
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyFilter();

  const [form, setForm] = useState({ nombre: '', descripcion: '', precio_total: 0, sesiones_totales: 1, fecha_vencimiento: '' });

  const { data: bonos, isLoading } = useQuery({
    queryKey: ['bonos', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bonos')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('bonos').insert({
        customer_id: customerId,
        company_id: companyId!,
        ...form,
        fecha_vencimiento: form.fecha_vencimiento || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bonos', customerId] });
      setShowForm(false);
      setForm({ nombre: '', descripcion: '', precio_total: 0, sesiones_totales: 1, fecha_vencimiento: '' });
      toast({ title: 'Bono creado' });
    },
    onError: () => toast({ title: 'Error', variant: 'destructive' }),
  });

  const usarSesionMutation = useMutation({
    mutationFn: async (bonoId: string) => {
      const bono = bonos?.find(b => b.id === bonoId);
      if (!bono || bono.sesiones_usadas >= bono.sesiones_totales) throw new Error('Sin sesiones disponibles');

      const { error: usoError } = await supabase.from('bono_uso').insert({ bono_id: bonoId });
      if (usoError) throw usoError;

      const { error: updateError } = await supabase.from('bonos').update({
        sesiones_usadas: bono.sesiones_usadas + 1,
        estado: bono.sesiones_usadas + 1 >= bono.sesiones_totales ? 'completado' : 'activo',
      }).eq('id', bonoId);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bonos', customerId] });
      toast({ title: 'Sesión registrada' });
    },
    onError: (e) => toast({ title: (e as Error).message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Bonos y Sesiones</h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
          {showForm ? 'Cancelar' : 'Nuevo Bono'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombre *</Label>
                <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Bono 10 sesiones" />
              </div>
              <div>
                <Label>Precio Total (€)</Label>
                <Input type="number" value={form.precio_total} onChange={(e) => setForm({ ...form, precio_total: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Sesiones Totales</Label>
                <Input type="number" min="1" value={form.sesiones_totales} onChange={(e) => setForm({ ...form, sesiones_totales: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Fecha Vencimiento</Label>
                <Input type="date" value={form.fecha_vencimiento} onChange={(e) => setForm({ ...form, fecha_vencimiento: e.target.value })} />
              </div>
            </div>
            <Button onClick={() => createMutation.mutate()} disabled={!form.nombre || createMutation.isPending}>
              Crear Bono
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : !bonos?.length ? (
        <div className="text-center py-8 text-muted-foreground">No hay bonos</div>
      ) : (
        <div className="space-y-3">
          {bonos.map((bono) => {
            const progress = (bono.sesiones_usadas / bono.sesiones_totales) * 100;
            const isComplete = bono.estado === 'completado';
            return (
              <Card key={bono.id} className={isComplete ? 'opacity-60' : ''}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Gift className="w-4 h-4 text-primary" />
                      <span className="font-medium">{bono.nombre}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        isComplete ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'
                      }`}>
                        {isComplete ? 'Completado' : 'Activo'}
                      </span>
                    </div>
                    <span className="font-semibold">{bono.precio_total.toFixed(2)} €</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={progress} className="flex-1" />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {bono.sesiones_usadas}/{bono.sesiones_totales}
                    </span>
                    {!isComplete && (
                      <Button size="sm" variant="outline" onClick={() => usarSesionMutation.mutate(bono.id)} disabled={usarSesionMutation.isPending}>
                        <Play className="w-3 h-3 mr-1" /> Usar
                      </Button>
                    )}
                  </div>
                  {bono.fecha_vencimiento && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Vence: {format(new Date(bono.fecha_vencimiento), 'dd/MM/yyyy')}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
