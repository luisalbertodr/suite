import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Trash2, Barcode } from 'lucide-react';
import { ArticleSearch } from './ArticleSearch';
import { BarcodeScanner } from './BarcodeScanner';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useQuery } from '@tanstack/react-query';

interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percentage: number;
  iva_percentage: number;
  re_percentage: number;
  subtotal_after_discount: number;
  iva_amount: number;
  re_amount: number;
  total_price: number;
  variation_id?: string;
  article_id?: string;
}

interface Article {
  id: string;
  codigo: string;
  descripcion: string;
  precio: number;
  iva_percentage?: number;
  codigo_barras?: string;
}

interface InvoiceItemRowProps {
  item: InvoiceItem;
  index: number;
  onUpdate: (index: number, field: keyof InvoiceItem, value: string | number) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
  customerRePercentage: number;
  isIntracomunitario: boolean;
}

export const InvoiceItemRow: React.FC<InvoiceItemRowProps> = ({
  item,
  index,
  onUpdate,
  onRemove,
  canRemove,
  customerRePercentage,
  isIntracomunitario
}) => {
  const [showArticleSearch, setShowArticleSearch] = useState(false);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showArticleDropdown, setShowArticleDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { companyId } = useCompanyFilter();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debug logging for props changes
  useEffect(() => {
    console.log('InvoiceItemRow props changed for index:', index);
    console.log('Item data:', item);
  }, [item, index]);

  // Search articles in real-time as user types
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['articles-search-realtime', searchTerm, companyId],
    queryFn: async () => {
      if (!companyId || !searchTerm || searchTerm.length < 2) {
        return [];
      }

      const { data, error } = await supabase
        .from('articles')
        .select('id, codigo, descripcion, precio, iva_percentage, codigo_barras')
        .eq('company_id', companyId)
        .eq('estado', 'activo')
        .or(`descripcion.ilike.%${searchTerm}%,codigo.ilike.%${searchTerm}%,codigo_barras.ilike.%${searchTerm}%`)
        .limit(5);

      if (error) throw error;
      return data as Article[];
    },
    enabled: !!companyId && searchTerm.length >= 2,
  });

  // Calculate totals when relevant fields change
  useEffect(() => {
    const subtotal = item.quantity * item.unit_price;
    const discountAmount = subtotal * (item.discount_percentage / 100);
    const subtotalAfterDiscount = subtotal - discountAmount;
    
    let ivaAmount = 0;
    let reAmount = 0;
    
    if (!isIntracomunitario) {
      ivaAmount = subtotalAfterDiscount * (item.iva_percentage / 100);
      reAmount = subtotalAfterDiscount * (item.re_percentage / 100);
    }
    
    const totalPrice = subtotalAfterDiscount + ivaAmount + reAmount;

    // Update calculated fields
    if (item.subtotal_after_discount !== subtotalAfterDiscount) {
      onUpdate(index, 'subtotal_after_discount', subtotalAfterDiscount);
    }
    if (item.iva_amount !== ivaAmount) {
      onUpdate(index, 'iva_amount', ivaAmount);
    }
    if (item.re_amount !== reAmount) {
      onUpdate(index, 're_amount', reAmount);
    }
    if (item.total_price !== totalPrice) {
      onUpdate(index, 'total_price', totalPrice);
    }
  }, [item.quantity, item.unit_price, item.discount_percentage, item.iva_percentage, item.re_percentage, isIntracomunitario, customerRePercentage, index, onUpdate, item.subtotal_after_discount, item.iva_amount, item.re_amount, item.total_price]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowArticleDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleAddArticle = (article: Article) => {
    console.log('Adding article from modal search:', article);
    applyArticleToItem(article);
    setShowArticleSearch(false);
  };

  const applyArticleToItem = (article: Article) => {
    console.log('=== APPLYING ARTICLE TO ITEM ===');
    console.log('Article data:', article);
    console.log('Current item before update:', item);
    console.log('Index:', index);
    console.log('onUpdate function type:', typeof onUpdate);
    
    // Force re-render by updating description first
    onUpdate(index, 'description', article.descripcion);
    
    // Use setTimeout to ensure state updates are processed
    setTimeout(() => {
      onUpdate(index, 'unit_price', Number(article.precio || 0));
      onUpdate(index, 'iva_percentage', Number(article.iva_percentage || 21));
      onUpdate(index, 're_percentage', Number(customerRePercentage || 0));
      
      if (article.id) {
        onUpdate(index, 'article_id', article.id);
      }
      
      console.log('=== ARTICLE APPLICATION COMPLETE ===');
    }, 0);
  };

  const selectArticleFromDropdown = (article: Article) => {
    console.log('=== SELECTING ARTICLE FROM DROPDOWN ===');
    console.log('Article data:', article);
    console.log('Index:', index);
    
    applyArticleToItem(article);
    
    // Clear search state
    setSearchTerm('');
    setShowArticleDropdown(false);
    
    console.log('=== ARTICLE SELECTION COMPLETE ===');
  };

  const handleDescriptionChange = (value: string) => {
    console.log('Description input changed:', value);
    onUpdate(index, 'description', value);
    setSearchTerm(value);
    
    if (value.length >= 2) {
      setShowArticleDropdown(true);
    } else {
      setShowArticleDropdown(false);
    }
  };

  const handleInputFocus = () => {
    if (item.description.length >= 2) {
      setSearchTerm(item.description);
      setShowArticleDropdown(true);
    }
  };

  const handleKeyPress = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const barcode = item.description.trim();
      if (barcode) {
        console.log('Searching for barcode:', barcode);
        await searchArticleByBarcode(barcode);
      }
    }
  };

  const searchArticleByBarcode = async (barcode: string) => {
    try {
      console.log('Searching for article with barcode:', barcode);
      
      // First, try to find in articles table
      const { data: articles, error: articlesError } = await supabase
        .from('articles')
        .select('*')
        .eq('company_id', companyId)
        .eq('codigo_barras', barcode)
        .eq('estado', 'activo')
        .limit(1);

      if (articlesError) {
        console.error('Error searching articles:', articlesError);
        return;
      }

      if (articles && articles.length > 0) {
        const article = articles[0];
        console.log('Found article:', article);
        applyArticleToItem(article);
        return;
      }

      // If not found in articles, try article variations
      const { data: variations, error: variationError } = await supabase
        .from('article_variations')
        .select(`
          *,
          articles!inner(*)
        `)
        .eq('codigo_barras', barcode)
        .eq('estado', 'activo')
        .limit(1);

      if (variationError) {
        console.error('Error searching variations:', variationError);
        return;
      }

      if (variations && variations.length > 0) {
        const variation = variations[0];
        console.log('Found variation:', variation);
        onUpdate(index, 'description', `${variation.articles.descripcion} - ${variation.talla} ${variation.color}`);
        onUpdate(index, 'unit_price', variation.precio);
        onUpdate(index, 'iva_percentage', variation.iva_percentage || 21);
        onUpdate(index, 're_percentage', customerRePercentage);
        onUpdate(index, 'variation_id', variation.id);
        onUpdate(index, 'article_id', variation.articles.id);
        return;
      }

      console.log('No article found with barcode:', barcode);
    } catch (error) {
      console.error('Error searching article by barcode:', error);
    }
  };

  const handleBarcodeDetected = async (barcode: string) => {
    await searchArticleByBarcode(barcode);
    setShowBarcodeScanner(false);
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-8 gap-4 items-end p-4 border rounded-lg">
        <div className="md:col-span-2 relative">
          <Label>Descripción</Label>
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                value={item.description}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                onFocus={handleInputFocus}
                onKeyPress={handleKeyPress}
                placeholder="Descripción del artículo o código de barras"
                className="flex-1"
              />
              
              {/* Real-time search dropdown */}
              {showArticleDropdown && searchResults && searchResults.length > 0 && (
                <div 
                  ref={dropdownRef}
                  className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto"
                >
                  {searchResults.map((article) => (
                    <div
                      key={article.id}
                      className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        selectArticleFromDropdown(article);
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 text-sm">
                            {article.descripcion}
                          </div>
                          <div className="text-xs text-gray-500">
                            Código: {article.codigo}
                            {article.codigo_barras && ` • CB: ${article.codigo_barras}`}
                          </div>
                        </div>
                        <span className="font-semibold text-blue-600 text-sm">
                          €{article.precio.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {showArticleDropdown && isSearching && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg p-3">
                  <div className="text-center text-gray-500 text-sm">
                    Buscando artículos...
                  </div>
                </div>
              )}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowArticleSearch(true)}
              title="Buscar artículo"
            >
              🔍
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowBarcodeScanner(true)}
              title="Escanear código de barras"
            >
              <Barcode className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        <div>
          <Label>Cantidad</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={item.quantity}
            onChange={(e) => onUpdate(index, 'quantity', parseFloat(e.target.value) || 0)}
          />
        </div>
        
        <div>
          <Label>Precio Unit.</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={item.unit_price}
            onChange={(e) => onUpdate(index, 'unit_price', parseFloat(e.target.value) || 0)}
          />
        </div>
        
        <div>
          <Label>Desc. %</Label>
          <Input
            type="number"
            min="0"
            max="100"
            step="0.01"
            value={item.discount_percentage}
            onChange={(e) => onUpdate(index, 'discount_percentage', parseFloat(e.target.value) || 0)}
          />
        </div>
        
        <div>
          <Label>IVA %</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={item.iva_percentage}
            onChange={(e) => onUpdate(index, 'iva_percentage', parseFloat(e.target.value) || 0)}
            disabled={isIntracomunitario}
          />
        </div>
        
        <div>
          <Label>RE %</Label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={item.re_percentage}
            onChange={(e) => onUpdate(index, 're_percentage', parseFloat(e.target.value) || 0)}
            disabled={isIntracomunitario}
          />
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="flex-1">
            <Label>Total</Label>
            <div className="px-3 py-2 bg-gray-50 border rounded-md text-right font-medium">
              €{item.total_price.toFixed(2)}
            </div>
          </div>
          {canRemove && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onRemove(index)}
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
        
        {isIntracomunitario && (
          <div className="md:col-span-8 text-sm text-blue-600 font-medium">
            Intracomunitario exento (Bienes)
          </div>
        )}
      </div>

      {showArticleSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-4xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Buscar Artículo</h3>
              <Button
                variant="ghost"
                onClick={() => setShowArticleSearch(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </Button>
            </div>
            <ArticleSearch onAddArticle={handleAddArticle} />
          </div>
        </div>
      )}

      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onBarcodeDetected={handleBarcodeDetected}
        onClose={() => setShowBarcodeScanner(false)}
      />
    </>
  );
};
