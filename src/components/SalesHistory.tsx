
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Download, FileText, Filter, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface Sale {
  id: string;
  ticket_number: string;
  total_amount: number;
  payment_method: string;
  status: string;
  created_at: string;
  customer_name?: string;
  sale_items: {
    description: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }[];
}

interface SalesHistoryProps {
  onBack: () => void;
}

export const SalesHistory: React.FC<SalesHistoryProps> = ({ onBack }) => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: sales = [], isLoading, error } = useQuery({
    queryKey: ['sales-history', dateFrom, dateTo, searchTerm],
    queryFn: async () => {
      console.log('Fetching sales history with filters:', { dateFrom, dateTo, searchTerm });
      
      let query = supabase
        .from('sales')
        .select(`
          id,
          ticket_number,
          total_amount,
          payment_method,
          status,
          created_at,
          customer_name,
          sale_items (
            description,
            quantity,
            unit_price,
            total_price
          )
        `)
        .order('created_at', { ascending: false });

      // Apply date filters
      if (dateFrom) {
        query = query.gte('created_at', `${dateFrom}T00:00:00`);
      }
      if (dateTo) {
        query = query.lte('created_at', `${dateTo}T23:59:59`);
      }

      // Apply search filter
      if (searchTerm.trim()) {
        query = query.or(`ticket_number.ilike.%${searchTerm}%,customer_name.ilike.%${searchTerm}%`);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching sales:', error);
        throw error;
      }
      
      console.log('Sales fetched:', data);
      return data as Sale[];
    }
  });

  const exportToCSV = () => {
    if (sales.length === 0) return;

    const headers = ['Ticket', 'Fecha', 'Total', 'Método de Pago', 'Estado', 'Cliente'];
    const csvContent = [
      headers.join(','),
      ...sales.map(sale => [
        sale.ticket_number,
        format(new Date(sale.created_at), 'dd/MM/yyyy HH:mm'),
        sale.total_amount.toFixed(2),
        sale.payment_method === 'cash' ? 'Efectivo' : 'Tarjeta',
        sale.status === 'completed' ? 'Completada' : sale.status,
        sale.customer_name || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `ventas_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = async () => {
    // For now, we'll create a simple PDF export using window.print
    // In a real implementation, you'd use a library like jsPDF
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Historial de Ventas</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .header { text-align: center; margin-bottom: 20px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Historial de Ventas</h1>
            <p>Generado el ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
          </div>
          <table>
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Fecha</th>
                <th>Total</th>
                <th>Método de Pago</th>
                <th>Estado</th>
                <th>Cliente</th>
              </tr>
            </thead>
            <tbody>
              ${sales.map(sale => `
                <tr>
                  <td>${sale.ticket_number}</td>
                  <td>${format(new Date(sale.created_at), 'dd/MM/yyyy HH:mm')}</td>
                  <td>€${sale.total_amount.toFixed(2)}</td>
                  <td>${sale.payment_method === 'cash' ? 'Efectivo' : 'Tarjeta'}</td>
                  <td>${sale.status === 'completed' ? 'Completada' : sale.status}</td>
                  <td>${sale.customer_name || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.print();
  };

  const getTotalSales = () => {
    return sales.reduce((sum, sale) => sum + sale.total_amount, 0);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center">
          <Button
            onClick={onBack}
            variant="outline"
            className="mr-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Volver al TPV
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <FileText className="w-8 h-8 mr-3 text-blue-600" />
              Historial de Ventas
            </h1>
            <p className="text-gray-600 mt-2">Consulta las ventas realizadas</p>
          </div>
        </div>
        <div className="flex space-x-2">
          <Button
            onClick={exportToCSV}
            variant="outline"
            disabled={sales.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
          <Button
            onClick={exportToPDF}
            variant="outline"
            disabled={sales.length === 0}
          >
            <FileText className="w-4 h-4 mr-2" />
            Exportar PDF
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="w-5 h-5 mr-2" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="dateFrom">Fecha desde</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="dateTo">Fecha hasta</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="search">Buscar</Label>
              <Input
                id="search"
                placeholder="Ticket o cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                  setSearchTerm('');
                }}
                variant="outline"
                className="w-full"
              >
                Limpiar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-blue-600">{sales.length}</div>
            <p className="text-gray-600">Total de ventas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-green-600">€{getTotalSales().toFixed(2)}</div>
            <p className="text-gray-600">Monto total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl font-bold text-purple-600">€{sales.length > 0 ? (getTotalSales() / sales.length).toFixed(2) : '0.00'}</div>
            <p className="text-gray-600">Venta promedio</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de ventas */}
      <Card>
        <CardHeader>
          <CardTitle>Listado de Ventas</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Cargando ventas...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500">Error al cargar las ventas</p>
            </div>
          ) : sales.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No se encontraron ventas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Método de Pago</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Items</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-medium">{sale.ticket_number}</TableCell>
                      <TableCell>
                        {format(new Date(sale.created_at), 'dd/MM/yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="font-medium">€{sale.total_amount.toFixed(2)}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          sale.payment_method === 'cash' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {sale.payment_method === 'cash' ? 'Efectivo' : 'Tarjeta'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          sale.status === 'completed' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {sale.status === 'completed' ? 'Completada' : sale.status}
                        </span>
                      </TableCell>
                      <TableCell>{sale.customer_name || '-'}</TableCell>
                      <TableCell>
                        <div className="text-xs text-gray-600">
                          {sale.sale_items.map((item, index) => (
                            <div key={index}>
                              {item.quantity}x {item.description}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
