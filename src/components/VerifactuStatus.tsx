
import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useVerifactu } from '@/hooks/useVerifactu';
import { VerifactuQRCode } from './VerifactuQRCode';
import { CheckCircle, XCircle, Clock, Send, RefreshCw, Eye, QrCode } from 'lucide-react';

interface VerifactuStatusProps {
  invoice: {
    id: string;
    number: string;
    verifactu_status?: string;
    verifactu_csv?: string;
    verifactu_qr_code?: string;
    verifactu_sent_at?: string;
    verifactu_response_message?: string;
  };
}

export const VerifactuStatus: React.FC<VerifactuStatusProps> = ({ invoice }) => {
  const { sendToVerifactu, queryVerifactu } = useVerifactu();
  const [showQRDialog, setShowQRDialog] = useState(false);

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'rejected':
      case 'error':
        return <XCircle className="w-4 h-4 text-red-600" />;
      case 'sent':
        return <Clock className="w-4 h-4 text-blue-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'accepted':
        return 'Aceptada';
      case 'rejected':
        return 'Rechazada';
      case 'error':
        return 'Error';
      case 'sent':
        return 'Enviada';
      default:
        return 'Pendiente';
    }
  };

  const getStatusVariant = (status?: string) => {
    switch (status) {
      case 'accepted':
        return 'default' as const;
      case 'rejected':
      case 'error':
        return 'destructive' as const;
      case 'sent':
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  };

  const handleSendToVerifactu = () => {
    sendToVerifactu.mutate(invoice.id);
  };

  const handleQueryStatus = () => {
    queryVerifactu.mutate(invoice.id);
  };

  const handleViewQR = () => {
    if (invoice.verifactu_qr_code && invoice.verifactu_csv) {
      setShowQRDialog(true);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={getStatusVariant(invoice.verifactu_status)} className="flex items-center space-x-1">
              {getStatusIcon(invoice.verifactu_status)}
              <span>{getStatusLabel(invoice.verifactu_status)}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p><strong>Estado:</strong> {getStatusLabel(invoice.verifactu_status)}</p>
              {invoice.verifactu_sent_at && (
                <p><strong>Enviado:</strong> {new Date(invoice.verifactu_sent_at).toLocaleString()}</p>
              )}
              {invoice.verifactu_csv && (
                <p><strong>CSV:</strong> {invoice.verifactu_csv}</p>
              )}
              {invoice.verifactu_response_message && (
                <p><strong>Mensaje:</strong> {invoice.verifactu_response_message}</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <div className="flex items-center space-x-1">
        {(!invoice.verifactu_status || invoice.verifactu_status === 'pending') && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleSendToVerifactu}
            disabled={sendToVerifactu.isPending}
          >
            <Send className="w-3 h-3 mr-1" />
            Enviar
          </Button>
        )}

        {invoice.verifactu_status && invoice.verifactu_status !== 'pending' && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleQueryStatus}
            disabled={queryVerifactu.isPending}
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Consultar
          </Button>
        )}

        {invoice.verifactu_qr_code && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleViewQR}
          >
            <QrCode className="w-3 h-3 mr-1" />
            Ver QR
          </Button>
        )}
        {!invoice.verifactu_qr_code && invoice.verifactu_status === 'accepted' && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground italic">
                  QR no disponible (entorno de pruebas)
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>El entorno de pruebas de AEAT no genera CSV/QR.</p>
                <p>En producción sí estará disponible.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        {!invoice.verifactu_qr_code && invoice.verifactu_status === 'pending' && (
          <span className="text-sm text-muted-foreground">
            QR disponible tras envío exitoso
          </span>
        )}
      </div>
      
      <VerifactuQRCode
        isOpen={showQRDialog}
        onClose={() => setShowQRDialog(false)}
        qrData={invoice.verifactu_qr_code && invoice.verifactu_csv ? {
          url: invoice.verifactu_qr_code,
          csv: invoice.verifactu_csv,
          invoiceNumber: invoice.number
        } : null}
      />
    </div>
  );
};
