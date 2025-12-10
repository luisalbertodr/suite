import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink } from 'lucide-react';

interface VerifactuQRCodeProps {
  isOpen: boolean;
  onClose: () => void;
  qrData: {
    url: string;
    csv: string;
    invoiceNumber: string;
  } | null;
}

export const VerifactuQRCode: React.FC<VerifactuQRCodeProps> = ({
  isOpen,
  onClose,
  qrData
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isOpen && qrData && canvasRef.current) {
      generateQRCode();
    }
  }, [isOpen, qrData]);

  const generateQRCode = async () => {
    if (!qrData || !canvasRef.current) return;

    try {
      await QRCode.toCanvas(canvasRef.current, qrData.url, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  };

  const handleDownloadQR = () => {
    if (!canvasRef.current || !qrData) return;

    const link = document.createElement('a');
    link.download = `QR-Factura-${qrData.invoiceNumber}.png`;
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  const handleOpenVerification = () => {
    if (qrData?.url) {
      window.open(qrData.url, '_blank');
    }
  };

  if (!qrData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Código QR de Verifactu</DialogTitle>
          <DialogDescription>
            Factura: {qrData.invoiceNumber} | CSV: {qrData.csv}
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col items-center space-y-4">
          <div className="bg-white p-4 rounded-lg border">
            <canvas ref={canvasRef} />
          </div>
          
          <div className="text-center text-sm text-muted-foreground">
            <p>Escanea este código QR para verificar la factura</p>
            <p className="break-all text-xs mt-1">{qrData.url}</p>
          </div>
          
          <div className="flex space-x-2">
            <Button variant="outline" onClick={handleDownloadQR}>
              <Download className="w-4 h-4 mr-2" />
              Descargar QR
            </Button>
            <Button variant="outline" onClick={handleOpenVerification}>
              <ExternalLink className="w-4 h-4 mr-2" />
              Verificar Online
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};