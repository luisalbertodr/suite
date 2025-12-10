
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Mail, Send } from 'lucide-react';
import { useEmailOperations } from '@/hooks/useEmailOperations';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

interface EmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: 'invoice' | 'quote' | 'delivery_note';
  documentId: string;
  documentNumber: string;
  customerEmail: string;
  customerName: string;
  documentElement: HTMLElement | null;
}

export const EmailDialog: React.FC<EmailDialogProps> = ({
  isOpen,
  onClose,
  documentType,
  documentId,
  documentNumber,
  customerEmail,
  customerName,
  documentElement,
}) => {
  const [email, setEmail] = useState(customerEmail);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const { sendDocumentEmail, isLoading } = useEmailOperations();
  const { companyId } = useCompanyFilter();

  // Get email templates from settings
  const { data: emailSettings } = useQuery({
    queryKey: ['email-settings', companyId, documentType],
    queryFn: async () => {
      if (!companyId) return null;

      const settingKeys = [
        `email_template_${documentType}_subject`,
        'email_template_body',
        'company_name'
      ];

      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_key, setting_value')
        .eq('company_id', companyId)
        .in('setting_key', settingKeys);

      if (error) throw error;

      const settings: Record<string, string> = {};
      data?.forEach(setting => {
        settings[setting.setting_key] = setting.setting_value || '';
      });

      return settings;
    },
    enabled: !!companyId && isOpen,
  });

  useEffect(() => {
    if (emailSettings && isOpen) {
      // Set default subject based on document type
      const subjectTemplate = emailSettings[`email_template_${documentType}_subject`] || 
        getDefaultSubject(documentType);
      
      const finalSubject = subjectTemplate.replace('{number}', documentNumber);
      setSubject(finalSubject);

      // Set default message
      const messageTemplate = emailSettings['email_template_body'] || getDefaultMessage();
      const finalMessage = messageTemplate
        .replace('{company_name}', emailSettings['company_name'] || 'Nuestra empresa')
        .replace('{number}', documentNumber)
        .replace('{customer_name}', customerName);
      
      setMessage(finalMessage);
    }
  }, [emailSettings, documentType, documentNumber, customerName, isOpen]);

  const getDefaultSubject = (type: string) => {
    switch (type) {
      case 'invoice': return 'Nueva factura #{number}';
      case 'quote': return 'Presupuesto #{number}';
      case 'delivery_note': return 'Albarán #{number}';
      default: return 'Documento #{number}';
    }
  };

  const getDefaultMessage = () => {
    return `Estimado cliente,

Adjunto encontrará el documento solicitado.

Saludos cordiales,
{company_name}`;
  };

  const handleSend = async () => {
    if (!documentElement || !email.trim() || !subject.trim()) {
      return;
    }

    try {
      await sendDocumentEmail.mutateAsync({
        documentType,
        documentId,
        customerEmail: email,
        customerName,
        subject,
        message,
        documentElement,
        documentNumber,
      });
      onClose();
    } catch (error) {
      // Error handling is done in the hook
    }
  };

  const handleClose = () => {
    setEmail(customerEmail);
    setSubject('');
    setMessage('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Mail className="w-5 h-5" />
            <span>Enviar por Email</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="email">Email del destinatario</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="cliente@email.com"
            />
          </div>

          <div>
            <Label htmlFor="subject">Asunto</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Asunto del email"
            />
          </div>

          <div>
            <Label htmlFor="message">Mensaje</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Mensaje del email"
              rows={6}
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSend} 
              disabled={isLoading || !email.trim() || !subject.trim()}
            >
              <Send className="w-4 h-4 mr-2" />
              {isLoading ? 'Enviando...' : 'Enviar Email'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
