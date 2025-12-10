import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Minus, ShoppingCart, CreditCard, Calculator, Receipt, Search, History, Package, Scan, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SalesHistory } from './SalesHistory';
import { BarcodeScanner } from './BarcodeScanner';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
  variationId?: string;
  size?: string;
  color?: string;
}

interface Article {
  id: string;
  descripcion: string;
  precio: number;
  stock_actual: number;
  codigo: string;
  foto_url: string | null;
  tipo_producto: 'textil' | 'calzado' | 'standard';
  codigo_barras?: string;
}

interface ArticleVariation {
  id: string;
  article_id: string;
  talla: string;
  color: string;
  stock_actual: number;
  precio: number;
  codigo_barras?: string;
  estado: 'activo' | 'inactivo';
}

export const TPV: React.FC = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showVariations, setShowVariations] = useState<string | null>(null);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { companyId, loading: companyLoading } = useCompanyFilter();

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['tpv-articles', searchTerm, companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      console.log('Searching articles with term:', searchTerm);
      
      let query = supabase
        .from('articles')
        .select('id, descripcion, precio, stock_actual, codigo, foto_url, tipo_producto, codigo_barras')
        .eq('estado', 'activo')
        .eq('company_id', companyId)
        .order('descripcion');

      if (searchTerm.trim()) {
        const searchPattern = `%${searchTerm.trim()}%`;
        query = query.or(`descripcion.ilike.${searchPattern},codigo.ilike.${searchPattern}`);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching articles:', error);
        throw error;
      }
      
      console.log('Articles found:', data?.length || 0, data);
      return data as Article[];
    },
    enabled: !!companyId
  });

  const { data: variations = [] } = useQuery({
    queryKey: ['article-variations', showVariations],
    queryFn: async () => {
      if (!showVariations) return [];
      
      const { data, error } = await supabase
        .from('article_variations')
        .select('*')
        .eq('article_id', showVariations)
        .eq('estado', 'activo')
        .order('talla', { ascending: true });

      if (error) {
        console.error('Error fetching variations:', error);
        throw error;
      }
      
      return data as ArticleVariation[];
    },
    enabled: !!showVariations
  });

  const processSaleMutation = useMutation({
    mutationFn: async (saleData: {
      items: CartItem[];
      total: number;
      paymentMethod: string;
      amountPaid: number;
      change: number;
    }) => {
      console.log('=== STARTING SALE PROCESSING ===');
      console.log('Sale data:', JSON.stringify(saleData, null, 2));
      console.log('Company ID:', companyId);
      
      if (!companyId) {
        console.error('❌ No company ID available');
        throw new Error('No company ID available');
      }

      // Validate required data
      if (!saleData.items || saleData.items.length === 0) {
        console.error('❌ No items in cart');
        throw new Error('No items in cart');
      }

      if (saleData.total <= 0) {
        console.error('❌ Invalid total amount');
        throw new Error('Invalid total amount');
      }

      // Calculate tax properly (assuming 21% VAT)
      const subtotal = Number((saleData.total / 1.21).toFixed(2));
      const taxAmount = Number((saleData.total - subtotal).toFixed(2));

      console.log('💰 Financial calculations:', {
        total: saleData.total,
        subtotal: subtotal,
        taxAmount: taxAmount
      });

      const saleRecord = {
        company_id: companyId,
        ticket_number: '', // Empty string to trigger auto-generation
        total_amount: saleData.total,
        subtotal: subtotal,
        tax_amount: taxAmount,
        payment_method: saleData.paymentMethod,
        amount_paid: saleData.amountPaid || 0,
        change_amount: saleData.change || 0,
        status: 'completed' as const,
        currency: 'EUR',
        customer_name: null,
        customer_email: null,
        customer_phone: null,
        notes: null
      };

      console.log('💾 Creating sale record:', JSON.stringify(saleRecord, null, 2));

      // Create the sale
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert(saleRecord)
        .select()
        .single();

      if (saleError) {
        console.error('❌ Error creating sale:', saleError);
        console.error('Error details:', {
          code: saleError.code,
          message: saleError.message,
          details: saleError.details,
          hint: saleError.hint
        });
        throw new Error(`Error creating sale: ${saleError.message}`);
      }

      if (!sale) {
        console.error('❌ No sale data returned');
        throw new Error('No sale data returned from database');
      }

      console.log('✅ Sale created successfully:', sale);

      // Create sale items
      const saleItems = saleData.items.map(item => {
        const saleItem = {
          sale_id: sale.id,
          article_id: item.variationId ? null : item.id,
          variation_id: item.variationId || null,
          description: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.total
        };
        console.log('📦 Creating sale item:', saleItem);
        return saleItem;
      });

      console.log('📦 Creating sale items:', JSON.stringify(saleItems, null, 2));

      const { data: createdItems, error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems)
        .select();

      if (itemsError) {
        console.error('❌ Error creating sale items:', itemsError);
        console.error('Items error details:', {
          code: itemsError.code,
          message: itemsError.message,
          details: itemsError.details,
          hint: itemsError.hint
        });
        throw new Error(`Error creating sale items: ${itemsError.message}`);
      }

      console.log('✅ Sale items created successfully:', createdItems);
      console.log('=== SALE PROCESSING COMPLETED ===');
      
      return sale;
    },
    onSuccess: (sale) => {
      console.log('🎉 Sale processing successful:', sale);
      setCart([]);
      setAmountPaid('');
      toast({
        title: "✅ Venta procesada",
        description: `Ticket ${sale.ticket_number} creado correctamente.`,
      });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
    onError: (error) => {
      console.error('💥 Sale processing failed:', error);
      toast({
        title: "❌ Error al procesar venta",
        description: error.message || "Ha ocurrido un error al procesar la venta. Inténtelo de nuevo.",
        variant: "destructive"
      });
    }
  });

  const handleBarcodeSearch = async (barcode: string) => {
    if (!barcode.trim() || !companyId) return;

    console.log('Searching for barcode:', barcode);

    try {
      const { data: articleData, error: articleError } = await supabase
        .from('articles')
        .select('id, descripcion, precio, stock_actual, codigo, foto_url, tipo_producto, codigo_barras')
        .eq('codigo_barras', barcode.trim())
        .eq('estado', 'activo')
        .eq('company_id', companyId)
        .maybeSingle();

      if (articleError) {
        console.error('Error searching article by barcode:', articleError);
      }

      if (articleData) {
        console.log('Found article by barcode:', articleData);
        addToCart(articleData as Article);
        setBarcodeInput('');
        toast({
          title: "Producto agregado",
          description: `${articleData.descripcion} agregado al carrito`
        });
        return;
      }

      const { data: variationData, error: variationError } = await supabase
        .from('article_variations')
        .select(`
          id,
          article_id,
          talla,
          color,
          stock_actual,
          precio,
          codigo_barras,
          estado,
          articles!inner (
            id,
            descripcion,
            tipo_producto,
            company_id
          )
        `)
        .eq('codigo_barras', barcode.trim())
        .eq('estado', 'activo')
        .eq('articles.company_id', companyId)
        .maybeSingle();

      if (variationError) {
        console.error('Error searching variation by barcode:', variationError);
      }

      if (variationData && variationData.articles) {
        console.log('Found variation by barcode:', variationData);
        const article = variationData.articles as any;
        const variation = {
          id: variationData.id,
          article_id: variationData.article_id,
          talla: variationData.talla,
          color: variationData.color,
          stock_actual: variationData.stock_actual,
          precio: variationData.precio,
          codigo_barras: variationData.codigo_barras,
          estado: variationData.estado
        } as ArticleVariation;

        addVariationToCart(variation, article);
        setBarcodeInput('');
        toast({
          title: "Producto agregado",
          description: `${article.descripcion} - ${variation.talla} ${variation.color} agregado al carrito`
        });
        return;
      }

      toast({
        title: "Producto no encontrado",
        description: `No se encontró ningún producto con el código de barras: ${barcode}`,
        variant: "destructive"
      });
      setBarcodeInput('');

    } catch (error) {
      console.error('Error in barcode search:', error);
      toast({
        title: "Error de búsqueda",
        description: "Ha ocurrido un error al buscar el producto",
        variant: "destructive"
      });
      setBarcodeInput('');
    }
  };

  const handleBarcodeKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleBarcodeSearch(barcodeInput);
    }
  };

  const handleBarcodeFromCamera = (barcode: string) => {
    console.log('Código de barras desde cámara:', barcode);
    handleBarcodeSearch(barcode);
  };

  const addToCart = (article: Article) => {
    if (article.tipo_producto !== 'standard' && article.stock_actual > 0) {
      setShowVariations(article.id);
      return;
    }

    if (article.stock_actual <= 0) {
      toast({
        title: "Advertencia",
        description: `El artículo "${article.descripcion}" no tiene stock disponible`,
        variant: "destructive"
      });
    }

    const existingItem = cart.find(item => item.id === article.id && !item.variationId);
    
    if (existingItem) {
      setCart(cart.map(item =>
        item.id === article.id && !item.variationId
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
          : item
      ));
    } else {
      setCart([...cart, {
        id: article.id,
        name: article.descripcion,
        price: article.precio || 0,
        quantity: 1,
        total: article.precio || 0
      }]);
    }
  };

  const addVariationToCart = (variation: ArticleVariation, article: Article) => {
    if (variation.stock_actual <= 0) {
      toast({
        title: "Advertencia",
        description: `La variación no tiene stock disponible`,
        variant: "destructive"
      });
    }

    const variationKey = `${article.id}-${variation.id}`;
    const existingItem = cart.find(item => item.variationId === variation.id);
    
    if (existingItem) {
      setCart(cart.map(item =>
        item.variationId === variation.id
          ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.price }
          : item
      ));
    } else {
      setCart([...cart, {
        id: article.id,
        variationId: variation.id,
        name: `${article.descripcion} - ${variation.talla} ${variation.color}`,
        price: variation.precio,
        quantity: 1,
        total: variation.precio,
        size: variation.talla,
        color: variation.color
      }]);
    }
    
    setShowVariations(null);
  };

  const updateQuantity = (id: string, variationId: string | undefined, newQuantity: number) => {
    if (newQuantity <= 0) {
      setCart(cart.filter(item => !(item.id === id && item.variationId === variationId)));
    } else {
      setCart(cart.map(item =>
        item.id === id && item.variationId === variationId
          ? { ...item, quantity: newQuantity, total: newQuantity * item.price }
          : item
      ));
    }
  };

  const getTotalAmount = () => {
    return cart.reduce((sum, item) => sum + item.total, 0);
  };

  const getChange = () => {
    const paid = parseFloat(amountPaid) || 0;
    const total = getTotalAmount();
    return Math.max(0, paid - total);
  };

  const processSale = () => {
    console.log('🚀 Starting sale process...');
    console.log('Cart contents:', cart);
    console.log('Company ID:', companyId);
    console.log('Payment method:', paymentMethod);
    console.log('Amount paid:', amountPaid);

    if (cart.length === 0) {
      console.warn('⚠️ Cart is empty');
      toast({
        title: "Carrito vacío",
        description: "Agrega productos al carrito antes de procesar la venta.",
        variant: "destructive"
      });
      return;
    }

    if (!companyId) {
      console.error('❌ No company ID');
      toast({
        title: "Error",
        description: "No se pudo obtener la información de la empresa.",
        variant: "destructive"
      });
      return;
    }

    const total = getTotalAmount();
    console.log('💰 Total amount:', total);

    if (paymentMethod === 'cash') {
      const paid = parseFloat(amountPaid) || 0;
      console.log('💵 Cash payment - Amount paid:', paid);
      if (paid < total) {
        console.warn('⚠️ Insufficient payment');
        toast({
          title: "Pago insuficiente",
          description: "El monto pagado es menor al total de la venta.",
          variant: "destructive"
        });
        return;
      }
    }

    console.log('✅ All validations passed, processing sale...');

    processSaleMutation.mutate({
      items: cart,
      total: total,
      paymentMethod,
      amountPaid: parseFloat(amountPaid) || 0,
      change: getChange()
    });
  };

  if (companyLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Cargando...</span>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-700">Sin empresa</h3>
          <p className="text-gray-500 mt-2">
            No se pudo obtener la información de la empresa.
          </p>
        </div>
      </div>
    );
  }

  if (showHistory) {
    return <SalesHistory onBack={() => setShowHistory(false)} />;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="flex justify-between items-center p-4 bg-white shadow-sm border-b">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <CreditCard className="w-6 h-6 mr-2 text-blue-600" />
            Terminal TPV
          </h1>
        </div>
        <Button
          onClick={() => setShowHistory(true)}
          variant="outline"
          size="sm"
        >
          <History className="w-4 h-4 mr-2" />
          Historial
        </Button>
      </div>

      <div className="bg-white border-b p-4">
        <div className="max-w-md">
          <Label htmlFor="barcode-input" className="text-sm font-medium flex items-center mb-2">
            <Scan className="w-4 h-4 mr-2" />
            Código de Barras
          </Label>
          <div className="flex space-x-2">
            <Input
              id="barcode-input"
              type="text"
              placeholder="Escanea o ingresa el código de barras..."
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyPress={handleBarcodeKeyPress}
              className="flex-1"
              autoComplete="off"
            />
            <Button
              onClick={() => setShowBarcodeScanner(true)}
              variant="outline"
              size="default"
              className="px-3"
            >
              <Camera className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Presiona Enter para buscar o usa la cámara para escanear
          </p>
        </div>
      </div>

      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onBarcodeDetected={handleBarcodeFromCamera}
      />

      {showVariations && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full m-4 max-h-96 overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Seleccionar Variación</h3>
              <Button
                variant="ghost"
                onClick={() => setShowVariations(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </Button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {variations.map((variation) => {
                const article = articles.find(a => a.id === showVariations);
                return (
                  <Card
                    key={variation.id}
                    className={`cursor-pointer hover:shadow-md transition-shadow ${
                      variation.stock_actual <= 0 ? 'bg-red-50 opacity-60' : 'hover:bg-blue-50'
                    }`}
                    onClick={() => article && addVariationToCart(variation, article)}
                  >
                    <CardContent className="p-3">
                      <div className="text-center">
                        <div className="flex space-x-1 justify-center mb-2">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                            {variation.talla}
                          </span>
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                            {variation.color}
                          </span>
                        </div>
                        <p className="text-sm font-bold text-blue-600">
                          €{variation.precio.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">
                          Stock: {variation.stock_actual}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 overflow-hidden pb-32">
        <div className="lg:col-span-2 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <Search className="w-5 h-5 mr-2" />
                Productos
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Buscar productos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-2">
              <div className="h-full overflow-y-auto">
                <div className="grid grid-cols-4 gap-2">
                  {isLoading ? (
                    <div className="col-span-full text-center py-8 text-gray-500">
                      Cargando productos...
                    </div>
                  ) : articles.length === 0 ? (
                    <div className="col-span-full text-center py-8 text-gray-500">
                      {searchTerm ? 'No se encontraron productos' : 'No hay productos disponibles'}
                    </div>
                  ) : (
                    articles.map((article) => (
                      <div 
                        key={article.id} 
                        className={`cursor-pointer hover:shadow-md transition-all duration-200 h-32 bg-white border border-gray-200 hover:border-blue-300 rounded-lg ${
                          article.stock_actual <= 0 ? 'bg-red-50 opacity-60' : 'hover:bg-blue-50'
                        }`}
                        onClick={() => addToCart(article)}
                      >
                        <div className="p-3 h-full flex flex-col justify-between">
                          <div className="flex-shrink-0 h-12 flex items-center justify-center mb-2">
                            {article.foto_url ? (
                              <img
                                src={article.foto_url}
                                alt={article.descripcion}
                                className="w-10 h-10 rounded-md object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-500 rounded-md flex items-center justify-center text-white">
                                <Package className="w-6 h-6" />
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-1 flex flex-col justify-center min-h-0 px-1">
                            <h3 className="font-medium text-xs leading-tight text-center overflow-hidden mb-1">
                              {article.descripcion.length > 20 
                                ? `${article.descripcion.substring(0, 20)}...` 
                                : article.descripcion
                              }
                            </h3>
                            {article.tipo_producto !== 'standard' && (
                              <p className="text-[10px] text-orange-600 text-center font-semibold">
                                {article.tipo_producto === 'textil' ? 'TEX' : 'CAL'}
                              </p>
                            )}
                          </div>
                          
                          <div className="text-center mt-2">
                            <p className="text-sm font-bold text-blue-600">
                              €{(article.precio || 0).toFixed(2)}
                            </p>
                            <p className="text-[10px] text-gray-500">
                              Stock: {article.stock_actual}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <ShoppingCart className="w-5 h-5 mr-2" />
                Carrito ({cart.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <div className="space-y-2 h-full overflow-y-auto">
                {cart.map((item, index) => (
                  <div key={`${item.id}-${item.variationId || 'no-variation'}-${index}`} className="flex items-center justify-between py-2 border-b border-gray-100">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-gray-500">€{item.price.toFixed(2)} c/u</p>
                      {item.variationId && (
                        <div className="flex space-x-1 mt-1">
                          <span className="inline-flex px-1 py-0.5 text-xs rounded bg-purple-100 text-purple-800">
                            {item.size}
                          </span>
                          <span className="inline-flex px-1 py-0.5 text-xs rounded bg-green-100 text-green-800">
                            {item.color}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-1 ml-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateQuantity(item.id, item.variationId, item.quantity - 1)}
                        className="h-6 w-6 p-0"
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-6 text-center text-sm">{item.quantity}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateQuantity(item.id, item.variationId, item.quantity + 1)}
                        className="h-6 w-6 p-0"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                    <div className="w-16 text-right ml-2">
                      <p className="text-sm font-medium">€{item.total.toFixed(2)}</p>
                    </div>
                  </div>
                ))}
              </div>
              
              {cart.length === 0 && (
                <div className="text-center py-8 text-gray-500 flex flex-col items-center justify-center h-full">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Carrito vacío</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 z-10">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <div className="flex space-x-2">
              <Button
                variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                onClick={() => setPaymentMethod('cash')}
                size="sm"
              >
                Efectivo
              </Button>
              <Button
                variant={paymentMethod === 'card' ? 'default' : 'outline'}
                onClick={() => setPaymentMethod('card')}
                size="sm"
              >
                Tarjeta
              </Button>
            </div>

            {paymentMethod === 'cash' && (
              <div className="flex items-center space-x-2">
                <Input
                  type="number"
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="Monto recibido"
                  className="w-32"
                />
                {amountPaid && (
                  <span className="text-sm text-gray-600 whitespace-nowrap">
                    Cambio: €{getChange().toFixed(2)}
                  </span>
                )}
              </div>
            )}

            <Button
              onClick={processSale}
              disabled={processSaleMutation.isPending || cart.length === 0}
              className="bg-green-600 hover:bg-green-700"
              size="lg"
            >
              <Receipt className="w-4 h-4 mr-2" />
              {processSaleMutation.isPending ? 'Procesando...' : 'Procesar Venta'}
            </Button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-3xl font-bold text-blue-600">€{getTotalAmount().toFixed(2)}</p>
          </div>

          <div className="w-[300px]"></div>
        </div>
      </div>
    </div>
  );
};

export default TPV;
