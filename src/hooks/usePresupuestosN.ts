import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface PresupuestoN {
  id: string;
  company_id?: string;
  customer_id: string;
  number: string;
  issue_date: string;
  accepted_date?: string;
  status: 'borrador' | 'enviado' | 'aceptado' | 'facturado';
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  customer?: {
    id: string;
    name: string;
    email?: string;
    tax_id?: string;
  };
}

export interface PresupuestoNItem {
  id: string;
  presupuesto_n_id: string;
  article_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at: string;
}

export const usePresupuestosN = () => {
  const [presupuestosN, setPresupuestosN] = useState<PresupuestoN[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const fetchPresupuestosN = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('presupuestos_n')
        .select(`
          *,
          customer:customers(id, name, email, tax_id)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPresupuestosN((data || []) as PresupuestoN[]);
    } catch (error: any) {
      console.error('Error fetching presupuestos N:', error);
      toast({
        title: "Error",
        description: "Error al cargar los presupuestos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deletePresupuestoN = async (id: string) => {
    try {
      const { error } = await supabase
        .from('presupuestos_n')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setPresupuestosN(prev => prev.filter(p => p.id !== id));
      toast({
        title: "Éxito",
        description: "Presupuesto eliminado correctamente",
      });
    } catch (error: any) {
      console.error('Error deleting presupuesto N:', error);
      toast({
        title: "Error",
        description: "Error al eliminar el presupuesto",
        variant: "destructive",
      });
    }
  };

  const updateStatus = async (id: string, status: PresupuestoN['status']) => {
    try {
      const { error } = await supabase
        .from('presupuestos_n')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      await fetchPresupuestosN();
      toast({
        title: "Éxito",
        description: "Estado actualizado correctamente",
      });
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast({
        title: "Error",
        description: "Error al actualizar el estado",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchPresupuestosN();
  }, [user]);

  return {
    presupuestosN,
    loading,
    fetchPresupuestosN,
    deletePresupuestoN,
    updateStatus
  };
};