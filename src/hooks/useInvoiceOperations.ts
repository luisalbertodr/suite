
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

export const useInvoiceOperations = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyFilter();

  const generateInvoiceNumber = async (
    isCorrectiveInvoice: boolean = false,
    overrideCompanyId?: string,
  ) => {
    const billingCompanyId = overrideCompanyId ?? companyId;
    if (!billingCompanyId) {
      console.error('No company ID available for invoice number generation');
      throw new Error('No company ID available');
    }

    const tryNewSignature = async () => {
      const { data, error } = await supabase.rpc('generate_invoice_number', {
        p_company_id: billingCompanyId,
        p_is_corrective: isCorrectiveInvoice,
      });
      if (error) throw error;
      return data as string;
    };

    const tryLegacySignature = async () => {
      const prefix = isCorrectiveInvoice ? 'R-FAC' : 'FAC';
      const { data, error } = await supabase.rpc('generate_invoice_number', {
        company_id: billingCompanyId,
        prefix,
      });
      if (error) throw error;
      return data as string;
    };

    try {
      return await tryNewSignature();
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      const isSignatureMismatch =
        err?.code === 'PGRST202' ||
        String(err?.message || '').includes('Could not find the function');

      if (!isSignatureMismatch) {
        console.error('Failed to generate invoice number:', error);
        throw error;
      }

      try {
        const legacyNumber = await tryLegacySignature();
        console.log('Generated invoice number (legacy RPC):', legacyNumber);
        return legacyNumber;
      } catch (legacyError) {
        console.error('Failed to generate invoice number:', legacyError);
        throw legacyError;
      }
    }
  };

  const createInvoice = useMutation({
    mutationFn: async (invoiceData: any) => {
      if (!companyId) {
        throw new Error('No company ID available');
      }

      console.log('Creating invoice with data:', { ...invoiceData, company_id: companyId });

      // Validate required fields
      if (!invoiceData.number || !invoiceData.customer_id) {
        throw new Error('Missing required fields: number or customer_id');
      }

      const { data, error } = await supabase
        .from('invoices')
        .insert({
          ...invoiceData,
          company_id: invoiceData.company_id ?? companyId,
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating invoice:', error);
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      toast({
        title: 'Factura creada',
        description: 'La factura ha sido creada correctamente.',
      });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (error: any) => {
      console.error('Invoice creation error:', error);
      let errorMessage = 'Ha ocurrido un error al crear la factura.';
      
      if (error.message?.includes('duplicate key value violates unique constraint')) {
        errorMessage = 'El número de factura ya existe para esta empresa. Por favor, genera un nuevo número.';
      } else if (error.message?.includes('already exists')) {
        errorMessage = error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: 'Error al crear factura',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  });

  return {
    generateInvoiceNumber,
    createInvoice
  };
};
