import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PermissionButton } from '@/components/PermissionButton';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Trash2, Ban } from 'lucide-react';
import {
  cancelSaleTicket,
  deleteSaleTicket,
  fetchSaleTicketDetail,
  updateSaleTicket,
  type SaleTicketDetail,
} from '@/lib/tpvSaleOperations';

interface Props {
  saleId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

export const SaleTicketManageDialog: React.FC<Props> = ({
  saleId,
  open,
  onOpenChange,
  onUpdated,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<SaleTicketDetail | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    if (!open || !saleId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchSaleTicketDetail(saleId)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        if (d) {
          setPaymentMethod((d.sale.payment_method === 'card' ? 'card' : 'cash') as 'cash' | 'card');
          setCustomerName(d.sale.customer_name ?? '');
          setNotes(d.sale.notes ?? '');
        }
      })
      .catch((e) => {
        if (!cancelled) {
          toast({
            title: 'Error al cargar ticket',
            description: e instanceof Error ? e.message : 'Error desconocido',
            variant: 'destructive',
          });
          onOpenChange(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, saleId, onOpenChange, toast]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['sales-history'] });
    queryClient.invalidateQueries({ queryKey: ['sales'] });
    queryClient.invalidateQueries({ queryKey: ['appointment-sale'] });
    queryClient.invalidateQueries({ queryKey: ['audit_events'] });
    onUpdated?.();
  };

  const handleSave = async () => {
    if (!saleId || !detail) return;
    if (detail.sale.status === 'cancelled') {
      toast({ title: 'Ticket anulado', description: 'No se puede editar un ticket anulado.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await updateSaleTicket(saleId, {
        payment_method: paymentMethod,
        customer_name: customerName,
        notes,
      });
      toast({ title: 'Ticket actualizado', description: 'Los cambios quedan registrados en auditoría.' });
      invalidate();
      onOpenChange(false);
    } catch (e) {
      toast({
        title: 'Error al guardar',
        description: e instanceof Error ? e.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async () => {
    if (!saleId) return;
    if (!window.confirm('¿Anular este ticket? La cita volverá a aparecer como pendiente de cobro si aplica.')) return;
    setSaving(true);
    try {
      await cancelSaleTicket(saleId, cancelReason.trim() || undefined);
      toast({ title: 'Ticket anulado', description: 'Queda constancia en el registro de auditoría.' });
      invalidate();
      onOpenChange(false);
    } catch (e) {
      toast({
        title: 'No se pudo anular',
        description: e instanceof Error ? e.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!saleId) return;
    if (!window.confirm('¿Eliminar definitivamente este ticket? Solo úsalo si se creó por error.')) return;
    setSaving(true);
    try {
      await deleteSaleTicket(saleId);
      toast({ title: 'Ticket eliminado', description: 'Operación registrada en auditoría.' });
      invalidate();
      onOpenChange(false);
    } catch (e) {
      toast({
        title: 'No se pudo eliminar',
        description: e instanceof Error ? e.message : 'Error desconocido',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const isCancelled = detail?.sale.status === 'cancelled';
  const hasInvoice = !!detail?.sale.invoice_id;
  const canEdit = !isCancelled && !hasInvoice;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {detail ? `Ticket ${detail.sale.ticket_number}` : 'Ticket TPV'}
          </DialogTitle>
          <DialogDescription>
            Las modificaciones, anulaciones y borrados quedan en el log de auditoría (Configuración → Auditoría).
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            Cargando…
          </div>
        ) : detail ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Fecha</span>
                <p className="font-medium">
                  {format(new Date(detail.sale.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Total</span>
                <p className="font-medium">{detail.sale.total_amount.toFixed(2)} €</p>
              </div>
              <div>
                <span className="text-muted-foreground">Estado</span>
                <p className="font-medium capitalize">{detail.sale.status ?? '—'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Factura</span>
                <p className="font-medium">{hasInvoice ? 'Vinculada' : 'Sin facturar'}</p>
              </div>
            </div>

            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right w-12">Ud.</TableHead>
                    <TableHead className="text-right w-20">Importe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="text-xs">{it.description}</TableCell>
                      <TableCell className="text-right text-xs">{it.quantity}</TableCell>
                      <TableCell className="text-right text-xs">{it.total_price.toFixed(2)} €</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {canEdit && (
              <>
                <div>
                  <Label>Método de pago</Label>
                  <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as 'cash' | 'card')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Efectivo</SelectItem>
                      <SelectItem value="card">Tarjeta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Cliente (nombre en ticket)</Label>
                  <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </div>
                <div>
                  <Label>Notas / observaciones</Label>
                  <Textarea
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="JSON de cita o notas internas"
                  />
                </div>
              </>
            )}

            {canEdit && (
              <div>
                <Label>Motivo de anulación (opcional)</Label>
                <Input
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Ej. error de importe, cobro duplicado…"
                />
              </div>
            )}
          </div>
        ) : null}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {canEdit && (
            <>
              <PermissionButton
                resource="sales"
                action="update"
                onClick={() => void handleSave()}
                disabled={saving}
                className="sm:mr-auto"
              >
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </PermissionButton>
              <PermissionButton
                resource="sales"
                action="update"
                variant="outline"
                onClick={() => void handleCancel()}
                disabled={saving}
              >
                <Ban className="w-4 h-4 mr-1" />
                Anular ticket
              </PermissionButton>
              <PermissionButton
                resource="sales"
                action="delete"
                variant="destructive"
                onClick={() => void handleDelete()}
                disabled={saving}
                whenForbidden="hide"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Eliminar
              </PermissionButton>
            </>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
