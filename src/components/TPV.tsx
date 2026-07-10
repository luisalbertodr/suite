import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Minus, ShoppingCart, CreditCard, Calculator, Receipt, Search, History, Package, Scan, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { SalesHistory } from './SalesHistory';
import { BarcodeScanner } from './BarcodeScanner';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { usePermissionGuard } from '@/hooks/usePermissionGuard';
import { SplitPaymentDialog } from '@/components/SplitPaymentDialog';
import {
  buildFamilyBillingMap,
  groupCartByBillingCompany,
  hasSplitBilling,
  resolveBillingCompanyId,
  type CartItemWithBilling,
} from '@/lib/billingCompany';
import { processSplitPayment } from '@/lib/splitSale';
import {
  buildAgendaSaleNotes,
  isUuid,
  persistSaleAppointmentLink,
  buildInvoicePrefillFromSale,
  TPV_SALE_INVOICE_PREFILL_KEY,
  type AppointmentStatus,
} from '@/lib/appointmentSales';
import { issueInvoiceFromSale } from '@/lib/tpvSaleOperations';
import { useTpvSettings } from '@/hooks/useTpvSettings';
import { Grid, type CellComponentProps } from 'react-window';
import { useRegisterTopBarContent } from '@/components/TopBarContentContext';
import {
  ArticleFamilyPicker,
  type AppointmentArticleOption,
} from '@/components/forms/AppointmentArticleFamilyPicker';
import { ARTICLE_SEARCH_MIN_CHARS } from '@/lib/articleSearch';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
  variationId?: string;
  size?: string;
  color?: string;
  billingCompanyId?: string;
  familia?: string;
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
  familia?: string;
  billing_company_id?: string | null;
  company_id?: string | null;
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

type ProductCellProps = {
  articles: Article[];
  columnCount: number;
  gap: number;
  onAddToCart: (article: Article) => void;
};

function ProductGridCell({
  columnIndex,
  rowIndex,
  style,
  articles,
  columnCount,
  gap,
  onAddToCart,
}: CellComponentProps<ProductCellProps>) {
  const articleIndex = rowIndex * columnCount + columnIndex;
  const article = articles[articleIndex];
  if (!article) return null;

  return (
    <div style={{ ...style, padding: gap / 2 }}>
      <div
        className={`cursor-pointer hover:shadow-md transition-all duration-200 h-32 bg-card border border-border hover:border-blue-400 dark:hover:border-blue-600 rounded-lg ${
          article.stock_actual <= 0 ? 'bg-red-50 dark:bg-red-950/30 opacity-60' : 'hover:bg-accent/50'
        }`}
        onClick={() => onAddToCart(article)}
      >
        <div className="p-3 h-full flex flex-col justify-between">
          <div className="flex-shrink-0 h-12 flex items-center justify-center mb-2">
            {article.foto_url ? (
              <img src={article.foto_url} alt={article.descripcion} className="w-10 h-10 rounded-md object-cover" />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-blue-500 rounded-md flex items-center justify-center text-white">
                <Package className="w-6 h-6" />
              </div>
            )}
          </div>
          <div className="flex-1 flex flex-col justify-center min-h-0 px-1">
            <h3 className="font-medium text-xs leading-tight text-center overflow-hidden mb-1">
              {article.descripcion.length > 20 ? `${article.descripcion.substring(0, 20)}...` : article.descripcion}
            </h3>
            {article.tipo_producto !== 'standard' && (
              <p className="text-[10px] text-orange-600 text-center font-semibold">
                {article.tipo_producto === 'textil' ? 'TEX' : 'CAL'}
              </p>
            )}
          </div>
          <div className="text-center mt-2">
            <p className="text-sm font-bold text-blue-600">€{(article.precio || 0).toFixed(2)}</p>
            <p className="text-[10px] text-muted-foreground">Stock: {article.stock_actual}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export const TPV: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showVariations, setShowVariations] = useState<string | null>(null);
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [productsViewport, setProductsViewport] = useState({ width: 0, height: 0 });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { companyId, loading: companyLoading } = useCompanyFilter();
  const { isMultiEntity, companyLabels, billingCompanies, catalogHostCompanyId } = useWorkCenter();
  const catalogCompanyId = catalogHostCompanyId ?? companyId;
  const { requireOrToast: requirePermissionOrToast } = usePermissionGuard();
  const prefilledSourceRef = useRef<string | null>(null);
  const [showSplitPayment, setShowSplitPayment] = useState(false);
  const [splitProcessing, setSplitProcessing] = useState(false);

  type PrefillItem = CartItem & { sourceKind?: string; sourceBonusMode?: string | null };
  type PrefillState = {
    prefillFromAppointment?: {
      appointmentId: string;
      customerId?: string | null;
      customerName?: string | null;
      date?: string;
      appointmentStatus?: AppointmentStatus;
      items: PrefillItem[];
    };
  };

  const prefill = (location.state as PrefillState | null)?.prefillFromAppointment;
  const [appointmentChargeContext, setAppointmentChargeContext] = useState<{
    appointmentId: string;
    customerId: string | null;
    customerName: string | null;
    date: string;
    appointmentStatus: AppointmentStatus | null;
  } | null>(null);
  const [lastCompletedSale, setLastCompletedSale] = useState<{
    sale: { id: string; ticket_number: string; total_amount: number };
    appointmentId: string | null;
    invoiceId?: string | null;
  } | null>(null);
  const [issuingInvoice, setIssuingInvoice] = useState(false);
  const { settings: tpvSettings } = useTpvSettings();
  const productsContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = productsContainerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setProductsViewport({
        width: Math.max(0, Math.floor(entry.contentRect.width)),
        height: Math.max(0, Math.floor(entry.contentRect.height)),
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchTerm(searchTerm), 220);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    if (!prefill || !prefill.appointmentId) return;
    if (prefilledSourceRef.current === prefill.appointmentId) return;
    prefilledSourceRef.current = prefill.appointmentId;
    if (prefill.items?.length) {
      setCart(prefill.items.map((it) => ({ ...it })));
      setAppointmentChargeContext({
        appointmentId: prefill.appointmentId,
        customerId: prefill.customerId ?? null,
        customerName: prefill.customerName ?? null,
        date: prefill.date ?? '',
        appointmentStatus: prefill.appointmentStatus ?? null,
      });
      toast({
        title: 'Carrito precargado desde agenda',
        description: `${prefill.customerName || 'Cliente'} · cita del ${prefill.date || 'día seleccionado'}`,
      });
    }
    navigate(location.pathname, { replace: true, state: {} });
  }, [prefill, navigate, location.pathname]);

  const { data: familyBillingRows = [] } = useQuery({
    queryKey: ['tpv-family-billing', catalogCompanyId],
    queryFn: async () => {
      if (!catalogCompanyId) return [];
      const { data, error } = await supabase
        .from('article_families')
        .select('name, billing_company_id')
        .eq('company_id', catalogCompanyId);
      if (error) {
        if (error.code === '42703') return [];
        throw error;
      }
      return data ?? [];
    },
    enabled: !!catalogCompanyId,
  });

  const familyBillingMap = useMemo(
    () => buildFamilyBillingMap(familyBillingRows),
    [familyBillingRows],
  );

  const resolveItemBilling = (article: Article): string => {
    if (!catalogCompanyId) return '';
    return resolveBillingCompanyId(
      {
        billing_company_id: article.billing_company_id,
        familia: article.familia ?? 'Varios',
        company_id: article.company_id,
      },
      familyBillingMap,
      catalogCompanyId,
    );
  };

  const cartArticleIds = useMemo(
    () =>
      [...new Set(
        cart
          .map((item) => item.id)
          .filter((id) => id && !String(id).startsWith('apt-') && !String(id).startsWith('draft-')),
      )],
    [cart],
  );

  const { data: cartArticlesBilling = [] } = useQuery({
    queryKey: ['tpv-cart-articles-billing', companyId, cartArticleIds.join(',')],
    queryFn: async () => {
      if (!companyId || cartArticleIds.length === 0) return [];
      const { data, error } = await supabase
        .from('articles')
        .select('id, familia, billing_company_id, company_id')
        .in('id', cartArticleIds);
      if (error) throw error;
      return (data ?? []) as Article[];
    },
    enabled: !!companyId && cartArticleIds.length > 0,
  });

  const cartWithBilling: CartItemWithBilling[] = useMemo(
    () =>
      cart.map((item) => {
        if (item.billingCompanyId && companyId) {
          return { ...item, billingCompanyId: item.billingCompanyId };
        }
        const article = cartArticlesBilling.find((a) => a.id === item.id);
        if (article && companyId) {
          return { ...item, billingCompanyId: resolveItemBilling(article) };
        }
        return { ...item, billingCompanyId: companyId ?? '' };
      }),
    [cart, companyId, cartArticlesBilling, familyBillingMap],
  );

  const paymentGroups = useMemo(
    () => groupCartByBillingCompany(cartWithBilling, companyLabels),
    [cartWithBilling, companyLabels],
  );

  const searchReady = debouncedSearchTerm.trim().length >= ARTICLE_SEARCH_MIN_CHARS;

  const { data: articles = [], isLoading } = useQuery({
    queryKey: ['tpv-articles', debouncedSearchTerm, catalogCompanyId, isMultiEntity],
    queryFn: async () => {
      if (!catalogCompanyId || !searchReady) return [];

      const searchPattern = `%${debouncedSearchTerm.trim()}%`;
      const { data, error } = await supabase
        .from('articles')
        .select('id, descripcion, precio, stock_actual, codigo, foto_url, tipo_producto, codigo_barras, familia, billing_company_id, company_id')
        .eq('estado', 'activo')
        .eq('company_id', catalogCompanyId)
        .or(`descripcion.ilike.${searchPattern},codigo.ilike.${searchPattern}`)
        .order('descripcion')
        .limit(300);

      if (error) {
        console.error('Error fetching articles:', error);
        throw error;
      }

      return (data ?? []) as Article[];
    },
    enabled: !!catalogCompanyId && searchReady,
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

  const buildSaleNotes = () =>
    appointmentChargeContext?.appointmentId || prefill?.appointmentId
      ? buildAgendaSaleNotes({
          source: 'agenda_appointment',
          appointment_id: appointmentChargeContext?.appointmentId ?? prefill!.appointmentId,
          customer_id: appointmentChargeContext?.customerId ?? prefill?.customerId ?? null,
          customer_name: appointmentChargeContext?.customerName ?? prefill?.customerName ?? null,
          appointment_date: appointmentChargeContext?.date ?? prefill?.date ?? null,
          appointment_status: appointmentChargeContext?.appointmentStatus ?? prefill?.appointmentStatus ?? null,
          items: cart.map((it) => ({
            name: it.name,
            total: it.total,
            source_kind: (it as PrefillItem).sourceKind ?? null,
            source_bonus_mode: (it as PrefillItem).sourceBonusMode ?? null,
          })),
        })
      : null;

  const saleContext = () => ({
    hostCompanyId: catalogCompanyId!,
    customerId: appointmentChargeContext?.customerId ?? prefill?.customerId ?? null,
    customerName: appointmentChargeContext?.customerName || prefill?.customerName || null,
    appointmentId: appointmentChargeContext?.appointmentId ?? prefill?.appointmentId ?? null,
    notes: buildSaleNotes(),
  });

  const finalizeSaleSuccess = async (
    sale: { id: string; ticket_number: string; total_amount: number },
    saleItems: Array<{ description: string; quantity: number; unit_price: number; total_price: number }>,
    extraTickets?: Array<{ ticket_number: string; total: number; label: string }>,
    invoiceSaleIds: string[] = sale.id ? [sale.id] : [],
  ) => {
    const ctx = appointmentChargeContext;
    if (ctx?.appointmentId && sale.id) {
      try {
        await persistSaleAppointmentLink(sale.id, {
          appointmentId: ctx.appointmentId,
          customerId: ctx.customerId,
          appointmentStatus: ctx.appointmentStatus ?? undefined,
        });
      } catch (e) {
        console.error('link sale to appointment', e);
      }
    }

    setCart([]);
    setAmountPaid('');
    setAppointmentChargeContext(null);
    setShowSplitPayment(false);

    const ticketsLabel = extraTickets?.length
      ? extraTickets.map((t) => `${t.label}: ${t.ticket_number}`).join(' · ')
      : sale.ticket_number;

    setLastCompletedSale({
      sale: {
        id: sale.id,
        ticket_number: ticketsLabel,
        total_amount: extraTickets?.length
          ? extraTickets.reduce((s, t) => s + t.total, 0)
          : Number(sale.total_amount ?? 0),
      },
      appointmentId: ctx?.appointmentId ?? null,
      invoiceId: null,
    });

    toast({
      title: 'Venta procesada',
      description: ctx?.appointmentId
        ? `Ticket(s) ${ticketsLabel} · cita cobrada`
        : `Ticket(s) ${ticketsLabel} creado(s) correctamente.`,
    });

    queryClient.invalidateQueries({ queryKey: ['sales'] });
    queryClient.invalidateQueries({ queryKey: ['sales-history'] });
    queryClient.invalidateQueries({ queryKey: ['appointment-sale'] });
    queryClient.invalidateQueries({ queryKey: ['appointment-charged-totals'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-main'] });
    queryClient.invalidateQueries({ queryKey: ['agenda-appointments'] });

    let autoInvoiceDone = false;

    if (tpvSettings.autoInvoiceOnAppointmentCharge && companyId && invoiceSaleIds.length > 0) {
      let createdCount = 0;
      let firstInvoiceId: string | null = null;
      for (const saleId of invoiceSaleIds) {
        try {
          const result = await issueInvoiceFromSale(saleId, catalogCompanyId);
          if (result.mode === 'created') {
            createdCount += 1;
            firstInvoiceId ??= result.invoiceId;
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
          } else {
            sessionStorage.setItem(TPV_SALE_INVOICE_PREFILL_KEY, JSON.stringify(result.prefill));
            toast({
              title: 'Factura no automática',
              description: result.reason,
            });
          }
        } catch (e) {
          console.error('auto invoice after TPV charge', e);
          toast({
            title: 'No se pudo facturar automáticamente',
            description: e instanceof Error ? e.message : 'Puedes facturar manualmente desde el ticket.',
            variant: 'destructive',
          });
        }
      }
      if (createdCount > 0) {
        autoInvoiceDone = true;
        setLastCompletedSale((prev) =>
          prev && firstInvoiceId ? { ...prev, invoiceId: firstInvoiceId } : prev,
        );
        toast({
          title: createdCount === 1 ? 'Factura emitida automáticamente' : 'Facturas emitidas automáticamente',
          description:
            createdCount === 1
              ? 'Factura creada y vinculada al ticket.'
              : `${createdCount} facturas creadas y vinculadas a sus tickets.`,
        });
      }
    }

    if (ctx?.appointmentId && sale.id && saleItems?.length && !autoInvoiceDone) {
      const prefillInvoice = buildInvoicePrefillFromSale(
        {
          id: sale.id,
          ticket_number: sale.ticket_number,
          total_amount: Number(sale.total_amount ?? 0),
          status: 'completed',
          created_at: new Date().toISOString(),
          customer_id: ctx.customerId,
          appointment_id: ctx.appointmentId,
          invoice_id: null,
          notes: buildSaleNotes(),
        },
        saleItems,
        ctx.customerId,
        ctx.appointmentId,
      );
      sessionStorage.setItem(TPV_SALE_INVOICE_PREFILL_KEY, JSON.stringify(prefillInvoice));
    }
  };

  const processSaleMutation = useMutation({
    mutationFn: async (saleData: {
      items: CartItem[];
      total: number;
      paymentMethod: string;
      amountPaid: number;
      change: number;
      notes?: string | null;
      customerName?: string | null;
      customerId?: string | null;
      appointmentId?: string | null;
      billingCompanyId?: string;
    }) => {
      if (!companyId || !catalogCompanyId) {
        console.error('❌ No company ID available');
        throw new Error('No company ID available');
      }

      const billingCompanyId = saleData.billingCompanyId ?? companyId;

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

      const saleRecord: Record<string, unknown> = {
        company_id: billingCompanyId,
        host_company_id: catalogCompanyId,
        ticket_number: '',
        total_amount: saleData.total,
        subtotal: subtotal,
        tax_amount: taxAmount,
        payment_method: saleData.paymentMethod,
        amount_paid: saleData.amountPaid || 0,
        change_amount: saleData.change || 0,
        status: 'completed' as const,
        currency: 'EUR',
        customer_name: saleData.customerName || null,
        customer_email: null,
        customer_phone: null,
        customer_id: saleData.customerId ?? null,
        appointment_id: saleData.appointmentId ?? null,
        notes: saleData.notes ?? null,
      };

      let sale: any = null;
      let saleError: any = null;
      for (const attempt of [saleRecord, { ...saleRecord, appointment_id: undefined }, { ...saleRecord, appointment_id: undefined, customer_id: undefined }]) {
        const res = await supabase.from('sales').insert(attempt).select().single();
        sale = res.data;
        saleError = res.error;
        if (!saleError) break;
        if (saleError.code !== '42703' && saleError.code !== 'PGRST204') break;
      }

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

      // Create sale items
      const saleItems = saleData.items.map((item) => ({
        sale_id: sale.id,
        company_id: catalogCompanyId,
        article_id: item.variationId ? null : (isUuid(item.id) ? item.id : null),
        variation_id: item.variationId || null,
        description: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.total,
      }));

      let createdItems: typeof saleItems | null = null;
      let itemsError: any = null;
      for (const attempt of [saleItems, saleItems.map(({ company_id: _c, ...rest }) => rest)]) {
        const res = await supabase.from('sale_items').insert(attempt).select();
        createdItems = res.data;
        itemsError = res.error;
        if (!itemsError) break;
        if (itemsError.code !== '42703' && itemsError.code !== 'PGRST204') break;
      }

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

      return { sale, saleItems: createdItems ?? saleItems };
    },
    onSuccess: async ({ sale, saleItems }) => {
      await finalizeSaleSuccess(sale, saleItems as Array<{ description: string; quantity: number; unit_price: number; total_price: number }>);
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
    if (!barcode.trim() || !catalogCompanyId) return;

    try {
      const { data: articleData, error: articleError } = await supabase
        .from('articles')
        .select('id, descripcion, precio, stock_actual, codigo, foto_url, tipo_producto, codigo_barras, familia, billing_company_id, company_id')
        .eq('codigo_barras', barcode.trim())
        .eq('estado', 'activo')
        .eq('company_id', catalogCompanyId)
        .maybeSingle();

      if (articleError) {
        console.error('Error searching article by barcode:', articleError);
      }

      if (articleData) {
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
        total: article.precio || 0,
        billingCompanyId: resolveItemBilling(article),
        familia: article.familia,
      }]);
    }
  };

  const addPickerArticleToCart = (picked: AppointmentArticleOption) => {
    addToCart({
      id: picked.id,
      descripcion: picked.descripcion,
      precio: Number(picked.precio ?? 0),
      stock_actual: 0,
      codigo: picked.codigo || '',
      tipo_producto: 'standard',
      familia: picked.familia ?? undefined,
    } as Article);
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
        color: variation.color,
        billingCompanyId: resolveItemBilling(article),
        familia: article.familia,
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
    if (!requirePermissionOrToast('sales', 'create', 'No tienes permiso para procesar ventas.')) {
      return;
    }

    if (cart.length === 0) {
      toast({
        title: 'Carrito vacío',
        description: 'Agrega productos al carrito antes de procesar la venta.',
        variant: 'destructive',
      });
      return;
    }

    if (!companyId) {
      toast({
        title: 'Error',
        description: 'No se pudo obtener la información de la empresa.',
        variant: 'destructive',
      });
      return;
    }

    if (isMultiEntity && hasSplitBilling(paymentGroups)) {
      setShowSplitPayment(true);
      return;
    }

    const total = getTotalAmount();
    if (paymentMethod === 'cash') {
      const paid = parseFloat(amountPaid) || 0;
      if (paid < total) {
        toast({
          title: 'Pago insuficiente',
          description: 'El monto pagado es menor al total de la venta.',
          variant: 'destructive',
        });
        return;
      }
    }

    const billingId = paymentGroups[0]?.billingCompanyId ?? companyId;

    processSaleMutation.mutate({
      items: cart,
      total,
      paymentMethod,
      amountPaid: parseFloat(amountPaid) || 0,
      change: getChange(),
      customerName: appointmentChargeContext?.customerName || prefill?.customerName || null,
      customerId: appointmentChargeContext?.customerId ?? prefill?.customerId ?? null,
      appointmentId: appointmentChargeContext?.appointmentId ?? prefill?.appointmentId ?? null,
      notes: buildSaleNotes(),
      billingCompanyId: billingId,
    });
  };

  const handleSplitPayGroup = async (params: {
    group: typeof paymentGroups[0];
    paymentMethod: 'cash' | 'card';
    amountPaid: number;
    change: number;
    saleGroupId: string | null;
    paidCount: number;
    isLastPayment: boolean;
  }) => {
    if (!companyId) throw new Error('Sin empresa');
    setSplitProcessing(true);
    try {
      const result = await processSplitPayment(
        {
          group: params.group.items,
          total: params.group.total,
          paymentMethod: params.paymentMethod,
          amountPaid: params.amountPaid,
          change: params.change,
          billingCompanyId: params.group.billingCompanyId,
          context: saleContext(),
          saleGroupId: params.saleGroupId,
          isLastPayment: params.isLastPayment,
          globalTotal: getTotalAmount(),
        },
        params.paidCount,
        paymentGroups.length,
      );
      return {
        saleId: result.sale.id,
        saleGroupId: result.saleGroupId,
        ticket_number: result.sale.ticket_number,
        total: Number(result.sale.total_amount),
      };
    } finally {
      setSplitProcessing(false);
    }
  };

  const handleSplitComplete = async (state: {
    completedSales: Array<{ saleId: string; billingCompanyId: string; ticket_number: string; total: number }>;
  }) => {
    const first = state.completedSales[0];
    if (!first) return;
    const saleItems = cartWithBilling.map((it) => ({
      description: it.name,
      quantity: it.quantity,
      unit_price: it.price,
      total_price: it.total,
    }));
    await finalizeSaleSuccess(
      { id: '', ticket_number: first.ticket_number, total_amount: first.total },
      saleItems,
      state.completedSales.map((s) => ({
        ticket_number: s.ticket_number,
        total: s.total,
        label: companyLabels.get(s.billingCompanyId) ?? 'Empresa',
      })),
      state.completedSales.map((s) => s.saleId).filter(Boolean),
    );
  };

  const productsGrid = useMemo(() => {
    const width = productsViewport.width;
    const height = productsViewport.height;
    if (!width || !height) return null;
    const gap = 8;
    const minColWidth = 180;
    const columnCount = Math.max(1, Math.floor((width + gap) / (minColWidth + gap)));
    const columnWidth = Math.floor(width / columnCount);
    const rowHeight = 138;
    const rowCount = Math.ceil(articles.length / columnCount);
    return { width, height, gap, columnCount, columnWidth, rowHeight, rowCount };
  }, [articles.length, productsViewport.height, productsViewport.width]);

  const topBarActions = useMemo(() => {
    if (showHistory) return null;
    return (
      <Button
        onClick={() => setShowHistory(true)}
        variant="outline"
        size="sm"
        className="h-7 px-2 text-xs"
      >
        <History className="w-3.5 h-3.5 mr-1" />
        Historial
      </Button>
    );
  }, [showHistory]);

  useRegisterTopBarContent(
    {
      title: (
        <span className="inline-flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-blue-600" />
          {showHistory ? 'Historial TPV' : 'Terminal TPV'}
        </span>
      ),
      actions: topBarActions,
    },
    [showHistory, topBarActions],
  );

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
          <h3 className="text-lg font-semibold text-muted-foreground">Sin empresa</h3>
          <p className="text-muted-foreground mt-2">
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
    <div className="flex flex-col h-screen bg-background">
      {appointmentChargeContext && (
        <div className="mx-4 mt-2 rounded-md border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 px-3 py-2 text-sm text-sky-900 dark:text-sky-100 flex flex-wrap items-center gap-2">
          <span>
            Cobro de cita · <strong>{appointmentChargeContext.customerName || 'Cliente'}</strong>
            {appointmentChargeContext.date ? ` · ${appointmentChargeContext.date}` : ''}
          </span>
        </div>
      )}

      {lastCompletedSale && (
        <div className="mx-4 mt-2 rounded-md border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-2 text-sm text-emerald-900 dark:text-emerald-100 flex flex-wrap items-center gap-2">
          <span>
            Ticket <strong>{lastCompletedSale.sale.ticket_number}</strong> · {lastCompletedSale.sale.total_amount.toFixed(2)} €
            <span className="text-emerald-800/80"> · El ticket acredita el cobro; la factura es el documento fiscal.</span>
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            disabled={issuingInvoice || !companyId || !lastCompletedSale.sale.id}
            onClick={async () => {
              if (!companyId || !lastCompletedSale.sale.id) return;
              if (lastCompletedSale.invoiceId) {
                navigate(`/facturacion?invoice=${lastCompletedSale.invoiceId}`);
                return;
              }
              setIssuingInvoice(true);
              try {
                const result = await issueInvoiceFromSale(lastCompletedSale.sale.id, catalogCompanyId);
                if (result.mode === 'created') {
                  setLastCompletedSale((prev) =>
                    prev ? { ...prev, invoiceId: result.invoiceId } : prev,
                  );
                  toast({
                    title: 'Factura emitida',
                    description: result.invoiceNumber
                      ? `Factura ${result.invoiceNumber} creada desde el ticket.`
                      : 'Factura vinculada al ticket.',
                  });
                  navigate(`/facturacion?invoice=${result.invoiceId}`);
                  return;
                }
                sessionStorage.setItem(TPV_SALE_INVOICE_PREFILL_KEY, JSON.stringify(result.prefill));
                toast({ title: 'Completa la factura', description: result.reason });
                navigate('/facturacion');
              } catch (e) {
                toast({
                  title: 'Error al facturar',
                  description: e instanceof Error ? e.message : 'Error desconocido',
                  variant: 'destructive',
                });
              } finally {
                setIssuingInvoice(false);
              }
            }}
          >
            {lastCompletedSale.invoiceId
              ? 'Ver factura'
              : issuingInvoice
                ? 'Facturando…'
                : 'Facturar ahora'}
          </Button>
          {lastCompletedSale.appointmentId && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() => navigate(`/agenda?appointment=${lastCompletedSale.appointmentId}`)}
            >
              Volver a agenda
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-7 ml-auto" onClick={() => setLastCompletedSale(null)}>
            Cerrar
          </Button>
        </div>
      )}

      <div className="bg-card border-b border-border p-4">
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
          <p className="text-xs text-muted-foreground mt-1">
            Presiona Enter para buscar o usa la cámara para escanear
          </p>
        </div>
      </div>

      <BarcodeScanner
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onBarcodeDetected={handleBarcodeFromCamera}
      />

      {showSplitPayment && (
        <SplitPaymentDialog
          groups={paymentGroups}
          onClose={() => setShowSplitPayment(false)}
          onComplete={handleSplitComplete}
          onPayGroup={handleSplitPayGroup}
          processing={splitProcessing}
        />
      )}

      {showVariations && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 max-w-2xl w-full m-4 max-h-96 overflow-y-auto border border-border">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Seleccionar Variación</h3>
              <Button
                variant="ghost"
                onClick={() => setShowVariations(null)}
                className="text-muted-foreground hover:text-foreground"
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
                      variation.stock_actual <= 0 ? 'bg-red-50 dark:bg-red-950/30 opacity-60' : 'hover:bg-accent/50'
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
                        <p className="text-xs text-muted-foreground">
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

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 overflow-hidden pb-52">
        <div className="lg:col-span-2 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center">
                <Search className="w-5 h-5 mr-2" />
                Productos
              </CardTitle>
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder={`Buscar productos (mín. ${ARTICLE_SEARCH_MIN_CHARS} caracteres)…`}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <ArticleFamilyPicker
                  value={null}
                  itemKind="product"
                  placeholder="Catálogo por familias…"
                  triggerClassName="h-9 w-full text-sm"
                  onSelect={addPickerArticleToCart}
                />
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-2">
              <div ref={productsContainerRef} className="h-full overflow-hidden">
                {!searchReady ? (
                  <div className="h-full flex flex-col items-center justify-center py-8 px-4 text-center text-muted-foreground text-sm">
                    <p>
                      Escribe al menos {ARTICLE_SEARCH_MIN_CHARS} caracteres para ver la rejilla de productos,
                      o elige un artículo desde el catálogo por familias arriba.
                    </p>
                  </div>
                ) : isLoading ? (
                  <div className="h-full text-center py-8 text-muted-foreground">Cargando productos...</div>
                ) : articles.length === 0 ? (
                  <div className="h-full text-center py-8 text-muted-foreground">
                    No se encontraron productos para esta búsqueda
                  </div>
                ) : !productsGrid ? null : (
                  <Grid
                    cellComponent={ProductGridCell}
                    cellProps={{
                      articles,
                      columnCount: productsGrid.columnCount,
                      gap: productsGrid.gap,
                      onAddToCart: addToCart,
                    }}
                    columnCount={productsGrid.columnCount}
                    columnWidth={productsGrid.columnWidth}
                    rowCount={productsGrid.rowCount}
                    rowHeight={productsGrid.rowHeight}
                    style={{ height: productsGrid.height, width: productsGrid.width }}
                    overscanCount={2}
                  />
                )}
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
                  <div key={`${item.id}-${item.variationId || 'no-variation'}-${index}`} className="flex items-center justify-between py-2 border-b border-border">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">€{item.price.toFixed(2)} c/u</p>
                      {isMultiEntity && item.billingCompanyId && (
                        <p className="text-[10px] text-violet-600 font-medium">
                          {companyLabels.get(item.billingCompanyId) ?? 'Empresa'}
                        </p>
                      )}
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
                <div className="text-center py-8 text-muted-foreground flex flex-col items-center justify-center h-full">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Carrito vacío</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Elevado sobre el dock fijo (bottom-4, z-50) sin modificar DockBar */}
      <div className="fixed bottom-28 left-0 right-0 bg-card border-t border-border shadow-lg p-4 z-40">
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
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    Cambio: €{getChange().toFixed(2)}
                  </span>
                )}
              </div>
            )}

            <Button
              onClick={processSale}
              disabled={processSaleMutation.isPending || splitProcessing || cart.length === 0}
              className="bg-green-600 hover:bg-green-700"
              size="lg"
            >
              <Receipt className="w-4 h-4 mr-2" />
              {processSaleMutation.isPending || splitProcessing
                ? 'Procesando...'
                : isMultiEntity && hasSplitBilling(paymentGroups)
                  ? 'Cobrar (dividido)'
                  : 'Procesar Venta'}
            </Button>
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-3xl font-bold text-blue-600">€{getTotalAmount().toFixed(2)}</p>
          </div>

          <div className="w-[300px]"></div>
        </div>
      </div>
    </div>
  );
};

export default TPV;
