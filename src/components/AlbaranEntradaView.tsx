
import React, { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Edit2, FileText, Download, Globe, Mail } from 'lucide-react';
import html2pdf from 'html2pdf.js';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { EmailDialog } from './EmailDialog';

interface DeliveryNote {
  id: string;
  number: string;
  supplier_id: string;
  issue_date: string;
  delivery_date: string | null;
  status: string;
  notes?: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
}

interface AlbaranEntradaViewProps {
  deliveryNote: DeliveryNote;
  onClose: () => void;
  onEdit: () => void;
}

export const AlbaranEntradaView: React.FC<AlbaranEntradaViewProps> = ({ 
  deliveryNote, 
  onClose, 
  onEdit 
}) => {
  const deliveryNoteRef = useRef<HTMLDivElement>(null);
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const { companyId, loading: companyLoading } = useCompanyFilter();

  const { data: supplier } = useQuery({
    queryKey: ['supplier', deliveryNote.supplier_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('id', deliveryNote.supplier_id)
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  const { data: deliveryNoteItems } = useQuery({
    queryKey: ['delivery-note-items', deliveryNote.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('delivery_note_items')
        .select('*')
        .eq('delivery_note_id', deliveryNote.id);
      
      if (error) throw error;
      return data;
    },
  });

  const { data: company, isLoading: companyDataLoading } = useQuery({
    queryKey: ['company', companyId],
    queryFn: async () => {
      if (!companyId) return null;

      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && !companyLoading,
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'text-green-600 bg-green-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'cancelled': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'delivered': return 'Entregado';
      case 'cancelled': return 'Cancelado';
      default: return status;
    }
  };

  const handleGeneratePDF = () => {
    if (!deliveryNoteRef.current) return;

    const element = deliveryNoteRef.current;
    const opt = {
      margin: 0.5,
      filename: `Albaran-Entrada-${deliveryNote.number}.pdf`,
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
    if (supplier?.email) {
      setShowEmailDialog(true);
    }
  };

  if (companyLoading || companyDataLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Cargando información...</span>
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
              Albarán de Entrada {deliveryNote.number}
            </h1>
          </div>
          <div className="flex space-x-2">
            {supplier?.email && (
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
          ref={deliveryNoteRef}
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
              <h1 className="text-2xl font-bold text-blue-600 mb-1">ALBARÁN DE ENTRADA</h1>
              <p className="text-base font-semibold">{deliveryNote.number}</p>
              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(deliveryNote.status)} mt-1`}>
                {getStatusText(deliveryNote.status)}
              </span>
            </div>
          </div>

          {/* Document Info */}
          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-base font-semibold mb-3">Proveedor:</h3>
              {supplier && (
                <div className="space-y-1 text-sm">
                  <p className="font-medium">{supplier.name}</p>
                  {supplier.email && <p>{supplier.email}</p>}
                  {supplier.phone && <p>{supplier.phone}</p>}
                  {supplier.address_street && (
                    <div>
                      <p>{supplier.address_street}</p>
                      <p>{supplier.address_city}, {supplier.address_state} {supplier.address_postal_code}</p>
                      <p>{supplier.address_country}</p>
                    </div>
                  )}
                  {supplier.tax_id && <p>CIF: {supplier.tax_id}</p>}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold mb-3">Detalles del Albarán:</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Fecha de Emisión:</span>
                  <span>{new Date(deliveryNote.issue_date).toLocaleDateString()}</span>
                </div>
                {deliveryNote.delivery_date && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Fecha de Entrega:</span>
                    <span>{new Date(deliveryNote.delivery_date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content area */}
          <div className="flex-grow">
            {/* Items Table */}
            <div className="mb-6">
              <table className="w-full border-collapse border border-gray-300 text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 px-3 py-2 text-left">Descripción</th>
                    <th className="border border-gray-300 px-3 py-2 text-center">Cantidad</th>
                    <th className="border border-gray-300 px-3 py-2 text-right">Precio Unit.</th>
                    <th className="border border-gray-300 px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveryNoteItems?.map((item, index) => (
                    <tr key={index}>
                      <td className="border border-gray-300 px-3 py-2">{item.description}</td>
                      <td className="border border-gray-300 px-3 py-2 text-center">{Number(item.quantity).toFixed(2)}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right">€{Number(item.unit_price).toFixed(2)}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right">€{Number(item.total_price).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-6">
              <div className="w-56 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span>€{Number(deliveryNote.subtotal).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>IVA (21%):</span>
                  <span>€{Number(deliveryNote.tax_amount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t pt-1">
                  <span>Total:</span>
                  <span>€{Number(deliveryNote.total_amount).toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            {deliveryNote.notes && (
              <div className="mb-6">
                <h3 className="text-base font-semibold mb-2">Notas:</h3>
                <p className="text-sm text-gray-700">{deliveryNote.notes}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-500 pt-6 border-t mt-auto">
            {company?.additional_info && (
              <p className="text-blue-600 font-medium">{company.additional_info}</p>
            )}
          </div>
        </div>
      </div>

      <EmailDialog
        isOpen={showEmailDialog}
        onClose={() => setShowEmailDialog(false)}
        documentType="delivery_note"
        documentId={deliveryNote.id}
        documentNumber={deliveryNote.number}
        customerEmail={supplier?.email || ''}
        customerName={supplier?.name || ''}
        documentElement={deliveryNoteRef.current}
      />
    </>
  );
};
