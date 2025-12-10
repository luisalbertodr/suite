
import React from 'react';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';

interface FormActionsProps {
  onCancel: () => void;
  isLoading?: boolean;
  saveText?: string;
}

export const FormActions: React.FC<FormActionsProps> = ({ 
  onCancel, 
  isLoading = false, 
  saveText = 'Guardar' 
}) => {
  return (
    <div className="flex justify-end space-x-4">
      <Button type="button" variant="outline" onClick={onCancel}>
        Cancelar
      </Button>
      <Button type="submit" disabled={isLoading}>
        <Save className="w-4 h-4 mr-2" />
        {isLoading ? 'Guardando...' : saveText}
      </Button>
    </div>
  );
};
