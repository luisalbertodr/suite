
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { PresupuestoN, PresupuestoNItem } from './usePresupuestosN';

export interface PresupuestoNFormData {
  customer_id: string;
  issue_date: string;
  valid_until: string;
  status: PresupuestoN['status'];
  notes?: string;
  terms?: string;
}

export const usePresupuestoNOperations = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { companyId } = useCompanyFilter();

  const createPresupuestoN = async (formData: PresupuestoNFormData, items: Omit<PresupuestoNItem, 'id' | 'presupuesto_id' | 'created_at'>[]) => {
    if (!companyId) throw new Error('No company ID available');
    
    try {
      setLoading(true);

      // Generate the presupuesto number using correct parameter name
      const { data: numberData, error: numberError } = await supabase
        .rpc('generate_presupuesto_n_number', { p_company_id: companyId });

      if (numberError) throw numberError;

      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
      const tax_amount = subtotal * 0.21;
      const total_amount = subtotal + tax_amount;

      // Create the presupuesto
      const { data: presupuesto, error: presupuestoError } = await supabase
        .from('presupuestos_n')
        .insert({
          company_id: companyId,
          customer_id: formData.customer_id,
          number: numberData,
          issue_date: formData.issue_date,
          valid_until: formData.valid_until,
          status: formData.status === 'borrador' ? 'draft' : formData.status,
          subtotal,
          tax_amount,
          total_amount,
          notes: formData.notes,
          terms: formData.terms
        })
        .select()
        .single();

      if (presupuestoError) throw presupuestoError;

      // Create items
      if (items.length > 0) {
        const itemsToInsert = items.map((item, index) => ({
          presupuesto_id: presupuesto.id,
          article_id: item.article_id || null,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent || 0,
          tax_percent: item.tax_percent || 21,
          total_price: item.total_price,
          sort_order: index
        }));

        const { error: itemsError } = await supabase
          .from('presupuesto_n_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      toast({
        title: "Éxito",
        description: "Presupuesto creado correctamente",
      });

      return presupuesto;
    } catch (error: any) {
      console.error('Error creating presupuesto N:', error);
      toast({
        title: "Error",
        description: error.message || "Error al crear el presupuesto",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updatePresupuestoN = async (id: string, formData: PresupuestoNFormData, items: Omit<PresupuestoNItem, 'id' | 'presupuesto_id' | 'created_at'>[]) => {
    try {
      setLoading(true);

      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + item.total_price, 0);
      const tax_amount = subtotal * 0.21;
      const total_amount = subtotal + tax_amount;

      // Update the presupuesto
      const { error: presupuestoError } = await supabase
        .from('presupuestos_n')
        .update({
          customer_id: formData.customer_id,
          issue_date: formData.issue_date,
          valid_until: formData.valid_until,
          status: formData.status === 'borrador' ? 'draft' : formData.status,
          subtotal,
          tax_amount,
          total_amount,
          notes: formData.notes,
          terms: formData.terms
        })
        .eq('id', id);

      if (presupuestoError) throw presupuestoError;

      // Delete existing items
      const { error: deleteError } = await supabase
        .from('presupuesto_n_items')
        .delete()
        .eq('presupuesto_id', id);

      if (deleteError) throw deleteError;

      // Insert updated items
      if (items.length > 0) {
        const itemsToInsert = items.map((item, index) => ({
          presupuesto_id: id,
          article_id: item.article_id || null,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_percent: item.discount_percent || 0,
          tax_percent: item.tax_percent || 21,
          total_price: item.total_price,
          sort_order: index
        }));

        const { error: itemsError } = await supabase
          .from('presupuesto_n_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;
      }

      toast({
        title: "Éxito",
        description: "Presupuesto actualizado correctamente",
      });

    } catch (error: any) {
      console.error('Error updating presupuesto N:', error);
      toast({
        title: "Error",
        description: error.message || "Error al actualizar el presupuesto",
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    createPresupuestoN,
    updatePresupuestoN,
    loading
  };
};
