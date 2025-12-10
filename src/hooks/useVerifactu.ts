
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useVerifactuXML } from '@/hooks/useVerifactuXML';

export const useVerifactu = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { companyId } = useCompanyFilter();
  const { storeXMLDocument } = useVerifactuXML();

  // Validate invoice data before sending
  const validateInvoiceData = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data, error } = await supabase.rpc('validate_verifactu_invoice_data', {
        p_invoice_id: invoiceId
      });

      if (error) throw error;
      return data;
    },
  });

  const sendToVerifactu = useMutation({
    mutationFn: async (invoiceId: string) => {
      console.log('Sending invoice to Verifactu:', invoiceId);
      
      // First fetch the invoice to check for missing customer NIF
      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select('*, customers!inner(tax_id, name)')
        .eq('id', invoiceId)
        .single();
      
      if (invoiceError) {
        throw new Error(`Error al cargar factura: ${invoiceError.message}`);
      }
      
      // Check for missing customer NIF
      if (!invoiceData.customers?.tax_id || invoiceData.customers.tax_id.trim() === '') {
        throw new Error(`El cliente "${invoiceData.customers?.name || 'sin nombre'}" no tiene NIF/CIF. Por favor, edita el cliente y añade su NIF/CIF antes de enviar a Verifactu.`);
      }
      
      // Validate the invoice data
      try {
        await validateInvoiceData.mutateAsync(invoiceId);
      } catch (validationError: any) {
        throw new Error(`Validación fallida: ${validationError.message}`);
      }

      const { data, error } = await supabase.functions.invoke('verifactu', {
        body: {
          invoiceId,
          action: 'send'
        }
      });

      if (error) {
        console.error('Verifactu error:', error);
        throw error;
      }

      // Store the XML documents if they exist in the response
      if (data.requestXML) {
        await storeXMLDocument.mutateAsync({
          invoiceId,
          xmlType: 'request',
          xmlContent: data.requestXML,
        });
      }

      if (data.responseXML) {
        await storeXMLDocument.mutateAsync({
          invoiceId,
          xmlType: 'response',
          xmlContent: data.responseXML,
        });
      }

      return data;
    },
    onSuccess: (data) => {
      console.log('Verifactu success:', data);
      
      let title = 'Factura enviada a Verifactu';
      let description = 'La factura ha sido enviada correctamente al sistema Verifactu de la AEAT.';
      
      if (data.status === 'accepted') {
        if (data.csv) {
          description += ` CSV: ${data.csv}`;
        }
      } else if (data.status === 'queued') {
        title = 'AEAT no disponible: añadido a cola';
        description = 'El servicio de AEAT no está disponible. La factura se ha añadido a la cola de reintentos. Puedes pulsar "Procesar Cola" en la sección Cola de Verifactu o esperar al reintento automático.';
      } else if (data.status === 'error') {
        title = 'Error en Verifactu';
        description = data.response_message || 'Ha ocurrido un error en el sistema Verifactu.';
      }

      toast({
        title,
        description,
        variant: data.status === 'error' ? 'destructive' : 'default',
      });
      
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['verifactu-logs'] });
    },
    onError: (error: any) => {
      console.error('Verifactu error:', error);
      toast({
        title: 'Error al enviar a Verifactu',
        description: error.message || 'Ha ocurrido un error al enviar la factura a Verifactu.',
        variant: 'destructive',
      });
    }
  });

  const queryVerifactu = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data, error } = await supabase.functions.invoke('verifactu', {
        body: {
          invoiceId,
          action: 'query'
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      let title = 'Estado consultado';
      let description = 'El estado de la factura en Verifactu ha sido actualizado.';
      
      if (data.status === 'error') {
        title = 'Error al consultar estado';
        description = data.response_message || 'Ha ocurrido un error al consultar el estado.';
      }

      toast({
        title,
        description,
        variant: data.status === 'error' ? 'destructive' : 'default',
      });
      
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['verifactu-logs'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error al consultar estado',
        description: error.message || 'Ha ocurrido un error al consultar el estado en Verifactu.',
        variant: 'destructive',
      });
    }
  });

  const cancelVerifactu = useMutation({
    mutationFn: async (invoiceId: string) => {
      const { data, error } = await supabase.functions.invoke('verifactu', {
        body: {
          invoiceId,
          action: 'cancel'
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      let title = 'Factura anulada';
      let description = 'La factura ha sido anulada en el sistema Verifactu.';
      
      if (data.status === 'error') {
        title = 'Error al anular factura';
        description = data.response_message || 'Ha ocurrido un error al anular la factura.';
      }

      toast({
        title,
        description,
        variant: data.status === 'error' ? 'destructive' : 'default',
      });
      
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['verifactu-logs'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error al anular factura',
        description: error.message || 'Ha ocurrido un error al anular la factura en Verifactu.',
        variant: 'destructive',
      });
    }
  });

  const getCertificates = useQuery({
    queryKey: ['verifactu-certificates', companyId],
    queryFn: async () => {
      if (!companyId) {
        console.warn('No company ID available for certificates query');
        return [];
      }

      console.log('Fetching certificates for company:', companyId);
      
      const { data, error } = await supabase
        .from('verifactu_certificates')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching certificates:', error);
        throw error;
      }

      console.log('Certificates fetched:', data?.length || 0);
      return data || [];
    },
    enabled: !!companyId,
  });

  const getVerifactuLogs = useQuery({
    queryKey: ['verifactu-logs', companyId],
    queryFn: async () => {
      if (!companyId) {
        console.warn('No company ID available for logs query');
        return [];
      }

      console.log('Fetching Verifactu logs for company:', companyId);
      
      const { data, error } = await supabase
        .from('verifactu_logs')
        .select(`
          *,
          invoices!inner(number)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.error('Error fetching Verifactu logs:', error);
        throw error;
      }

      console.log('Verifactu logs fetched:', data?.length || 0);
      return data || [];
    },
    enabled: !!companyId,
  });

  const getCompanyConfig = useQuery({
    queryKey: ['verifactu-company-config', companyId],
    queryFn: async () => {
      if (!companyId) return null;

      const { data, error } = await supabase
        .from('verifactu_company_config')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    },
    enabled: !!companyId,
  });

  return {
    sendToVerifactu,
    queryVerifactu,
    cancelVerifactu,
    getCertificates,
    getVerifactuLogs,
    getCompanyConfig,
    validateInvoiceData,
  };
};
