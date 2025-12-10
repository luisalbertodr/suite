
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

export const useVerifactuXML = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { companyId } = useCompanyFilter();

  const getXMLDocuments = useQuery({
    queryKey: ['verifactu-xml-documents', companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from('verifactu_xml_documents')
        .select(`
          *,
          invoices!inner(number)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const storeXMLDocument = useMutation({
    mutationFn: async (data: {
      invoiceId: string;
      xmlType: 'request' | 'response';
      xmlContent: string;
      filePath?: string;
    }) => {
      if (!companyId) throw new Error('No company ID available');

      const { error } = await supabase
        .from('verifactu_xml_documents')
        .insert({
          company_id: companyId,
          invoice_id: data.invoiceId,
          xml_type: data.xmlType,
          xml_content: data.xmlContent,
          file_path: data.filePath,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['verifactu-xml-documents'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Error al guardar XML',
        description: error.message || 'Ha ocurrido un error al guardar el documento XML.',
        variant: 'destructive',
      });
    }
  });

  const downloadXML = (xmlContent: string, filename: string) => {
    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return {
    getXMLDocuments,
    storeXMLDocument,
    downloadXML,
  };
};
