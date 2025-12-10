
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Package, Euro, Barcode, AlertTriangle, DollarSign, Percent } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ArticleVariation {
  id?: string;
  article_id?: string;
  talla: string;
  color: string;
  stock_actual: number;
  stock_minimo: number;
  precio: number;
  precio_compra: number;
  codigo_barras?: string;
  estado: 'activo' | 'inactivo';
  iva_percentage: number;
  created_at?: string;
  updated_at?: string;
}

interface ArticleVariationsProps {
  articleId?: string;
  tipoProducto: 'textil' | 'calzado' | 'standard';
  onVariationsChange?: (variations: ArticleVariation[]) => void;
  initialVariations?: ArticleVariation[];
}

// Common sizes for clothing
const CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

// Shoe sizes (European)
const SHOE_SIZES = ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'];

// Common colors
const COLORS = [
  'Blanco', 'Negro', 'Gris', 'Azul', 'Rojo', 'Verde', 'Amarillo', 'Rosa',
  'Naranja', 'Morado', 'Marrón', 'Beige', 'Plateado', 'Dorado', 'Multicolor'
];

export const ArticleVariations: React.FC<ArticleVariationsProps> = ({
  articleId,
  tipoProducto,
  onVariationsChange,
  initialVariations = []
}) => {
  const [variations, setVariations] = useState<ArticleVariation[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingVariation, setEditingVariation] = useState<ArticleVariation | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState<ArticleVariation>({
    talla: '',
    color: '',
    stock_actual: 0,
    stock_minimo: 0,
    precio: 0,
    precio_compra: 0,
    codigo_barras: '',
    estado: 'activo',
    iva_percentage: 21
  });

  // Load variations only when articleId changes and is available
  useEffect(() => {
    const loadVariations = async () => {
      if (!articleId) {
        console.log('❌ loadVariations: No articleId provided');
        setVariations([]);
        onVariationsChange?.([]);
        return;
      }

      console.log('🔄 loadVariations: Loading variations for articleId:', articleId);
      setLoading(true);
      
      try {
        const { data, error } = await supabase
          .from('article_variations')
          .select('*')
          .eq('article_id', articleId)
          .order('talla', { ascending: true });

        console.log('📊 loadVariations: Supabase response:', { data, error, articleId });

        if (error) {
          console.error('❌ loadVariations: Supabase error:', error);
          throw error;
        }
        
        if (data) {
          const typedData = data.map(item => ({
            ...item,
            estado: item.estado as 'activo' | 'inactivo',
            iva_percentage: item.iva_percentage || 21
          }));
          
          console.log('✅ loadVariations: Successfully loaded variations:', typedData);
          setVariations(typedData);
          onVariationsChange?.(typedData);
        } else {
          console.log('📊 loadVariations: No data returned, setting empty array');
          setVariations([]);
          onVariationsChange?.([]);
        }
      } catch (error) {
        console.error('❌ loadVariations: Error:', error);
        toast.error('Error al cargar las variaciones');
        setVariations([]);
        onVariationsChange?.([]);
      } finally {
        setLoading(false);
      }
    };

    console.log('🔄 ArticleVariations useEffect: articleId changed to:', articleId);
    if (articleId) {
      loadVariations();
    } else {
      console.log('📊 ArticleVariations useEffect: No articleId, clearing variations');
      setVariations([]);
      onVariationsChange?.([]);
    }
  }, [articleId]); // Only depend on articleId

  // Helper function to update variations both locally and notify parent
  const updateVariationsState = useCallback((newVariations: ArticleVariation[]) => {
    console.log('🔄 updateVariationsState: Setting variations:', newVariations);
    setVariations(newVariations);
    onVariationsChange?.(newVariations);
  }, [onVariationsChange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: name === 'precio' || name === 'precio_compra' || name === 'stock_actual' || name === 'stock_minimo' || name === 'iva_percentage'
        ? parseFloat(value) || 0 
        : value
    }));
  };

  const getSizeOptions = () => {
    switch (tipoProducto) {
      case 'calzado':
        return SHOE_SIZES;
      case 'textil':
        return CLOTHING_SIZES;
      default:
        return [];
    }
  };

  const resetForm = () => {
    console.log('🔄 resetForm: Resetting form');
    setFormData({
      talla: '',
      color: '',
      stock_actual: 0,
      stock_minimo: 0,
      precio: 0,
      precio_compra: 0,
      codigo_barras: '',
      estado: 'activo',
      iva_percentage: 21
    });
    setEditingVariation(null);
    setShowForm(false);
    setSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('🔄 handleSubmit: Starting submit process');
    console.log('📝 handleSubmit: formData:', formData);
    console.log('📝 handleSubmit: editingVariation:', editingVariation);
    console.log('📝 handleSubmit: articleId:', articleId);

    if (!formData.talla || !formData.color || formData.precio <= 0) {
      toast.error('Por favor, complete todos los campos obligatorios');
      return;
    }

    if (!articleId) {
      toast.error('No se puede guardar la variación sin un artículo válido');
      return;
    }

    // Check for duplicate variation
    const isDuplicate = variations.some(v => 
      v.talla === formData.talla && 
      v.color === formData.color && 
      v.id !== editingVariation?.id
    );

    if (isDuplicate) {
      toast.error('Ya existe una variación con esta talla y color');
      return;
    }

    setSubmitting(true);
    
    try {
      if (editingVariation && editingVariation.id) {
        console.log('🔄 handleSubmit: Updating existing variation with ID:', editingVariation.id);
        
        // Update existing variation
        const updateData = {
          talla: formData.talla,
          color: formData.color,
          stock_actual: formData.stock_actual,
          stock_minimo: formData.stock_minimo,
          precio: formData.precio,
          precio_compra: formData.precio_compra,
          codigo_barras: formData.codigo_barras || '',
          estado: formData.estado,
          iva_percentage: formData.iva_percentage
        };
        
        console.log('📤 handleSubmit: Sending update data:', updateData);

        const { data, error } = await supabase
          .from('article_variations')
          .update(updateData)
          .eq('id', editingVariation.id)
          .select()
          .single();

        console.log('📊 handleSubmit: Update response:', { data, error });

        if (error) {
          console.error('❌ handleSubmit: Update error:', error);
          throw error;
        }

        if (data) {
          const typedData = {
            ...data,
            estado: data.estado as 'activo' | 'inactivo',
            iva_percentage: data.iva_percentage || 21
          };

          const updatedVariations = variations.map(v => 
            v.id === editingVariation.id ? typedData : v
          );
          
          console.log('✅ handleSubmit: Updated variations list:', updatedVariations);
          updateVariationsState(updatedVariations);
          toast.success('Variación actualizada exitosamente');
        }
        
      } else {
        console.log('🔄 handleSubmit: Creating new variation');
        
        // Create new variation
        const variationToCreate = { 
          ...formData, 
          article_id: articleId,
          codigo_barras: formData.codigo_barras || '',
          iva_percentage: formData.iva_percentage
        };

        console.log('📤 handleSubmit: Creating variation:', variationToCreate);

        const { data, error } = await supabase
          .from('article_variations')
          .insert([variationToCreate])
          .select()
          .single();

        console.log('📊 handleSubmit: Create response:', { data, error });

        if (error) {
          console.error('❌ handleSubmit: Create error:', error);
          throw error;
        }

        if (data) {
          const typedData = {
            ...data,
            estado: data.estado as 'activo' | 'inactivo',
            iva_percentage: data.iva_percentage || 21
          };

          const newVariations = [...variations, typedData];
          console.log('✅ handleSubmit: New variations list:', newVariations);
          updateVariationsState(newVariations);
          toast.success('Variación creada exitosamente');
        }
      }

      resetForm();
      
    } catch (error) {
      console.error('❌ handleSubmit: Error:', error);
      toast.error('Error al guardar la variación: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      console.log('🔄 handleSubmit: Finalizing submit process');
      setSubmitting(false);
    }
  };

  const handleEdit = (variation: ArticleVariation) => {
    console.log('🔄 handleEdit: Starting edit for variation:', variation);
    setFormData({
      talla: variation.talla,
      color: variation.color,
      stock_actual: variation.stock_actual,
      stock_minimo: variation.stock_minimo,
      precio: variation.precio,
      precio_compra: variation.precio_compra,
      codigo_barras: variation.codigo_barras || '',
      estado: variation.estado,
      iva_percentage: variation.iva_percentage || 21
    });
    setEditingVariation(variation);
    setShowForm(true);
    setSubmitting(false);
  };

  const handleDelete = async (variation: ArticleVariation) => {
    if (!window.confirm('¿Estás seguro de que quieres eliminar esta variación?')) {
      return;
    }

    if (!variation.id) {
      toast.error('No se puede eliminar una variación sin ID');
      return;
    }

    try {
      console.log('🔄 handleDelete: Deleting variation with ID:', variation.id);

      const { error } = await supabase
        .from('article_variations')
        .delete()
        .eq('id', variation.id);

      if (error) {
        console.error('❌ handleDelete: Delete error:', error);
        throw error;
      }

      const newVariations = variations.filter(v => v.id !== variation.id);
      console.log('✅ handleDelete: Updated variations after delete:', newVariations);
      updateVariationsState(newVariations);
      toast.success('Variación eliminada exitosamente');
    } catch (error) {
      console.error('❌ handleDelete: Error:', error);
      toast.error('Error al eliminar la variación');
    }
  };

  if (tipoProducto === 'standard') {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            Variaciones de Talla y Color
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Gestiona las diferentes combinaciones de talla y color para este artículo
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Añadir Variación</span>
        </button>
      </div>

      {/* Summary stats */}
      {variations.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-blue-800 font-medium">
              Total de variaciones: {variations.length}
            </span>
            <span className="text-blue-600">
              Stock total: {variations.reduce((sum, v) => sum + v.stock_actual, 0)} unidades
            </span>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando variaciones...</p>
        </div>
      )}

      {/* No variations message */}
      {!loading && variations.length === 0 && articleId && (
        <div className="text-center py-8 bg-gray-50 rounded-lg">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 font-medium mb-2">No hay variaciones</p>
          <p className="text-gray-500 text-sm mb-4">
            Añade variaciones de talla y color para este artículo
          </p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Crear primera variación
          </button>
        </div>
      )}

      {/* Variations Grid */}
      {!loading && variations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {variations.map((variation) => (
            <div key={variation.id} className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex space-x-2">
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                    {tipoProducto === 'calzado' ? `Nº ${variation.talla}` : `Talla: ${variation.talla}`}
                  </span>
                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                    {variation.color}
                  </span>
                </div>
                <div className="flex space-x-1">
                  <button
                    type="button"
                    onClick={() => handleEdit(variation)}
                    className="text-blue-600 hover:text-blue-800 p-1"
                    title="Editar variación"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(variation)}
                    className="text-red-600 hover:text-red-800 p-1"
                    title="Eliminar variación"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-gray-600">
                    <Euro className="w-3 h-3 mr-1" />
                    Precio:
                  </span>
                  <span className="font-medium">€{variation.precio.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-gray-600">
                    <DollarSign className="w-3 h-3 mr-1" />
                    P. Compra:
                  </span>
                  <span className="font-medium text-green-600">€{variation.precio_compra.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-gray-600">
                    <Percent className="w-3 h-3 mr-1" />
                    IVA:
                  </span>
                  <span className="font-medium">{variation.iva_percentage}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center text-gray-600">
                    <Package className="w-3 h-3 mr-1" />
                    Stock:
                  </span>
                  <div className="flex items-center">
                    <span className={`font-medium ${variation.stock_actual <= variation.stock_minimo ? 'text-red-600' : 'text-gray-900'}`}>
                      {variation.stock_actual}
                    </span>
                    <span className="text-xs text-gray-500 ml-1">
                      (mín: {variation.stock_minimo})
                    </span>
                    {variation.stock_actual <= variation.stock_minimo && (
                      <AlertTriangle className="w-3 h-3 text-red-500 ml-1" />
                    )}
                  </div>
                </div>
                {variation.codigo_barras && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center text-gray-600">
                      <Barcode className="w-3 h-3 mr-1" />
                      Código:
                    </span>
                    <span className="font-mono text-xs">{variation.codigo_barras}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Estado:</span>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    variation.estado === 'activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}>
                    {variation.estado}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="border border-gray-300 rounded-lg p-6 bg-white shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-lg font-medium text-gray-900">
              {editingVariation ? 'Editar Variación' : 'Nueva Variación'}
            </h4>
            <button
              type="button"
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600 text-xl font-bold"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Talla *
                </label>
                <select
                  name="talla"
                  value={formData.talla}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  disabled={submitting}
                >
                  <option value="">Seleccionar talla</option>
                  {getSizeOptions().map(size => (
                    <option key={size} value={size}>{size}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color *
                </label>
                <select
                  name="color"
                  value={formData.color}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  disabled={submitting}
                >
                  <option value="">Seleccionar color</option>
                  {COLORS.map(color => (
                    <option key={color} value={color}>{color}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Precio de Venta (€) *
                </label>
                <input
                  type="number"
                  name="precio"
                  value={formData.precio}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="89.99"
                  required
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Precio de Compra (€)
                </label>
                <input
                  type="number"
                  name="precio_compra"
                  value={formData.precio_compra}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="45.00"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  IVA (%) *
                </label>
                <input
                  type="number"
                  name="iva_percentage"
                  value={formData.iva_percentage}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0"
                  max="100"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="21.00"
                  required
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stock Actual
                </label>
                <input
                  type="number"
                  name="stock_actual"
                  value={formData.stock_actual}
                  onChange={handleInputChange}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="15"
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stock Mínimo
                </label>
                <input
                  type="number"
                  name="stock_minimo"
                  value={formData.stock_minimo}
                  onChange={handleInputChange}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="5"
                  disabled={submitting}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Código de Barras
              </label>
              <input
                type="text"
                name="codigo_barras"
                value={formData.codigo_barras}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="1234567890123"
                disabled={submitting}
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Guardando...' : editingVariation ? 'Actualizar' : 'Añadir'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
