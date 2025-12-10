
import React from 'react';
import { Upload, Image as ImageIcon } from 'lucide-react';

interface ArticleImageUploadProps {
  imagePreview: string | null;
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
}

export const ArticleImageUpload: React.FC<ArticleImageUploadProps> = ({
  imagePreview,
  onImageChange,
  onRemoveImage
}) => {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Foto del Producto
      </label>
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
        {imagePreview ? (
          <div className="space-y-4">
            <img
              src={imagePreview}
              alt="Preview"
              className="mx-auto max-h-48 rounded-lg object-contain"
            />
            <div className="flex justify-center space-x-2">
              <label className="cursor-pointer inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                <Upload className="w-4 h-4 mr-2" />
                Cambiar imagen
                <input
                  type="file"
                  accept="image/*"
                  onChange={onImageChange}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={onRemoveImage}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        ) : (
          <label className="cursor-pointer block">
            <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600 mb-2">Arrastra una imagen aquí o haz clic para seleccionar</p>
            <p className="text-sm text-gray-500">Formatos soportados: JPG, PNG, GIF</p>
            <input
              type="file"
              accept="image/*"
              onChange={onImageChange}
              className="hidden"
            />
          </label>
        )}
      </div>
    </div>
  );
};
