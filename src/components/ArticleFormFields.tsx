
import React, { useState } from 'react';
import { ArticleFormData } from '@/hooks/useArticles';
import { BarcodeScanner } from './BarcodeScanner';
import { Scan } from 'lucide-react';

// Product types
const PRODUCT_TYPES = [
  { value: 'standard', label: 'Standard' },
  { value: 'textil', label: 'Textil' },
  { value: 'calzado', label: 'Calzado' }
];

interface ArticleFormFieldsProps {
  formData: ArticleFormData;
  families: string[];
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onProductTypeChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onFamiliaChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  isEditMode: boolean;
  hasCreatedArticle: boolean;
}

export const ArticleFormFields: React.FC<ArticleFormFieldsProps> = ({
  formData,
  families,
  onInputChange,
  onProductTypeChange,
  onFamiliaChange,
  isEditMode,
  hasCreatedArticle
}) => {
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  
  // Fields should only be disabled for newly created articles (not for editing existing articles)
  const fieldsDisabled = hasCreatedArticle && !isEditMode;

  const handleBarcodeDetected = (barcode: string) => {
    // Create a synthetic event to update the barcode field
    const syntheticEvent = {
      target: {
        name: 'codigo_barras',
        value: barcode
      }
    } as React.ChangeEvent<HTMLInputElement>;
    
    onInputChange(syntheticEvent);
    setShowBarcodeScanner(false);
  };
  
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo de Producto *
          </label>
          <select 
            name="tipo_producto"
            value={formData.tipo_producto}
            onChange={onProductTypeChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
            disabled={fieldsDisabled}
          >
            {PRODUCT_TYPES.map(type => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Familia *
          </label>
          <select 
            name="familia"
            value={formData.familia}
            onChange={onFamiliaChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
            disabled={fieldsDisabled}
          >
            <option value="">Seleccionar familia</option>
            {families.map(familia => (
              <option key={familia} value={familia}>{familia}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Código * {!isEditMode && formData.familia && <span className="text-green-600">(Generado automáticamente)</span>}
          </label>
          <input
            type="text"
            name="codigo"
            value={formData.codigo}
            onChange={onInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Selecciona una familia para generar automáticamente"
            required
            readOnly={(!isEditMode && !formData.familia) || fieldsDisabled}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Descripción Corta *
        </label>
        <input
          type="text"
          name="descripcion"
          value={formData.descripcion}
          onChange={onInputChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Descripción del producto"
          required
          disabled={fieldsDisabled}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Descripción Larga
        </label>
        <textarea
          name="descripcion_larga"
          value={formData.descripcion_larga}
          onChange={onInputChange}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Descripción detallada del producto..."
          disabled={fieldsDisabled}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Precio (€) *
          </label>
          <input
            type="number"
            name="precio"
            value={formData.precio}
            onChange={onInputChange}
            step="0.01"
            min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="89.99"
            required
            disabled={fieldsDisabled}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            IVA (%) *
          </label>
          <input
            type="number"
            name="iva_percentage"
            value={formData.iva_percentage}
            onChange={onInputChange}
            step="0.01"
            min="0"
            max="100"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="21.00"
            required
            disabled={fieldsDisabled}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stock Actual
          </label>
          <input
            type="number"
            name="stock_actual"
            value={formData.stock_actual}
            onChange={onInputChange}
            min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="15"
            disabled={fieldsDisabled}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Stock Mínimo
          </label>
          <input
            type="number"
            name="stock_minimo"
            value={formData.stock_minimo}
            onChange={onInputChange}
            min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="5"
            disabled={fieldsDisabled}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Código de Barras
          </label>
          <div className="flex space-x-2">
            <input
              type="text"
              name="codigo_barras"
              value={formData.codigo_barras}
              onChange={onInputChange}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="1234567890123"
              disabled={fieldsDisabled}
            />
            <button
              type="button"
              onClick={() => setShowBarcodeScanner(true)}
              className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center space-x-1"
              disabled={fieldsDisabled}
              title="Escanear código de barras"
            >
              <Scan className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nº de Serie
          </label>
          <input
            type="text"
            name="codigo_serie"
            value={formData.codigo_serie}
            onChange={onInputChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="RT001-001"
            disabled={fieldsDisabled}
          />
        </div>
      </div>

      {showBarcodeScanner && (
        <BarcodeScanner
          isOpen={showBarcodeScanner}
          onClose={() => setShowBarcodeScanner(false)}
          onBarcodeDetected={handleBarcodeDetected}
        />
      )}
    </div>
  );
};
