
import React, { useRef, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Edit2, FileText, Download, Globe, Check, X, Mail } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { EmailDialog } from './EmailDialog';
import { generateQRCodeDataURL } from '@/utils/qrCodeGenerator';

interface Invoice {
  id: string;
  number: string;
  customer_id: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  re_total: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled';
  notes?: string;
  currency: string;
  paid_status: boolean;
  paid_date?: string;
  is_intracomunitario: boolean;
  verifactu_qr_code?: string;
  verifactu_csv?: string;
  verifactu_status?: string;
  verifactu_sent_at?: string;
}

interface FacturaViewProps {
  invoice: Invoice;
  onClose: () => void;
  onEdit: () => void;
}

export const FacturaView: React.FC<FacturaViewProps> = ({ invoice, onClose, onEdit }) => {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string | null>(null);
  const { companyId, loading: companyLoading } = useCompanyFilter();

  const { data: customer } = useQuery({
    queryKey: ['customer', invoice.customer_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('id', invoice.customer_id)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const { data: invoiceItems } = useQuery({
    queryKey: ['invoice-items', invoice.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoice.id);
      
      if (error) throw error;
      return data;
    },
  });

  const { data: company, isLoading: companyDataLoading } = useQuery({
    queryKey: ['company', companyId],
    queryFn: async () => {
      if (!companyId) {
        console.log('No company ID available, skipping company query');
        return null;
      }

      console.log('Fetching company data for invoice view:', companyId);

      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();
      
      if (error) {
        console.error('Error fetching company:', error);
        throw error;
      }
      
      console.log('Fetched company for invoice view:', data);
      return data;
    },
    enabled: !!companyId && !companyLoading,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'text-green-600 bg-green-100';
      case 'sent': return 'text-blue-600 bg-blue-100';
      case 'overdue': return 'text-red-600 bg-red-100';
      case 'cancelled': return 'text-gray-600 bg-gray-100';
      default: return 'text-yellow-600 bg-yellow-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'draft': return 'Borrador';
      case 'sent': return 'Enviada';
      case 'paid': return 'Pagada';
      case 'overdue': return 'Vencida';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  // Generate QR code if Verifactu data is available
  useEffect(() => {
    const generateQR = async () => {
      if (invoice.verifactu_qr_code) {
        try {
          const qrDataURL = await generateQRCodeDataURL(invoice.verifactu_qr_code);
          setQrCodeDataURL(qrDataURL);
        } catch (error) {
          console.error('Error generating QR code for PDF:', error);
        }
      }
    };
    
    generateQR();
  }, [invoice.verifactu_qr_code]);

  const handleGeneratePDF = async () => {
    if (!invoiceRef.current) return;

    // Wait for QR code to be generated if needed
    if (invoice.verifactu_qr_code && !qrCodeDataURL) {
      try {
        const qrDataURL = await generateQRCodeDataURL(invoice.verifactu_qr_code);
        setQrCodeDataURL(qrDataURL);
      } catch (error) {
        console.error('Error generating QR for PDF:', error);
      }
    }

    const element = invoiceRef.current;
    const opt = {
      margin: 0.5,
      filename: `Factura-${invoice.number}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(element).save();
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSendEmail = () => {
    if (customer?.email) {
      setShowEmailDialog(true);
    }
  };

  if (companyLoading || companyDataLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Cargando información de la empresa...</span>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" onClick={onClose}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">
              Factura {invoice.number}
            </h1>
            {invoice.paid_status && (
              <div className="flex items-center space-x-2 bg-green-100 text-green-800 px-3 py-1 rounded-full">
                <Check className="w-4 h-4" />
                <span className="text-sm font-medium">PAGADA</span>
              </div>
            )}
          </div>
          <div className="flex space-x-2">
            {customer?.email && (
              <Button variant="outline" onClick={handleSendEmail}>
                <Mail className="w-4 h-4 mr-2" />
                Enviar Email
              </Button>
            )}
            <Button variant="outline" onClick={handleGeneratePDF}>
              <Download className="w-4 h-4 mr-2" />
              Generar PDF
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <FileText className="w-4 h-4 mr-2" />
              Imprimir
            </Button>
            <Button onClick={onEdit}>
              <Edit2 className="w-4 h-4 mr-2" />
              Editar
            </Button>
          </div>
        </div>

        <div 
          ref={invoiceRef}
          className="bg-white border rounded-lg p-6 max-w-4xl mx-auto relative text-sm flex flex-col" 
          style={{ minHeight: '10.5in', maxHeight: '10.5in' }}
        >
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              {company && (
                <div className="space-y-1">
                  <h2 className="text-lg font-bold text-gray-900">{company.name}</h2>
                  <p className="text-sm text-gray-600">{company.email}</p>
                  {company.phone && <p className="text-sm text-gray-600">{company.phone}</p>}
                  {company.website && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Globe className="w-3 h-3 mr-1" />
                      <a 
                        href={company.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {company.website}
                      </a>
                    </div>
                  )}
                  {company.address_street && (
                    <div className="text-sm text-gray-600">
                      <p>{company.address_street}</p>
                      <p>{company.address_city}, {company.address_state} {company.address_postal_code}</p>
                      <p>{company.address_country}</p>
                    </div>
                  )}
                  <p className="text-sm text-gray-600">CIF: {company.tax_id}</p>
                </div>
              )}
            </div>
            <div className="text-right">
              <h1 className="text-2xl font-bold text-blue-600 mb-1">FACTURA</h1>
              <p className="text-base font-semibold">{invoice.number}</p>
              <div className="flex flex-col items-end space-y-1 mt-1">
                <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                  {getStatusText(invoice.status)}
                </span>
                {invoice.paid_status && (
                  <div className="flex items-center space-x-1 bg-green-100 text-green-800 px-2 py-1 rounded-full">
                    <Check className="w-3 h-3" />
                    <span className="text-xs font-medium">PAGADA</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Invoice Info */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-base font-semibold mb-3">Facturar a:</h3>
              {customer && (
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{customer.name}</p>
                  {customer.email && <p>{customer.email}</p>}
                  {customer.phone && <p>{customer.phone}</p>}
                  {customer.address_street && (
                    <div>
                      <p>{customer.address_street}</p>
                      <p>{customer.address_city}, {customer.address_state} {customer.address_postal_code}</p>
                      <p>{customer.address_country}</p>
                    </div>
                  )}
                  {customer.tax_id && <p>CIF: {customer.tax_id}</p>}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold mb-3">Detalles de la Factura:</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Fecha de Emisión:</span>
                  <span>{new Date(invoice.issue_date).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Fecha de Vencimiento:</span>
                  <span>{new Date(invoice.due_date).toLocaleDateString()}</span>
                </div>
                {invoice.paid_status && invoice.paid_date && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Fecha de Pago:</span>
                    <span className="text-green-600 font-medium">
                      {new Date(invoice.paid_date).toLocaleDateString()}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">Moneda:</span>
                  <span>{invoice.currency}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Content area that will grow to push footer to bottom */}
          <div className="flex-grow">
            {/* Items Table */}
            <div className="mb-6">
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-3 py-2 text-left">Descripción</th>
                    <th className="border border-gray-300 px-3 py-2 text-center">Cantidad</th>
                    <th className="border border-gray-300 px-3 py-2 text-right">Precio Unit.</th>
                    <th className="border border-gray-300 px-3 py-2 text-right">Desc. %</th>
                    <th className="border border-gray-300 px-3 py-2 text-right">IVA %</th>
                    {!invoice.is_intracomunitario && (
                      <th className="border border-gray-300 px-3 py-2 text-right">RE %</th>
                    )}
                    <th className="border border-gray-300 px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {invoiceItems?.map((item, index) => (
                    <React.Fragment key={index}>
                      <tr>
                        <td className="border border-gray-300 px-3 py-2">{item.description}</td>
                        <td className="border border-gray-300 px-3 py-2 text-center">{Number(item.quantity).toFixed(2)}</td>
                        <td className="border border-gray-300 px-3 py-2 text-right">€{Number(item.unit_price).toFixed(2)}</td>
                        <td className="border border-gray-300 px-3 py-2 text-right">{Number(item.discount_percentage || 0).toFixed(1)}%</td>
                        <td className="border border-gray-300 px-3 py-2 text-right">{Number(item.iva_percentage || 0).toFixed(1)}%</td>
                        {!invoice.is_intracomunitario && (
                          <td className="border border-gray-300 px-3 py-2 text-right">{Number(item.re_percentage || 0).toFixed(1)}%</td>
                        )}
                        <td className="border border-gray-300 px-3 py-2 text-right">€{Number(item.total_price).toFixed(2)}</td>
                      </tr>
                      {invoice.is_intracomunitario && (
                        <tr>
                          <td colSpan={6} className="border border-gray-300 px-3 py-1 text-xs text-blue-600 italic">
                            Intracomunitario exento (Bienes)
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-6">
              <div className="w-56 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>€{Number(invoice.subtotal).toFixed(2)}</span>
                </div>
                {!invoice.is_intracomunitario && (
                  <>
                    <div className="flex justify-between">
                      <span>IVA:</span>
                      <span>€{Number(invoice.tax_amount).toFixed(2)}</span>
                    </div>
                    {invoice.re_total > 0 && (
                      <div className="flex justify-between">
                        <span>RE:</span>
                        <span>€{Number(invoice.re_total).toFixed(2)}</span>
                      </div>
                    )}
                  </>
                )}
                <div className="flex justify-between font-bold text-base border-t pt-1">
                  <span>Total:</span>
                  <span>€{Number(invoice.total_amount).toFixed(2)}</span>
                </div>
                {invoice.paid_status && (
                  <div className="flex justify-between text-green-600 font-medium text-sm border-t pt-1">
                    <span>Estado:</span>
                    <span>PAGADA ✓</span>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {invoice.notes && (
              <div className="mb-6">
                <h3 className="text-base font-semibold mb-2">Notas:</h3>
                <p className="text-sm text-gray-700">{invoice.notes}</p>
              </div>
            )}
          </div>

          {/* Footer - now will be pushed to bottom */}
          <div className="text-center text-xs text-gray-500 pt-6 border-t mt-auto">
            {company?.additional_info && (
              <p className="text-blue-600 font-medium">{company.additional_info}</p>
            )}
            
            {/* Verifactu QR Code */}
            {invoice.verifactu_qr_code && invoice.verifactu_csv && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-center space-x-4">
                  <div className="text-left">
                    <p className="text-xs text-gray-600 font-medium mb-1">
                      Factura verificable en Verifactu
                    </p>
                    <p className="text-xs text-gray-500">
                      CSV: {invoice.verifactu_csv}
                    </p>
                    <p className="text-xs text-gray-500">
                      Código de verificación fiscal
                    </p>
                  </div>
                  {qrCodeDataURL && (
                    <div className="flex-shrink-0">
                      <img 
                        src={qrCodeDataURL} 
                        alt="QR Verifactu" 
                        className="w-20 h-20 border border-gray-300"
                        style={{ imageRendering: 'pixelated' }}
                      />
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Escanee el código QR o visite: {invoice.verifactu_qr_code}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <EmailDialog
        isOpen={showEmailDialog}
        onClose={() => setShowEmailDialog(false)}
        documentType="invoice"
        documentId={invoice.id}
        documentNumber={invoice.number}
        customerEmail={customer?.email || ''}
        customerName={customer?.name || ''}
        documentElement={invoiceRef.current}
      />
    </>
  );
};
