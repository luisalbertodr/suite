import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Edit, FileText, Mail, Receipt, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useUserAppearance } from '@/hooks/useUserAppearance';

interface PresupuestoNViewProps {
  presupuestoId: string;
  onBack: () => void;
  onEdit: () => void;
}

interface CompanyData {
  name: string;
  email: string;
  website?: string;
  address_street?: string;
  address_city?: string;
  address_postal_code?: string;
}

interface PresupuestoNData {
  id: string;
  number: string;
  issue_date: string;
  accepted_date?: string;
  status: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  notes?: string;
  customer_id: string; // Add customer_id field
  customer: {
    name: string;
    email?: string;
    tax_id?: string;
    address_street?: string;
    address_city?: string;
    address_postal_code?: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

export const PresupuestoNView: React.FC<PresupuestoNViewProps> = ({
  presupuestoId,
  onBack,
  onEdit
}) => {
  const [presupuesto, setPresupuesto] = useState<PresupuestoNData | null>(null);
  const [companyData, setCompanyData] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { logoUrl, loading: logoLoading } = useUserAppearance();

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch presupuesto data
        const { data: presupuestoData, error: presupuestoError } = await supabase
          .from('presupuestos_n')
          .select(`
            *,
            customer:customers(*),
            presupuestos_n_items(*)
          `)
          .eq('id', presupuestoId)
          .single();

        if (presupuestoError) throw presupuestoError;
        
        // Fetch company data
        const { data: companyData, error: companyError } = await supabase
          .from('companies')
          .select('name, email, website, address_street, address_city, address_postal_code')
          .single();

        if (companyError) {
          console.warn('No company data found:', companyError);
        } else {
          setCompanyData(companyData);
        }
        
        setPresupuesto({
          ...presupuestoData,
          items: presupuestoData.presupuestos_n_items || []
        });
      } catch (error: any) {
        console.error('Error fetching data:', error);
        toast({
          title: "Error",
          description: "Error al cargar los datos",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [presupuestoId, toast]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'borrador':
        return 'bg-gray-100 text-gray-800';
      case 'enviado':
        return 'bg-blue-100 text-blue-800';
      case 'aceptado':
        return 'bg-green-100 text-green-800';
      case 'facturado':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'borrador':
        return 'Borrador';
      case 'enviado':
        return 'Enviado';
      case 'aceptado':
        return 'Aceptado';
      case 'facturado':
        return 'Facturado';
      default:
        return status;
    }
  };

  const handleCreateInvoice = () => {
    if (!presupuesto) return;

    // Navigate to factura form with pre-filled data
    const budgetData = {
      from: 'presupuesto-n',
      presupuesto_id: presupuestoId,
      customer_id: presupuesto.customer_id, // Get the actual customer ID
      customer_name: presupuesto.customer.name,
      items: presupuesto.items,
      subtotal: presupuesto.subtotal,
      tax_amount: presupuesto.tax_amount,
      total_amount: presupuesto.total_amount,
      notes: presupuesto.notes || ''
    };

    // Store in sessionStorage to avoid URL length limitations
    sessionStorage.setItem('invoiceFromBudget', JSON.stringify(budgetData));
    navigate('/facturas?from=presupuesto-n');
  };

  const handleCreateDeliveryNote = () => {
    if (!presupuesto) return;

    // Navigate to albarán de salida form with pre-filled data
    const budgetData = {
      from: 'presupuesto-n',
      presupuesto_id: presupuestoId,
      customer_id: presupuesto.customer_id,
      customer_name: presupuesto.customer.name,
      items: presupuesto.items,
      subtotal: presupuesto.subtotal,
      tax_amount: presupuesto.tax_amount,
      total_amount: presupuesto.total_amount,
      notes: presupuesto.notes || ''
    };

    // Store in sessionStorage to avoid URL length limitations
    sessionStorage.setItem('deliveryNoteFromBudget', JSON.stringify(budgetData));
    navigate('/albaranes-salida?from=presupuesto-n');
  };

  // Function to load image and return as base64
  const loadImageAsBase64 = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = url;
    });
  };

  const handleGeneratePDF = async () => {
    if (!presupuesto) return;

    try {
      const { default: html2pdf } = await import('html2pdf.js');
      
      // Load logo as base64 if available
      let logoBase64 = '';
      if (logoUrl && !logoLoading) {
        try {
          logoBase64 = await loadImageAsBase64(logoUrl);
        } catch (error) {
          console.warn('Failed to load logo:', error);
        }
      }

      // Create PDF content with proper escaping and footer
      const pdfContent = `
        <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 5px; font-size: 80%; display: flex; flex-direction: column; min-height: 100vh;">
          <div style="flex: 1;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
              <div style="flex: 1;">
                ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" style="max-width: 120px; max-height: 60px; object-fit: contain;" />` : ''}
              </div>
              <div style="flex: 1;"></div>
              <div style="text-align: right; flex: 1;">
                <h1 style="color: #2563eb; margin: 0; font-size: 20px;">PRESUPUESTO</h1>
                <h2 style="color: #64748b; margin: 3px 0; font-size: 16px;">${presupuesto.number}</h2>
              </div>
            </div>
          
          <div style="display: flex; justify-content: space-between; margin-bottom: 20px;">
            <div style="width: 45%;">
              <h3 style="color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; font-size: 12px;">Datos del Cliente</h3>
              <p style="font-size: 10px; margin: 3px 0;"><strong>Nombre:</strong> ${presupuesto.customer.name}</p>
              ${presupuesto.customer.tax_id ? `<p style="font-size: 10px; margin: 3px 0;"><strong>NIF/CIF:</strong> ${presupuesto.customer.tax_id}</p>` : ''}
              ${presupuesto.customer.email ? `<p style="font-size: 10px; margin: 3px 0;"><strong>Email:</strong> ${presupuesto.customer.email}</p>` : ''}
              ${presupuesto.customer.address_street ? `<p style="font-size: 10px; margin: 3px 0;"><strong>Dirección:</strong> ${presupuesto.customer.address_street}${presupuesto.customer.address_city ? `, ${presupuesto.customer.address_city}` : ''}${presupuesto.customer.address_postal_code ? ` (${presupuesto.customer.address_postal_code})` : ''}</p>` : ''}
            </div>
            <div style="width: 45%;">
              <h3 style="color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; font-size: 12px;">Datos del Presupuesto</h3>
              <p style="font-size: 10px; margin: 3px 0;"><strong>Fecha:</strong> ${new Date(presupuesto.issue_date).toLocaleDateString('es-ES')}</p>
              <p style="font-size: 10px; margin: 3px 0;"><strong>Estado:</strong> ${getStatusText(presupuesto.status)}</p>
              ${presupuesto.accepted_date ? `<p style="font-size: 10px; margin: 3px 0;"><strong>Fecha Aceptación:</strong> ${new Date(presupuesto.accepted_date).toLocaleDateString('es-ES')}</p>` : ''}
            </div>
          </div>
          
          <div style="margin-bottom: 20px;">
            <h3 style="color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; font-size: 12px;">Artículos y Servicios</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 10px;">
              <thead>
                <tr style="background-color: #f8fafc;">
                  <th style="padding: 6px; text-align: left; border: 1px solid #e5e7eb;">Descripción</th>
                  <th style="padding: 6px; text-align: center; border: 1px solid #e5e7eb; width: 60px;">Cant.</th>
                  <th style="padding: 6px; text-align: right; border: 1px solid #e5e7eb; width: 80px;">P. Unit.</th>
                  <th style="padding: 6px; text-align: right; border: 1px solid #e5e7eb; width: 80px;">Total</th>
                </tr>
              </thead>
              <tbody>
                ${presupuesto.items.map(item => `
                  <tr>
                    <td style="padding: 6px; border: 1px solid #e5e7eb;">${item.description}</td>
                    <td style="padding: 6px; text-align: center; border: 1px solid #e5e7eb;">${item.quantity}</td>
                    <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb;">${item.unit_price.toFixed(2)} €</td>
                    <td style="padding: 6px; text-align: right; border: 1px solid #e5e7eb;">${item.total_price.toFixed(2)} €</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          
          <div style="margin-top: 15px;">
            <div style="width: 250px; margin-left: auto;">
              <div style="display: flex; justify-content: space-between; padding: 5px 0; border-top: 1px solid #e5e7eb; font-size: 10px;">
                <span>Base Imponible:</span>
                <span>${presupuesto.subtotal.toFixed(2)} €</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 5px 0; font-size: 10px;">
                <span>IVA (21%):</span>
                <span>${presupuesto.tax_amount.toFixed(2)} €</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-top: 2px solid #374151; font-weight: bold; font-size: 14px;">
                <span>TOTAL:</span>
                <span>${presupuesto.total_amount.toFixed(2)} €</span>
              </div>
            </div>
          </div>
          
          ${presupuesto.notes ? `
            <div style="margin-top: 20px;">
              <h3 style="color: #374151; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; font-size: 12px;">Observaciones</h3>
              <p style="background-color: #f8fafc; padding: 10px; border-radius: 4px; margin-top: 8px; font-size: 10px;">${presupuesto.notes}</p>
            </div>
          ` : ''}
          
            <div style="margin-top: 25px; text-align: center; color: #64748b; font-size: 9px;">
              <p>Presupuesto válido durante 30 días desde la fecha de emisión</p>
            </div>
          </div>
          
          ${companyData ? `
            <div style="margin-top: auto; padding-top: 20px; border-top: 2px solid #374151; text-align: center; font-size: 9px; color: #374151; page-break-inside: avoid;">
              <div style="font-weight: bold; margin-bottom: 3px;">
                ${companyData.name.toUpperCase()}${companyData.address_street ? ` - ${companyData.address_street.toUpperCase()}` : ''}${companyData.address_city ? ` - ${companyData.address_city.toUpperCase()}` : ''}${companyData.address_postal_code ? ` - ${companyData.address_postal_code}` : ''}
              </div>
              <div style="font-weight: bold;">
                ${companyData.email ? `${companyData.email}` : ''}${companyData.email && companyData.website ? ' | ' : ''}${companyData.website ? `${companyData.website}` : ''}
              </div>
            </div>
          ` : ''}
        </div>
      `;

      const element = document.createElement('div');
      element.innerHTML = pdfContent;
      
      const opt = {
        margin: [0.3, 0.3, 0.8, 0.3], // top, left, bottom, right - more bottom margin for footer
        filename: `presupuesto-${presupuesto.number}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
      };

      await html2pdf().set(opt).from(element).save();
      
      toast({
        title: "Éxito",
        description: "PDF generado correctamente",
      });
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      toast({
        title: "Error",
        description: "Error al generar el PDF",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!presupuesto) {
    return (
      <div className="text-center py-8">
        <p>Presupuesto no encontrado</p>
        <Button onClick={onBack} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
      </div>
    );
  }

  // Debug logging
  console.log('🔍 Render - Status:', presupuesto.status, '- Show button?', presupuesto.status === 'aceptado');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver
          </Button>
          <h1 className="text-3xl font-bold">PresupuestoN {presupuesto.number}</h1>
          <Badge className={getStatusColor(presupuesto.status)}>
            {getStatusText(presupuesto.status)}
          </Badge>
        </div>
        
        <div className="flex gap-2">
          {presupuesto.status === 'aceptado' && (
            <>
              <Button onClick={handleCreateInvoice} className="bg-green-600 hover:bg-green-700">
                <Receipt className="w-4 h-4 mr-2" />
                Facturar
              </Button>
              <Button onClick={handleCreateDeliveryNote} variant="outline">
                <Truck className="w-4 h-4 mr-2" />
                Crear Albarán
              </Button>
            </>
          )}
          <Button variant="outline" onClick={onEdit}>
            <Edit className="w-4 h-4 mr-2" />
            Editar
          </Button>
          <Button variant="outline" onClick={handleGeneratePDF}>
            <FileText className="w-4 h-4 mr-2" />
            Ver PDF
          </Button>
          <Button variant="outline">
            <Mail className="w-4 h-4 mr-2" />
            Enviar Email
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Información del Cliente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <strong>Nombre:</strong> {presupuesto.customer.name}
            </div>
            {presupuesto.customer.tax_id && (
              <div>
                <strong>NIF/CIF:</strong> {presupuesto.customer.tax_id}
              </div>
            )}
            {presupuesto.customer.email && (
              <div>
                <strong>Email:</strong> {presupuesto.customer.email}
              </div>
            )}
            {presupuesto.customer.address_street && (
              <div>
                <strong>Dirección:</strong> {presupuesto.customer.address_street}
                {presupuesto.customer.address_city && (
                  <>, {presupuesto.customer.address_city}</>
                )}
                {presupuesto.customer.address_postal_code && (
                  <> ({presupuesto.customer.address_postal_code})</>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Información del Presupuesto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <strong>Número:</strong> {presupuesto.number}
            </div>
            <div>
              <strong>Fecha de Emisión:</strong>{' '}
              {new Date(presupuesto.issue_date).toLocaleDateString()}
            </div>
            {presupuesto.accepted_date && (
              <div>
                <strong>Fecha de Aceptación:</strong>{' '}
                {new Date(presupuesto.accepted_date).toLocaleDateString()}
              </div>
            )}
            <div>
              <strong>Estado:</strong>{' '}
              <Badge className={getStatusColor(presupuesto.status)}>
                {getStatusText(presupuesto.status)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Artículos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Descripción</th>
                  <th className="text-left p-2">Cantidad</th>
                  <th className="text-left p-2">Precio Unitario</th>
                  <th className="text-left p-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {presupuesto.items.map((item, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-2">{item.description}</td>
                    <td className="p-2">{item.quantity}</td>
                    <td className="p-2">{item.unit_price.toFixed(2)} €</td>
                    <td className="p-2">{item.total_price.toFixed(2)} €</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Totales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span>Base Imponible:</span>
            <span>{presupuesto.subtotal.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between">
            <span>IVA (21%):</span>
            <span>{presupuesto.tax_amount.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between font-bold text-lg border-t pt-2">
            <span>Total:</span>
            <span>{presupuesto.total_amount.toFixed(2)} €</span>
          </div>
        </CardContent>
      </Card>

      {presupuesto.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{presupuesto.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};