
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CustomerSelector } from '@/components/forms/CustomerSelector';

interface DeliveryNoteHeaderProps {
  formData: any;
  setFormData: (data: any) => void;
  suppliers: Array<{ id: string; name: string }>;
  isExit?: boolean;
}

export const DeliveryNoteHeader: React.FC<DeliveryNoteHeaderProps> = ({
  formData,
  setFormData,
  suppliers,
  isExit = false
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Información General</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <Label htmlFor="number">Número de Albarán</Label>
          <Input
            id="number"
            value={formData.number}
            onChange={(e) => setFormData({ ...formData, number: e.target.value })}
            required
          />
        </div>
        
        <div>
          {isExit ? (
            <CustomerSelector 
              customers={suppliers}
              value={formData.customer_id}
              onChange={(value) => setFormData({ ...formData, customer_id: value })}
              required
            />
          ) : (
            <>
              <Label htmlFor="supplier_id">Proveedor</Label>
              <select
                id="supplier_id"
                value={formData.supplier_id}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Seleccionar proveedor...</option>
                {suppliers?.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        <div>
          <Label htmlFor="issue_date">Fecha de Emisión</Label>
          <Input
            id="issue_date"
            type="date"
            value={formData.issue_date}
            onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
            required
          />
        </div>

        <div>
          <Label htmlFor="delivery_date">Fecha de Entrega</Label>
          <Input
            id="delivery_date"
            type="date"
            value={formData.delivery_date || ''}
            onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value || null })}
          />
        </div>

        <div>
          <Label htmlFor="status">Estado</Label>
          <select
            id="status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="pending">Pendiente</option>
            <option value="dispatched">{isExit ? "Despachado" : "En tránsito"}</option>
            <option value="delivered">{isExit ? "Entregado" : "Recibido"}</option>
            <option value="cancelled">Cancelado</option>
          </select>
        </div>

        <div className="md:col-span-2 lg:col-span-3">
          <Label htmlFor="notes">Notas</Label>
          <Textarea
            id="notes"
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            rows={3}
            placeholder="Notas adicionales..."
          />
        </div>
      </CardContent>
    </Card>
  );
};
