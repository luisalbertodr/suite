import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Plus, FileCheck, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { format } from 'date-fns';

interface Props {
  customerId: string;
}

export const ClienteDocumentacionTab: React.FC<Props> = ({ customerId }) => {
  const [showForm, setShowForm] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyFilter();

  const [form, setForm] = useState({ tipo: '', titulo: '', contenido: '' });

  const { data: consentimientos, isLoading } = useQuery({
    queryKey: ['consentimientos', customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('consentimientos')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('consentimientos').insert({
        customer_id: customerId,
        company_id: companyId!,
        ...form,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consentimientos', customerId] });
      setShowForm(false);
      setForm({ tipo: '', titulo: '', contenido: '' });
      toast({ title: 'Consentimiento creado' });
    },
    onError: () => toast({ title: 'Error', variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Consentimientos y Documentación</h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
          {showForm ? 'Cancelar' : 'Nuevo Consentimiento'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo *</Label>
                <Input value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} placeholder="Ej: Consentimiento Tratamiento" />
              </div>
              <div>
                <Label>Título *</Label>
                <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Contenido</Label>
              <Textarea value={form.contenido} onChange={(e) => setForm({ ...form, contenido: e.target.value })} rows={4} />
            </div>
            <Button onClick={() => createMutation.mutate()} disabled={!form.tipo || !form.titulo || createMutation.isPending}>
              Crear Consentimiento
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : !consentimientos?.length ? (
        <div className="text-center py-8 text-muted-foreground">No hay consentimientos</div>
      ) : (
        <div className="space-y-3">
          {consentimientos.map((c) => (
            <Card key={c.id}>
              <CardContent className="pt-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileCheck className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{c.titulo}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{c.tipo}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      c.firmado ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {c.firmado ? 'Firmado' : 'Pendiente'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(c.created_at), 'dd/MM/yyyy')}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
