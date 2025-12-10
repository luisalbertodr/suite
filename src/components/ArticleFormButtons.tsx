
import React from 'react';

interface ArticleFormButtonsProps {
  hasCreatedArticle: boolean;
  showVariationsSection: boolean;
  loading: boolean;
  isEditMode: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onFinishAndClose: () => void;
}

export const ArticleFormButtons: React.FC<ArticleFormButtonsProps> = ({
  hasCreatedArticle,
  showVariationsSection,
  loading,
  isEditMode,
  onClose,
  onSubmit,
  onFinishAndClose
}) => {
  if (hasCreatedArticle && showVariationsSection) {
    return (
      <button
        type="button"
        onClick={onFinishAndClose}
        className="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all shadow-lg"
      >
        Terminar y Cerrar
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        disabled={loading}
      >
        Cancelar
      </button>
      <button
        onClick={onSubmit}
        disabled={loading}
        className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg disabled:opacity-50"
      >
        {loading ? 'Guardando...' : isEditMode ? 'Actualizar' : 'Crear'} Artículo
      </button>
    </>
  );
};
