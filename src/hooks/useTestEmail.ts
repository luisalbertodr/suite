
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';

interface TestEmailParams {
  destinationEmail: string;
}

export const useTestEmail = () => {
  const { toast } = useToast();

  const sendTestEmail = useMutation({
    mutationFn: async (params: TestEmailParams) => {
      console.log('🚀 Starting test email send process to:', params.destinationEmail);
      
      // Get the current session to obtain the access token
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        console.error('❌ No valid session found:', sessionError);
        throw new Error('No se pudo obtener la sesión de usuario');
      }

      console.log('🔐 Session found, user:', session.user.email);
      console.log('🔐 Access token length:', session.access_token.length);

      // Call edge function with proper authorization
      console.log('🔗 Calling test email edge function...');
      console.log('📧 Test email data:', {
        destinationEmail: params.destinationEmail,
      });

      const { data, error } = await supabase.functions.invoke('send-test-email', {
        body: {
          destinationEmail: params.destinationEmail,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      console.log('📨 Test email response:', { data, error });

      if (error) {
        console.error('❌ Test email send error from edge function:', error);
        console.error('❌ Error details:', {
          message: error.message,
          status: error.status,
          statusText: error.statusText,
          context: error.context
        });
        
        // Try to get more specific error information
        let errorMessage = 'Failed to send test email';
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
        console.error('❌ Test email send failed:', data?.error);
        throw new Error(data?.error || 'Failed to send test email');
      }

      console.log('✅ Test email sent successfully');
      return data;
    },
    onSuccess: () => {
      console.log('✅ Test email operation completed successfully');
      toast({
        title: "Email de prueba enviado",
        description: "El email de prueba ha sido enviado correctamente.",
      });
    },
    onError: (error: any) => {
      console.error('❌ Test email send error:', error);
      toast({
        title: "Error al enviar email de prueba",
        description: error.message || "Ha ocurrido un error al enviar el email de prueba.",
        variant: "destructive",
      });
    },
  });

  return {
    sendTestEmail,
    isLoading: sendTestEmail.isPending,
  };
};
