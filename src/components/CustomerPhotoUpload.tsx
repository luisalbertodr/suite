
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, X, Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CustomerPhotoUploadProps {
  currentPhotoUrl?: string;
  onPhotoChange: (photoUrl: string | null) => void;
  customerId?: string;
}

export const CustomerPhotoUpload: React.FC<CustomerPhotoUploadProps> = ({
  currentPhotoUrl,
  onPhotoChange,
  customerId
}) => {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Error",
        description: "Por favor selecciona un archivo de imagen válido.",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Error",
        description: "El archivo es demasiado grande. Máximo 5MB.",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `customer-${customerId || Date.now()}.${fileExt}`;
      const filePath = `customer-photos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('article-photos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('article-photos')
        .getPublicUrl(filePath);

      onPhotoChange(publicUrl);

      toast({
        title: "Éxito",
        description: "Foto subida correctamente.",
      });
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({
        title: "Error",
        description: "No se pudo subir la foto.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = () => {
    onPhotoChange(null);
  };

  return (
    <div className="space-y-4">
      <Label>Foto del Cliente</Label>
      
      {currentPhotoUrl ? (
        <div className="relative inline-block">
          <img
            src={currentPhotoUrl}
            alt="Foto del cliente"
            className="w-24 h-24 rounded-full object-cover border-2 border-gray-200"
          />
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
            onClick={handleRemovePhoto}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      ) : (
        <div className="w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
          <Camera className="w-8 h-8 text-gray-400" />
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Input
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          disabled={uploading}
          className="hidden"
          id="photo-upload"
        />
        <Label htmlFor="photo-upload" className="cursor-pointer">
          <Button type="button" variant="outline" disabled={uploading} asChild>
            <span>
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? 'Subiendo...' : 'Subir Foto'}
            </span>
          </Button>
        </Label>
      </div>
    </div>
  );
};
