
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import html2pdf from 'html2pdf.js';

interface SendEmailParams {
  documentType: 'invoice' | 'quote' | 'delivery_note';
  documentId: string;
  customerEmail: string;
  customerName: string;
  subject: string;
  message: string;
  documentElement: HTMLElement;
  documentNumber: string;
}

export const useEmailOperations = () => {
  const { toast } = useToast();

  const sendDocumentEmail = useMutation({
    mutationFn: async (params: SendEmailParams) => {
      console.log('🚀 Starting email send process for:', params.documentType, params.documentNumber);
      
      // Get the current session to obtain the access token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        console.error('❌ No valid session found:', sessionError);
        throw new Error('No se pudo obtener la sesión de usuario');
      }

      console.log('🔐 Session found, user:', session.user.email);
      console.log('🔐 Access token length:', session.access_token.length);
      
      // Generate PDF from HTML element
      const opt = {
        margin: 0.5,
        filename: `documento.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
      };

      console.log('📄 Generating PDF...');
      // Get PDF as blob
      const pdfBlob = await html2pdf().set(opt).from(params.documentElement).outputPdf('blob');
      
      // Convert blob to base64
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const base64String = btoa(String.fromCharCode(...uint8Array));
      
      console.log('📧 PDF converted to base64, size:', base64String.length, 'characters');

      // Call edge function with proper authorization
      console.log('🔗 Calling edge function with authorization...');
      console.log('📧 Request data:', {
        documentType: params.documentType,
        documentId: params.documentId,
        customerEmail: params.customerEmail,
        customerName: params.customerName,
        subject: params.subject,
        pdfBufferLength: base64String.length,
        documentNumber: params.documentNumber,
      });

      const { data, error } = await supabase.functions.invoke('send-document-email', {
        body: {
          documentType: params.documentType,
          documentId: params.documentId,
          customerEmail: params.customerEmail,
          customerName: params.customerName,
          subject: params.subject,
          message: params.message,
          pdfBuffer: base64String,
          documentNumber: params.documentNumber,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log('📨 Edge function response:', { data, error });

      if (error) {
        console.error('❌ Email send error from edge function:', error);
        console.error('❌ Error details:', {
          message: error.message,
          status: error.status,
          statusText: error.statusText,
          context: error.context
        });
        
        // Try to get more specific error information
        let errorMessage = 'Failed to send email';
        if (error.message) {
          errorMessage = error.message;
        } else if (error.context?.json) {
          errorMessage = JSON.stringify(error.context.json);
        } else if (error.context?.text) {
          errorMessage = error.context.text;
        }
        
        throw new Error(errorMessage);
      }

      if (!data?.success) {
        console.error('❌ Email send failed:', data?.error);
        throw new Error(data?.error || 'Failed to send email');
      }

      console.log('✅ Email sent successfully');
      return data;
    },
    onSuccess: () => {
      console.log('✅ Email operation completed successfully');
      toast({
        title: "Email enviado",
        description: "El documento ha sido enviado por email correctamente.",
      });
    },
    onError: (error: any) => {
      console.error('❌ Email send error:', error);
      toast({
        title: "Error al enviar email",
        description: error.message || "Ha ocurrido un error al enviar el email.",
        variant: "destructive",
      });
    },
  });

  return {
    sendDocumentEmail,
    isLoading: sendDocumentEmail.isPending,
  };
};
