
import React from 'react';
import { X, CheckCircle } from 'lucide-react';

interface ArticleFormHeaderProps {
  isEditMode: boolean;
  showSuccessMessage: boolean;
  onClose: () => void;
}

export const ArticleFormHeader: React.FC<ArticleFormHeaderProps> = ({
  isEditMode,
  showSuccessMessage,
  onClose
}) => {
  return (
    <div className="p-6 border-b border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h3 className="text-xl font-semibold text-gray-900">
            {isEditMode ? 'Editar Artículo' : 'Nuevo Artículo'}
          </h3>
          {showSuccessMessage && (
            <div className="flex items-center space-x-2 px-3 py-1 bg-green-100 text-green-800 rounded-lg">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Artículo creado exitosamente</span>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
