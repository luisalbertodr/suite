
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, Edit, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface OCRReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  ocrData: any;
  suppliers: any[];
  onConfirm: (processedData: any) => void;
}

export const OCRReviewModal: React.FC<OCRReviewModalProps> = ({
  isOpen,
  onClose,
  ocrData,
  suppliers,
  onConfirm
}) => {
  const [formData, setFormData] = useState<any>({});
  const [items, setItems] = useState<any[]>([]);
  const [showRawText, setShowRawText] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (ocrData?.suggestedDeliveryNote) {
      setFormData({
        number: ocrData.suggestedDeliveryNote.number,
        supplier_id: ocrData.suggestedDeliveryNote.supplier_id || '',
        issue_date: ocrData.suggestedDeliveryNote.issue_date,
        delivery_date: ocrData.suggestedDeliveryNote.delivery_date || '',
        status: ocrData.suggestedDeliveryNote.status,
        notes: ocrData.suggestedDeliveryNote.notes,
        subtotal: ocrData.suggestedDeliveryNote.subtotal,
        tax_amount: ocrData.suggestedDeliveryNote.tax_amount,
        total_amount: ocrData.suggestedDeliveryNote.total_amount
      });
      setItems(ocrData.suggestedDeliveryNote.items || []);
    }
  }, [ocrData]);

  const handleItemChange = (index: number, field: string, value: any) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    if (field === 'quantity' || field === 'unit_price') {
      updatedItems[index].total_price = 
        Number(updatedItems[index].quantity) * Number(updatedItems[index].unit_price);
    }
    
    setItems(updatedItems);
    recalculateTotals(updatedItems);
  };

  const addItem = () => {
    setItems([...items, {
      description: '',
      quantity: 1,
      unit_price: 0,
      total_price: 0
    }]);
  };

  const removeItem = (index: number) => {
    const updatedItems = items.filter((_, i) => i !== index);
    setItems(updatedItems);
    recalculateTotals(updatedItems);
  };

  const recalculateTotals = (updatedItems: any[]) => {
    const subtotal = updatedItems.reduce((sum, item) => sum + Number(item.total_price), 0);
    const tax_amount = subtotal * 0.21;
    const total_amount = subtotal + tax_amount;
    
    setFormData(prev => ({
      ...prev,
      subtotal,
      tax_amount,
      total_amount
    }));
  };

  const handleConfirm = () => {
    if (!formData.supplier_id) {
      toast({
        title: "Error",
        description: "Debe seleccionar un proveedor",
        variant: "destructive"
      });
      return;
    }

    if (items.length === 0) {
      toast({
        title: "Error",
        description: "Debe agregar al menos un artículo",
        variant: "destructive"
      });
      return;
    }

    onConfirm({
      deliveryNote: formData,
      items
    });
  };

  const getConfidenceLevel = () => {
    let score = 0;
    if (ocrData?.extractedData?.supplierInfo?.name) score += 25;
    if (ocrData?.extractedData?.items?.length > 0) score += 25;
    if (ocrData?.extractedData?.totals?.totalAmount > 0) score += 25;
    if (ocrData?.supplierId) score += 25;
    return score;
  };

  const confidenceLevel = getConfidenceLevel();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <span>Revisar datos extraídos del PDF</span>
            <Badge variant={confidenceLevel >= 75 ? "default" : confidenceLevel >= 50 ? "secondary" : "destructive"}>
              {confidenceLevel >= 75 ? (
                <CheckCircle className="w-3 h-3 mr-1" />
              ) : (
                <AlertCircle className="w-3 h-3 mr-1" />
              )}
              Confianza: {confidenceLevel}%
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información del Albarán</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="number">Número</Label>
                <Input
                  id="number"
                  value={formData.number || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, number: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="supplier">Proveedor</Label>
                <Select
                  value={formData.supplier_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, supplier_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar proveedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="issue_date">Fecha de Emisión</Label>
                <Input
                  id="issue_date"
                  type="date"
                  value={formData.issue_date || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, issue_date: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="delivery_date">Fecha de Entrega</Label>
                <Input
                  id="delivery_date"
                  type="date"
                  value={formData.delivery_date || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, delivery_date: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Items */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Artículos</CardTitle>
              <Button onClick={addItem} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Agregar
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-end p-3 border rounded">
                    <div className="col-span-5">
                      <Label className="text-sm">Descripción</Label>
                      <Input
                        value={item.description}
                        onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                        placeholder="Descripción del artículo"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-sm">Cantidad</Label>
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                        min="1"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-sm">Precio Unit.</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.unit_price}
                        onChange={(e) => handleItemChange(index, 'unit_price', Number(e.target.value))}
                        min="0"
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-sm">Total</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={item.total_price}
                        readOnly
                        className="bg-gray-50"
                      />
                    </div>
                    <div className="col-span-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                        className="text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Totales</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4">
              <div>
                <Label>Subtotal</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.subtotal || 0}
                  readOnly
                  className="bg-gray-50"
                />
              </div>
              <div>
                <Label>IVA (21%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.tax_amount || 0}
                  readOnly
                  className="bg-gray-50"
                />
              </div>
              <div>
                <Label>Total</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.total_amount || 0}
                  readOnly
                  className="bg-gray-50 font-bold"
                />
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Notas adicionales..."
              rows={3}
            />
          </div>

          {/* Raw OCR Text */}
          <Card>
            <CardHeader>
              <CardTitle 
                className="text-sm cursor-pointer flex items-center justify-between"
                onClick={() => setShowRawText(!showRawText)}
              >
                Texto extraído del PDF
                <Button variant="ghost" size="sm">
                  <Edit className="w-4 h-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            {showRawText && (
              <CardContent>
                <Textarea
                  value={ocrData?.ocrText || ''}
                  readOnly
                  rows={10}
                  className="font-mono text-sm"
                />
              </CardContent>
            )}
          </Card>

          {/* Actions */}
          <Separator />
          <div className="flex justify-end space-x-3">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Crear Albarán
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
