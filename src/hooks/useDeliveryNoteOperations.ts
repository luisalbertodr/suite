
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useCallback } from 'react';

interface DeliveryNoteItem {
  id?: string;
  article_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface DeliveryNote {
  id?: string;
  number: string;
  supplier_id?: string;
  customer_id?: string;
  issue_date: string;
  delivery_date: string | null;
  status: string;
  notes: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
}

export const useDeliveryNoteOperations = (onClose: () => void, isExit: boolean = false) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { companyId, loading: companyLoading } = useCompanyFilter();

  console.log('=== useDeliveryNoteOperations ===');
  console.log('Company ID:', companyId);
  console.log('Company Loading:', companyLoading);
  console.log('Is Exit:', isExit);

  // Fetch suppliers
  const { data: suppliers = [], isLoading: suppliersLoading } = useQuery({
    queryKey: ['suppliers', companyId],
    queryFn: async () => {
      if (!companyId) {
        console.log('No companyId for suppliers query');
        return [];
      }

      console.log('Fetching suppliers for company:', companyId);
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('company_id', companyId)
        .order('name');
      
      if (error) {
        console.error('Error fetching suppliers:', error);
        throw error;
      }
      console.log('Suppliers fetched:', data?.length || 0);
      return data || [];
    },
    enabled: !!companyId && !companyLoading,
  });

  // Fetch customers for exit delivery notes
  const { data: customers = [], isLoading: customersLoading } = useQuery({
    queryKey: ['customers', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .eq('company_id', companyId)
        .order('name');
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId && !companyLoading && isExit,
  });

  // Fetch articles
  const { data: articles = [], isLoading: articlesLoading } = useQuery({
    queryKey: ['articles', companyId],
    queryFn: async () => {
      if (!companyId) {
        console.log('No companyId for articles query');
        return [];
      }

      console.log('Fetching articles for company:', companyId);
      const { data, error } = await supabase
        .from('articles')
        .select('id, codigo, descripcion, precio_compra, precio, stock_actual')
        .eq('company_id', companyId)
        .eq('estado', 'activo')
        .order('descripcion');
      
      if (error) {
        console.error('Error fetching articles:', error);
        throw error;
      }
      console.log('Articles fetched:', data?.length || 0);
      return data || [];
    },
    enabled: !!companyId && !companyLoading,
  });

  const generateDeliveryNoteNumber = useCallback(async () => {
    console.log('=== generateDeliveryNoteNumber START ===');
    
    if (!companyId) {
      console.error('❌ No company ID available for number generation');
      throw new Error('No se pudo obtener la información de la empresa');
    }

    try {
      const currentYear = new Date().getFullYear();
      const prefix = isExit ? `ALS-${currentYear}` : `ALE-${currentYear}`;
      
      console.log('🔄 Generating delivery note number...');
      console.log('Company ID:', companyId);
      console.log('Prefix:', prefix);
      console.log('Year:', currentYear);
      
      // Use RPC function first
      console.log('🔄 Calling RPC function...');
      const { data: rpcResult, error: rpcError } = await supabase.rpc('generate_delivery_note_number', {
        company_id: companyId,
        prefix: prefix
      });

      console.log('RPC Result:', rpcResult);
      console.log('RPC Error:', rpcError);
      
      if (rpcError) {
        console.error('❌ RPC Error:', rpcError);
        throw rpcError;
      }
      
      if (rpcResult && typeof rpcResult === 'string') {
        console.log('✅ Generated number:', rpcResult);
        return rpcResult;
      }
      
      console.error('❌ RPC returned invalid result:', rpcResult);
      throw new Error('La función de generación no devolvió un número válido');
      
    } catch (error) {
      console.error('❌ Error in generateDeliveryNoteNumber:', error);
      throw error;
    }
  }, [companyId, isExit]);

  const loadItems = useCallback(async (deliveryNoteId: string) => {
    try {
      const { data, error } = await supabase
        .from('delivery_note_items')
        .select('*')
        .eq('delivery_note_id', deliveryNoteId);
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error loading items:', error);
      return [];
    }
  }, []);

  const updateArticleStock = useCallback(async (articleId: string, quantityReceived: number, newPurchasePrice: number) => {
    try {
      const { data: currentArticle, error: fetchError } = await supabase
        .from('articles')
        .select('stock_actual, precio_compra')
        .eq('id', articleId)
        .single();

      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from('articles')
        .update({
          stock_actual: currentArticle.stock_actual + quantityReceived,
          precio_compra: newPurchasePrice,
          updated_at: new Date().toISOString()
        })
        .eq('id', articleId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating stock:', error);
      throw error;
    }
  }, []);

  const saveMutation = useMutation({
    mutationFn: async (data: { deliveryNote: DeliveryNote; items: DeliveryNoteItem[]; deliveryNoteId?: string }) => {
      if (!companyId) throw new Error('No company ID available');
      
      console.log('=== SAVE MUTATION START ===');
      console.log('Company ID:', companyId);
      console.log('Is Exit:', isExit);
      console.log('Delivery Note Data:', data.deliveryNote);
      console.log('Items:', data.items);
      
      // Validate required fields
      if (isExit && !data.deliveryNote.customer_id) {
        throw new Error('Debe seleccionar un cliente para el albarán de salida');
      }
      if (!isExit && !data.deliveryNote.supplier_id) {
        throw new Error('Debe seleccionar un proveedor para el albarán de entrada');
      }
      
      // Validate delivery note number
      if (!data.deliveryNote.number || data.deliveryNote.number.trim() === '') {
        console.error('Invalid delivery note number:', data.deliveryNote.number);
        throw new Error('Número de albarán inválido o vacío');
      }
      
      // Check if number follows expected format for new entries
      if (!data.deliveryNoteId) {
        const currentYear = new Date().getFullYear();
        const expectedPrefix = isExit ? `ALS-${currentYear}` : `ALE-${currentYear}`;
        if (!data.deliveryNote.number.startsWith(expectedPrefix)) {
          console.error('Number format mismatch:', {
            received: data.deliveryNote.number,
            expected: expectedPrefix
          });
          throw new Error(`El número de albarán debe comenzar con ${expectedPrefix}`);
        }
      }
      
      const cleanedDeliveryNote = {
        number: data.deliveryNote.number,
        supplier_id: isExit ? null : data.deliveryNote.supplier_id,
        customer_id: isExit ? data.deliveryNote.customer_id : null,
        company_id: companyId,
        issue_date: data.deliveryNote.issue_date,
        delivery_date: data.deliveryNote.delivery_date,
        status: data.deliveryNote.status,
        notes: data.deliveryNote.notes,
        subtotal: data.deliveryNote.subtotal,
        tax_amount: data.deliveryNote.tax_amount,
        total_amount: data.deliveryNote.total_amount,
      };
      
      console.log('Cleaned delivery note:', cleanedDeliveryNote);
      
      try {
        if (data.deliveryNoteId) {
          // Update existing delivery note
          console.log('Updating existing delivery note...');
          const { error: noteError } = await supabase
            .from('delivery_notes')
            .update(cleanedDeliveryNote)
            .eq('id', data.deliveryNoteId);

          if (noteError) {
            console.error('Error updating delivery note:', noteError);
            throw noteError;
          }

          // Delete existing items and insert new ones
          const { error: deleteError } = await supabase
            .from('delivery_note_items')
            .delete()
            .eq('delivery_note_id', data.deliveryNoteId);

          if (deleteError) {
            console.error('Error deleting existing items:', deleteError);
            throw deleteError;
          }

          if (data.items.length > 0) {
            const itemsToInsert = data.items.map(item => ({
              delivery_note_id: data.deliveryNoteId,
              article_id: item.article_id || null,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.total_price,
            }));

            const { error: itemsError } = await supabase
              .from('delivery_note_items')
              .insert(itemsToInsert);

            if (itemsError) {
              console.error('Error inserting updated items:', itemsError);
              throw itemsError;
            }
          }

          // Update article stock when status is delivered (only for entry notes)
          if (!isExit && data.deliveryNote.status === 'delivered') {
            for (const item of data.items) {
              if (item.article_id) {
                await updateArticleStock(item.article_id, item.quantity, item.unit_price);
              }
            }
          }

          console.log('Successfully updated delivery note');
          return data.deliveryNoteId;
        } else {
          // Create new delivery note
          console.log('Creating new delivery note...');
          const { data: newNote, error: noteError } = await supabase
            .from('delivery_notes')
            .insert([cleanedDeliveryNote])
            .select()
            .single();

          console.log('Insert result:', { newNote, noteError });

          if (noteError) {
            console.error('Error creating delivery note:', noteError);
            if (noteError.code === '23505' && noteError.message.includes('delivery_notes_number_company_unique')) {
              throw new Error(`El número de albarán ${data.deliveryNote.number} ya existe para esta empresa. Por favor, genere un nuevo número.`);
            }
            throw noteError;
          }

          if (!newNote) {
            console.error('No delivery note returned after insert');
            throw new Error('No se pudo crear el albarán');
          }

          if (data.items.length > 0) {
            const itemsToInsert = data.items.map(item => ({
              delivery_note_id: newNote.id,
              article_id: item.article_id || null,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.total_price,
            }));

            console.log('Inserting items:', itemsToInsert);

            const { error: itemsError } = await supabase
              .from('delivery_note_items')
              .insert(itemsToInsert);

            if (itemsError) {
              console.error('Items insert error:', itemsError);
              throw itemsError;
            }
          }

          // Update article stock when status is delivered (only for entry notes)
          if (!isExit && data.deliveryNote.status === 'delivered') {
            for (const item of data.items) {
              if (item.article_id) {
                await updateArticleStock(item.article_id, item.quantity, item.unit_price);
              }
            }
          }

          console.log('=== SAVE MUTATION SUCCESS ===');
          return newNote.id;
        }
      } catch (error) {
        console.error('Save operation failed:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delivery-notes-entrada'] });
      queryClient.invalidateQueries({ queryKey: ['dispatch-notes'] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      
      toast({
        title: "Albarán guardado",
        description: "El albarán ha sido guardado correctamente."
      });
      
      onClose();
    },
    onError: (error: any) => {
      console.error('Save error:', error);
      
      let errorMessage = 'Ha ocurrido un error al guardar el albarán.';
      
      if (error.message) {
        if (error.message.includes('número de albarán') && error.message.includes('ya existe')) {
          errorMessage = error.message;
        } else if (error.message.includes('duplicate key value violates unique constraint')) {
          errorMessage = 'El número de albarán ya existe para esta empresa. Por favor, genere un nuevo número.';
        } else if (error.message.includes('cliente') || error.message.includes('proveedor')) {
          errorMessage = error.message;
        } else if (error.message.includes('Número de albarán inválido') || error.message.includes('debe comenzar con')) {
          errorMessage = error.message;
        } else {
          errorMessage = `Error: ${error.message}`;
        }
      }
      
      toast({
        title: "Error al guardar",
        description: errorMessage,
        variant: "destructive"
      });
    }
  });

  return {
    suppliers: suppliers || [],
    customers: customers || [],
    articles: articles || [],
    generateDeliveryNoteNumber,
    loadItems,
    saveMutation,
    isLoading: suppliersLoading || articlesLoading || (isExit ? customersLoading : false) || companyLoading
  };
};
