
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2 } from 'lucide-react';
import { ArticleDescriptionInput } from './ArticleDescriptionInput';

interface DeliveryNoteItem {
  id?: string;
  article_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface Article {
  id: string;
  codigo: string;
  descripcion: string;
  precio_compra: number;
  precio: number;
  stock_actual: number;
}

interface DeliveryNote {
  subtotal: number;
  tax_amount: number;
  total_amount: number;
}

interface DeliveryNoteItemsProps {
  items: DeliveryNoteItem[];
  articles: Article[];
  formData: DeliveryNote;
  handleItemChange: (index: number, field: keyof DeliveryNoteItem, value: any, articles: Article[]) => void;
  addItem: () => void;
  removeItem: (index: number) => void;
}

export const DeliveryNoteItems: React.FC<DeliveryNoteItemsProps> = ({
  items,
  articles,
  formData,
  handleItemChange,
  addItem,
  removeItem
}) => {
  const handleArticleSelect = (index: number, article: Article) => {
    console.log('DeliveryNoteItems - Article selected for index', index, ':', article);
    
    // Crear una copia del item actual
    const currentItem = items[index];
    const currentQuantity = currentItem?.quantity || 1;
    
    // Actualizar el item con toda la información del artículo de una vez
    const updatedItem = {
      ...currentItem,
      article_id: article.id,
      description: article.descripcion,
      unit_price: article.precio || 0,
      total_price: currentQuantity * (article.precio || 0)
    };
    
    console.log('DeliveryNoteItems - Updated item:', updatedItem);
    
    // Hacer una sola llamada para actualizar todo el item
    handleItemChange(index, 'article_id', article.id, articles);
    // Dar un pequeño delay para evitar conflictos
    setTimeout(() => {
      handleItemChange(index, 'unit_price', article.precio || 0, articles);
    }, 10);
  };

  const handleQuantityChange = (index: number, newQuantity: number) => {
    console.log('DeliveryNoteItems - Quantity changed for index', index, ':', newQuantity);
    handleItemChange(index, 'quantity', newQuantity, articles);
  };

  const handleUnitPriceChange = (index: number, newPrice: number) => {
    console.log('DeliveryNoteItems - Unit price changed for index', index, ':', newPrice);
    handleItemChange(index, 'unit_price', newPrice, articles);
  };

  const handleDescriptionChange = (index: number, newDescription: string) => {
    console.log('DeliveryNoteItems - Description changed for index', index, ':', newDescription);
    handleItemChange(index, 'description', newDescription, articles);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Artículos</CardTitle>
          <Button type="button" onClick={addItem} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            Añadir Artículo
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={index} className="flex gap-2 p-4 border rounded-lg items-end">
              <div className="flex-1">
                <Label>Descripción del Artículo</Label>
                <ArticleDescriptionInput
                  value={item.description || ''}
                  onChange={(value) => handleDescriptionChange(index, value)}
                  onArticleSelect={(article) => handleArticleSelect(index, article)}
                  articles={articles}
                  placeholder="Descripción del producto"
                />
              </div>
              
              <div className="w-16">
                <Label>Cantidad</Label>
                <Input 
                  type="text"
                  defaultValue={item.quantity.toString()}
                  onChange={e => {
                    const value = e.target.value;
                    // Permitir escribir punto decimal y números
                    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                      // Solo actualizar si es un número válido completo
                      if (value !== '' && !value.endsWith('.')) {
                        const numValue = parseFloat(value) || 0;
                        handleQuantityChange(index, numValue);
                      }
                    } else {
                      // Revertir el valor si no es válido
                      e.target.value = item.quantity.toString();
                    }
                  }}
                  onBlur={e => {
                    const value = e.target.value;
                    const numValue = parseFloat(value) || 0;
                    handleQuantityChange(index, Math.round(numValue * 100) / 100);
                    e.target.value = (Math.round(numValue * 100) / 100).toString();
                  }}
                  onFocus={e => e.target.select()} 
                  className="w-16" 
                  placeholder="0"
                />
              </div>
              
              <div className="w-20">
                <Label>Precio Unit.</Label>
                <Input 
                  type="text"
                  defaultValue={item.unit_price.toString()}
                  onChange={e => {
                    const value = e.target.value;
                    // Permitir escribir punto decimal y números
                    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                      // Solo actualizar si es un número válido completo
                      if (value !== '' && !value.endsWith('.')) {
                        const numValue = parseFloat(value) || 0;
                        handleUnitPriceChange(index, numValue);
                      }
                    } else {
                      // Revertir el valor si no es válido
                      e.target.value = item.unit_price.toString();
                    }
                  }}
                  onBlur={e => {
                    const value = e.target.value;
                    const numValue = parseFloat(value) || 0;
                    handleUnitPriceChange(index, Math.round(numValue * 100) / 100);
                    e.target.value = (Math.round(numValue * 100) / 100).toString();
                  }}
                  onFocus={e => e.target.select()} 
                  className="w-20" 
                  placeholder="0"
                />
              </div>
              
              <div className="w-20">
                <Label>Total</Label>
                <Input value={item.total_price.toFixed(2)} readOnly className="bg-muted w-20" />
              </div>
              
              {items.length > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => removeItem(index)}
                  className="text-destructive hover:bg-destructive/10"
                  title="Eliminar artículo"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="mt-6 border-t pt-6">
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between">
                <span>Base Imponible:</span>
                <span>{(formData.subtotal || 0).toFixed(2)} €</span>
              </div>
              <div className="flex justify-between">
                <span>IVA (21%):</span>
                <span>{(formData.tax_amount || 0).toFixed(2)} €</span>
              </div>
              <div className="flex justify-between font-bold text-lg border-t pt-2">
                <span>Total:</span>
                <span>{(formData.total_amount || 0).toFixed(2)} €</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
