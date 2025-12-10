import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { PresupuestoN, PresupuestoNItem } from './usePresupuestosN';

export interface PresupuestoNFormData {
  customer_id: string;
  issue_date: string;
  status: PresupuestoN['status'];
  notes?: string;
}

export const usePresupuestoNOperations = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { companyId } = useCompanyFilter();

  const createPresupuestoN = async (formData: PresupuestoNFormData, items: Omit<PresupuestoNItem, 'id' | 'presupuesto_n_id' | 'created_at'>[]) => {
    if (!companyId) throw new Error('No company ID available');
    
    try {
      setLoading(true);

      // Generate the presupuesto number
      const { data: numberData, error: numberError } = await supabase
        .rpc('generate_presupuesto_n_number', { company_id: companyId });

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
          status: formData.status,
          subtotal,
          tax_amount,
          total_amount,
          notes: formData.notes
        })
        .select()
        .single();

      if (presupuestoError) throw presupuestoError;

      // Create articles if they don't exist and prepare items
      const itemsToInsert = [];
      for (const item of items) {
        let article_id = item.article_id;

        // If no article_id, create a new article
        if (!article_id && item.description) {
          const { data: existingArticle } = await supabase
            .from('articles')
            .select('id')
            .eq('descripcion', item.description)
            .eq('company_id', companyId)
            .single();

          if (existingArticle) {
            article_id = existingArticle.id;
          } else {
            const { data: newArticle, error: articleError } = await supabase
              .from('articles')
              .insert({
                company_id: companyId,
                codigo: `ART-${Date.now()}`,
                descripcion: item.description,
                precio: item.unit_price,
                familia: 'General',
                estado: 'activo',
                tipo_producto: 'standard'
              })
              .select()
              .single();

            if (articleError) throw articleError;
            article_id = newArticle.id;
          }
        }

        itemsToInsert.push({
          presupuesto_n_id: presupuesto.id,
          article_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price
        });
      }

      // Insert items
      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from('presupuestos_n_items')
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

  const updatePresupuestoN = async (id: string, formData: PresupuestoNFormData, items: Omit<PresupuestoNItem, 'id' | 'presupuesto_n_id' | 'created_at'>[]) => {
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
          status: formData.status,
          subtotal,
          tax_amount,
          total_amount,
          notes: formData.notes
        })
        .eq('id', id);

      if (presupuestoError) throw presupuestoError;

      // Delete existing items
      const { error: deleteError } = await supabase
        .from('presupuestos_n_items')
        .delete()
        .eq('presupuesto_n_id', id);

      if (deleteError) throw deleteError;

      // Create articles if they don't exist and prepare items
      const itemsToInsert = [];
      for (const item of items) {
        let article_id = item.article_id;

        // If no article_id, create a new article
        if (!article_id && item.description) {
          const { data: existingArticle } = await supabase
            .from('articles')
            .select('id')
            .eq('descripcion', item.description)
            .eq('company_id', companyId)
            .single();

          if (existingArticle) {
            article_id = existingArticle.id;
          } else {
            const { data: newArticle, error: articleError } = await supabase
              .from('articles')
              .insert({
                company_id: companyId,
                codigo: `ART-${Date.now()}`,
                descripcion: item.description,
                precio: item.unit_price,
                familia: 'General',
                estado: 'activo',
                tipo_producto: 'standard'
              })
              .select()
              .single();

            if (articleError) throw articleError;
            article_id = newArticle.id;
          }
        }

        itemsToInsert.push({
          presupuesto_n_id: id,
          article_id,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price: item.total_price
        });
      }

      // Insert updated items
      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase
          .from('presupuestos_n_items')
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