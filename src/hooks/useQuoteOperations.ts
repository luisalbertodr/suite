
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

export const useQuoteOperations = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { companyId } = useCompanyFilter();

  const generateQuoteNumber = async () => {
    try {
      const currentYear = new Date().getFullYear();
      const prefix = `PRES-${currentYear}`;
      
      console.log('=== QUOTE NUMBER GENERATION DEBUG ===');
      console.log('Company ID:', companyId);
      console.log('Prefix:', prefix);
      
      if (!companyId) {
        console.error('❌ No company ID available for quote number generation');
        return `${prefix}-000001`;
      }

      console.log('✅ Generating quote number for company:', companyId, 'with prefix:', prefix);
      
      // Generate number manually since generate_quote_number RPC doesn't exist
      const { data: existingQuotes, error: fetchError } = await supabase
        .from('quotes')
        .select('number')
        .eq('company_id', companyId)
        .like('number', `${prefix}-%`)
        .order('number', { ascending: false })
        .limit(1);

      if (fetchError) {
        console.error('❌ Error fetching existing quotes:', fetchError);
        const timestamp = Date.now().toString().slice(-6);
        return `${prefix}-${timestamp}`;
      }

      let nextNumber = 1;
      if (existingQuotes && existingQuotes.length > 0) {
        const lastNumber = existingQuotes[0].number;
        const match = lastNumber.match(/-(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1], 10) + 1;
        }
      }

      const newNumber = `${prefix}-${nextNumber.toString().padStart(6, '0')}`;
      console.log('✅ Generated quote number:', newNumber);
      return newNumber;
    } catch (error) {
      console.error('❌ Error in generateQuoteNumber:', error);
      const currentYear = new Date().getFullYear();
      const prefix = `PRES-${currentYear}`;
      const timestamp = Date.now().toString().slice(-6);
      return `${prefix}-${timestamp}`;
    }
  };

  const createQuote = useMutation({
    mutationFn: async (quoteData: any) => {
      console.log('=== CREATE QUOTE DEBUG ===');
      console.log('Company ID from hook:', companyId);
      console.log('Quote data received:', quoteData);
      
      if (!companyId) {
        console.error('❌ No company ID available for quote creation');
        throw new Error('No company ID available');
      }

      console.log('✅ Creating quote with company ID:', companyId);

      const finalQuoteData = {
        ...quoteData,
        company_id: companyId,
      };

      console.log('Final quote data to insert:', finalQuoteData);

      const { data, error } = await supabase
        .from('quotes')
        .insert(finalQuoteData)
        .select()
        .single();

      console.log('Insert result:', { data, error });

      if (error) {
        console.error('❌ Error creating quote:', error);
        throw error;
      }
      
      console.log('✅ Quote created successfully:', data);
      return data;
    },
    onSuccess: (data) => {
      console.log('✅ Quote creation mutation succeeded:', data);
      toast({
        title: 'Presupuesto creado',
        description: 'El presupuesto ha sido creado correctamente.',
      });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
    onError: (error: any) => {
      console.error('❌ Quote creation error:', error);
      toast({
        title: 'Error al crear presupuesto',
        description: error.message || 'Ha ocurrido un error al crear el presupuesto.',
        variant: 'destructive',
      });
    }
  });

  const updateQuote = useMutation({
    mutationFn: async ({ id, quoteData }: { id: string; quoteData: any }) => {
      console.log('=== UPDATE QUOTE DEBUG ===');
      console.log('Updating quote ID:', id);
      console.log('Update data:', quoteData);
      
      const { data, error } = await supabase
        .from('quotes')
        .update({
          ...quoteData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating quote:', error);
        throw error;
      }
      
      console.log('✅ Quote updated successfully:', data);
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: 'Presupuesto actualizado',
        description: 'El presupuesto ha sido actualizado correctamente.',
      });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
    },
    onError: (error: any) => {
      console.error('❌ Quote update error:', error);
      toast({
        title: 'Error al actualizar presupuesto',
        description: error.message || 'Ha ocurrido un error al actualizar el presupuesto.',
        variant: 'destructive',
      });
    }
  });

  return {
    generateQuoteNumber,
    createQuote,
    updateQuote,
  };
};
