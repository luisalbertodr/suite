
import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface FormHeaderProps {
  title: string;
  onClose: () => void;
}

export const FormHeader: React.FC<FormHeaderProps> = ({ title, onClose }) => {
  return (
    <div className="flex items-center space-x-4">
      <Button variant="ghost" onClick={onClose}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver
      </Button>
      <h1 className="text-3xl font-bold text-gray-900">{title}</h1>
    </div>
  );
};
