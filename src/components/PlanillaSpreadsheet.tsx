import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Save, Plus, Trash2, Download, Upload } from 'lucide-react';
import { PlanillaItem } from '@/hooks/usePlanillas';
import { useColors } from '@/hooks/useColors';
import { usePlanillaItems } from '@/hooks/usePlanillaItems';
import { toast } from 'sonner';

interface PlanillaSpreadsheetProps {
  planillaId: string;
  onClose: () => void;
}

const SIZE_COLUMNS = Array.from({ length: 31 }, (_, i) => i + 16); // 16 to 46

export const PlanillaSpreadsheet: React.FC<PlanillaSpreadsheetProps> = ({
  planillaId,
  onClose,
}) => {
  const { items: existingItems, loading: itemsLoading, saveItems, isSaving } = usePlanillaItems(planillaId);
  const { colors, addColor } = useColors();
  const [items, setItems] = useState<PlanillaItem[]>([]);
  const [newColorName, setNewColorName] = useState('');
  const hasInitialized = useRef(false);
  const currentPlanillaId = useRef(planillaId);

  const createEmptyItem = useCallback((): PlanillaItem => ({
    articulo: '',
    color: '',
    precio: 0,
    descripcion: '',
    ...SIZE_COLUMNS.reduce((acc, size) => ({
      ...acc,
      [`talla_${size}`]: 0,
    }), {}),
  }), []);

  // Reset initialization when planilla ID changes
  useEffect(() => {
    if (currentPlanillaId.current !== planillaId) {
      console.log('Planilla ID changed, resetting initialization');
      hasInitialized.current = false;
      currentPlanillaId.current = planillaId;
    }
  }, [planillaId]);

  // Initialize items when data is loaded
  useEffect(() => {
    console.log('useEffect called - itemsLoading:', itemsLoading, 'hasInitialized:', hasInitialized.current, 'existingItems:', existingItems.length);
    
    if (itemsLoading) {
      console.log('Still loading, waiting...');
      return;
    }

    if (hasInitialized.current && items.length > 0) {
      console.log('Already initialized with items, skipping');
      return;
    }

    console.log('Initializing planilla items, existing items:', existingItems.length);
    
    if (existingItems.length > 0) {
      setItems(existingItems);
      console.log('Items set from existing data:', existingItems.length);
    } else {
      setItems([createEmptyItem()]);
      console.log('Created single empty item');
    }
    
    hasInitialized.current = true;
  }, [existingItems, itemsLoading, createEmptyItem, items.length]);

  const addRow = () => {
    console.log('Adding new row');
    setItems(prev => [...prev, createEmptyItem()]);
  };

  const removeRow = (index: number) => {
    if (items.length > 1) {
      console.log('Removing row at index:', index);
      setItems(prev => prev.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: string, value: any) => {
    console.log('Updating item at index:', index, 'field:', field, 'value:', value);
    setItems(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  const handleInputFocus = (event: React.FocusEvent<HTMLInputElement>) => {
    event.target.select();
  };

  const handleSave = async () => {
    try {
      console.log('Attempting to save items:', items.length);
      
      // Validate items - solo validar que tengan artículo y color
      const validItems = items.filter(item => 
        item.articulo.trim() && item.color.trim()
      );

      console.log('Valid items to save:', validItems.length);

      if (validItems.length === 0) {
        toast.error('Debe agregar al menos un artículo válido con nombre y color');
        return;
      }

      // Log the items being saved
      validItems.forEach((item, index) => {
        console.log(`Item ${index + 1}:`, {
          articulo: item.articulo,
          color: item.color,
          precio: item.precio,
          sizes: SIZE_COLUMNS.map(size => `${size}: ${(item as any)[`talla_${size}`] || 0}`).join(', ')
        });
      });

      await saveItems(validItems);
      
      // Reset initialization to allow reload of saved data
      hasInitialized.current = false;
      console.log('Save completed, reset initialization flag');
      
      toast.success('Planilla guardada exitosamente');
    } catch (error) {
      console.error('Error saving planilla:', error);
      toast.error('Error al guardar la planilla');
    }
  };

  const exportToCSV = () => {
    const headers = ['Artículo', 'Color', 'Precio', 'Descripción', ...SIZE_COLUMNS.map(size => `Talla ${size}`)];
    const csvContent = [
      headers.join(','),
      ...items.map(item => [
        `"${item.articulo}"`,
        `"${item.color}"`,
        item.precio,
        `"${item.descripcion || ''}"`,
        ...SIZE_COLUMNS.map(size => (item as any)[`talla_${size}`] || 0)
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `planilla_${planillaId}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const importFromCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        
        const importedItems: PlanillaItem[] = lines.slice(1)
          .filter(line => line.trim())
          .map(line => {
            const values = line.split(',').map(v => v.replace(/"/g, ''));
            const item: PlanillaItem = {
              articulo: values[0] || '',
              color: values[1] || '',
              precio: parseFloat(values[2]) || 0,
              descripcion: values[3] || '',
            };

            // Map size columns
            SIZE_COLUMNS.forEach((size, index) => {
              const value = parseInt(values[4 + index]) || 0;
              (item as any)[`talla_${size}`] = value;
            });

            return item;
          });

        if (importedItems.length > 0) {
          setItems(importedItems);
          toast.success(`Importados ${importedItems.length} artículos`);
        }
      } catch (error) {
        console.error('Error importing CSV:', error);
        toast.error('Error al importar el archivo CSV');
      }
    };
    reader.readAsText(file);
    
    // Reset input value to allow re-importing the same file
    event.target.value = '';
  };

  const addNewColor = async () => {
    if (newColorName.trim()) {
      try {
        await addColor(newColorName.trim());
        setNewColorName('');
        toast.success('Color agregado exitosamente');
      } catch (error) {
        console.error('Error adding color:', error);
        toast.error('Error al agregar el color');
      }
    }
  };

  const getTotalQuantity = (item: PlanillaItem) => {
    return SIZE_COLUMNS.reduce((total, size) => {
      return total + ((item as any)[`talla_${size}`] as number || 0);
    }, 0);
  };

  if (itemsLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando planilla...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 p-4 flex items-center justify-between bg-gray-50">
        <h1 className="text-xl font-semibold text-gray-900">
          Editor de Planilla
        </h1>
        <div className="flex items-center space-x-3">
          <label className="cursor-pointer">
            <input
              type="file"
              accept=".csv"
              onChange={importFromCSV}
              className="hidden"
            />
            <div className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              <Upload className="w-4 h-4" />
              <span>Importar CSV</span>
            </div>
          </label>
          <button
            onClick={exportToCSV}
            className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Exportar CSV</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {isSaving ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isSaving ? 'Guardando...' : 'Guardar'}</span>
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>

      {/* Color Management */}
      <div className="border-b border-gray-200 p-4 bg-gray-50">
        <div className="flex items-center space-x-4">
          <span className="text-sm font-medium text-gray-700">Colores disponibles:</span>
          <div className="flex flex-wrap gap-2">
            {colors.map(color => (
              <span
                key={color.id}
                className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
              >
                {color.name}
              </span>
            ))}
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={newColorName}
              onChange={(e) => setNewColorName(e.target.value)}
              placeholder="Nuevo color"
              className="px-2 py-1 border border-gray-300 rounded text-sm"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  addNewColor();
                }
              }}
            />
            <button
              onClick={addNewColor}
              disabled={!newColorName.trim()}
              className="px-2 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              Agregar
            </button>
          </div>
        </div>
      </div>

      {/* Spreadsheet */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-max">
          <table className="w-full border-collapse">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="border border-gray-300 px-2 py-2 text-xs font-medium text-gray-700 w-8">#</th>
                <th className="border border-gray-300 px-2 py-2 text-xs font-medium text-gray-700 w-32">Artículo</th>
                <th className="border border-gray-300 px-2 py-2 text-xs font-medium text-gray-700 w-24">Color</th>
                <th className="border border-gray-300 px-2 py-2 text-xs font-medium text-gray-700 w-20">Precio</th>
                <th className="border border-gray-300 px-2 py-2 text-xs font-medium text-gray-700 w-32">Descripción</th>
                {SIZE_COLUMNS.map(size => (
                  <th key={size} className="border border-gray-300 px-1 py-2 text-xs font-medium text-gray-700 w-12">
                    {size}
                  </th>
                ))}
                <th className="border border-gray-300 px-2 py-2 text-xs font-medium text-gray-700 w-16">Total</th>
                <th className="border border-gray-300 px-2 py-2 text-xs font-medium text-gray-700 w-12">Acc.</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="border border-gray-300 px-2 py-1 text-center text-xs text-gray-500">
                    {index + 1}
                  </td>
                  <td className="border border-gray-300 p-0">
                    <input
                      type="text"
                      value={item.articulo}
                      onChange={(e) => updateItem(index, 'articulo', e.target.value)}
                      onFocus={handleInputFocus}
                      className="w-full border-none outline-none px-2 py-1 text-xs"
                      placeholder="Nombre del artículo"
                    />
                  </td>
                  <td className="border border-gray-300 p-0">
                    <select
                      value={item.color}
                      onChange={(e) => updateItem(index, 'color', e.target.value)}
                      className="w-full border-none outline-none px-2 py-1 text-xs"
                    >
                      <option value="">Seleccionar</option>
                      {colors.map(color => (
                        <option key={color.id} value={color.name}>
                          {color.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="border border-gray-300 p-0">
                    <input
                      type="number"
                      value={item.precio}
                      onChange={(e) => updateItem(index, 'precio', parseFloat(e.target.value) || 0)}
                      onFocus={handleInputFocus}
                      className="w-full border-none outline-none px-2 py-1 text-xs"
                      min="0"
                      step="0.01"
                    />
                  </td>
                  <td className="border border-gray-300 p-0">
                    <input
                      type="text"
                      value={item.descripcion || ''}
                      onChange={(e) => updateItem(index, 'descripcion', e.target.value)}
                      onFocus={handleInputFocus}
                      className="w-full border-none outline-none px-2 py-1 text-xs"
                      placeholder="Descripción"
                    />
                  </td>
                  {SIZE_COLUMNS.map(size => (
                    <td key={size} className="border border-gray-300 p-0">
                      <input
                        type="number"
                        value={(item as any)[`talla_${size}`] as number || 0}
                        onChange={(e) => updateItem(index, `talla_${size}`, parseInt(e.target.value) || 0)}
                        onFocus={handleInputFocus}
                        className="w-full border-none outline-none px-1 py-1 text-xs text-center"
                        min="0"
                      />
                    </td>
                  ))}
                  <td className="border border-gray-300 px-2 py-1 text-xs text-center font-medium">
                    {getTotalQuantity(item)}
                  </td>
                  <td className="border border-gray-300 px-1 py-1 text-center">
                    <button
                      onClick={() => removeRow(index)}
                      className="text-red-600 hover:text-red-800 p-1"
                      disabled={items.length <= 1}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 p-4 bg-gray-50">
        <button
          onClick={addRow}
          className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>Agregar Fila</span>
        </button>
      </div>
    </div>
  );
};
