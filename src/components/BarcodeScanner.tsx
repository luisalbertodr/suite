
import React, { useRef, useEffect, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { Button } from '@/components/ui/button';
import { X, Camera } from 'lucide-react';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onBarcodeDetected: (barcode: string) => void;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  isOpen,
  onClose,
  onBarcodeDetected
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [codeReader, setCodeReader] = useState<BrowserMultiFormatReader | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen) {
      const reader = new BrowserMultiFormatReader();
      setCodeReader(reader);
      startScanning(reader);
    }

    return () => {
      stopScanning();
    };
  }, [isOpen]);

  const startScanning = async (reader: BrowserMultiFormatReader) => {
    try {
      setError(null);
      setIsScanning(true);

      if (!videoRef.current) return;

      // Obtener dispositivos de video (cámaras) usando el método estático
      const videoDevices = await BrowserMultiFormatReader.listVideoInputDevices();
      
      if (videoDevices.length === 0) {
        setError('No se encontraron cámaras disponibles');
        return;
      }

      // Usar la cámara trasera si está disponible, sino usar la primera disponible
      const backCamera = videoDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('trasera')
      );
      const selectedDevice = backCamera || videoDevices[0];

      // Configurar el stream de video
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: selectedDevice.deviceId,
          facingMode: 'environment', // Preferir cámara trasera
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });

      setStream(mediaStream);
      videoRef.current.srcObject = mediaStream;
      videoRef.current.play();

      // Comenzar a escanear
      reader.decodeOnceFromVideoDevice(selectedDevice.deviceId, videoRef.current)
        .then((result) => {
          console.log('Código de barras detectado:', result.getText());
          onBarcodeDetected(result.getText());
          stopScanning();
          onClose();
        })
        .catch((err) => {
          console.log('Error al escanear:', err);
          if (err.name !== 'NotFoundException') {
            setError('Error al escanear el código de barras');
          }
        });

    } catch (err) {
      console.error('Error al acceder a la cámara:', err);
      setError('Error al acceder a la cámara. Verifica los permisos.');
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    // Detener el stream de video
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject = null;
    }
    
    setIsScanning(false);
  };

  const handleClose = () => {
    stopScanning();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold flex items-center">
            <Camera className="w-5 h-5 mr-2" />
            Escanear Código de Barras
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {error ? (
          <div className="text-center py-8">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={handleClose} variant="outline">
              Cerrar
            </Button>
          </div>
        ) : (
          <div className="relative">
            <video
              ref={videoRef}
              className="w-full h-64 bg-black rounded-lg object-cover"
              autoPlay
              playsInline
              muted
            />
            
            {isScanning && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="border-2 border-green-500 w-48 h-32 rounded-lg animate-pulse">
                  <div className="w-full h-full border border-green-300 rounded-lg"></div>
                </div>
              </div>
            )}
            
            <div className="text-center mt-4">
              <p className="text-sm text-gray-600 mb-2">
                Apunta la cámara hacia el código de barras
              </p>
              <Button onClick={handleClose} variant="outline" size="sm">
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
