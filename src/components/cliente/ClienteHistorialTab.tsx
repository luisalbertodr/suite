import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Plus, FileText, Calendar, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { format } from 'date-fns';

interface Props {
  customerId: string;
}

export const ClienteHistorialTab: React.FC<Props> = ({ customerId }) => {
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyFilter();

  const [form, setForm] = useState({
    tipo: 'consulta',
    titulo: '',
    descripcion: '',
    tratamiento: '',
    observaciones: '',
  });

  const { data: registros, isLoading } = useQuery({
    queryKey: ['historial_clinico', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('historial_clinico')
        .select('*')
        .eq('customer_id', customerId)
        .order('fecha', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('historial_clinico').insert({
        customer_id: customerId,
        company_id: companyId!,
        ...form,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['historial_clinico', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer_day_timeline', customerId] });
      setShowForm(false);
      setForm({ tipo: 'consulta', titulo: '', descripcion: '', tratamiento: '', observaciones: '' });
      toast({ title: 'Registro creado' });
    },
    onError: () => toast({ title: 'Error al crear registro', variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Historial Clínico</h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
          {showForm ? 'Cancelar' : 'Nuevo Registro'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consulta">Consulta</SelectItem>
                    <SelectItem value="tratamiento">Tratamiento</SelectItem>
                    <SelectItem value="revision">Revisión</SelectItem>
                    <SelectItem value="nota">Nota</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Título *</Label>
                <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Descripción</Label>
              <Textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} rows={3} />
            </div>
            <div>
              <Label>Tratamiento</Label>
              <Textarea value={form.tratamiento} onChange={(e) => setForm({ ...form, tratamiento: e.target.value })} rows={2} />
            </div>
            <div>
              <Label>Observaciones</Label>
              <Textarea value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} rows={2} />
            </div>
            <Button onClick={() => createMutation.mutate()} disabled={!form.titulo || createMutation.isPending}>
              Guardar Registro
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : registros?.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">No hay registros clínicos</div>
      ) : (
        <div className="space-y-3">
          {registros?.map((r) => (
            <Card key={r.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{r.titulo}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{r.tipo}</span>
                  </div>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(r.fecha), 'dd/MM/yyyy')}
                  </span>
                </div>
                {r.descripcion && <p className="text-sm text-muted-foreground mt-2">{r.descripcion}</p>}
                {r.tratamiento && <p className="text-sm mt-1"><span className="font-medium">Tratamiento:</span> {r.tratamiento}</p>}
                {r.observaciones && <p className="text-sm mt-1 text-muted-foreground italic">{r.observaciones}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
