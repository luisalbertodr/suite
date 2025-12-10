import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Plus, FileText, Edit, Trash2, Eye } from 'lucide-react';
import { usePresupuestosN } from '@/hooks/usePresupuestosN';
import { PresupuestoNForm } from './PresupuestoNForm';
import { PresupuestoNView } from './PresupuestoNView';

export const PresupuestosN: React.FC = () => {
  const { presupuestosN, loading, deletePresupuestoN, fetchPresupuestosN } = usePresupuestosN();
  const [showForm, setShowForm] = useState(false);
  const [editingPresupuesto, setEditingPresupuesto] = useState<string | null>(null);
  const [viewingPresupuesto, setViewingPresupuesto] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPresupuestosN = presupuestosN.filter(presupuesto =>
    presupuesto.number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    presupuesto.customer?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este presupuesto?')) {
      await deletePresupuestoN(id);
    }
  };

  if (showForm || editingPresupuesto) {
    return (
      <PresupuestoNForm
        presupuestoId={editingPresupuesto || undefined}
        onCancel={() => {
          setShowForm(false);
          setEditingPresupuesto(null);
        }}
        onSuccess={() => {
          setShowForm(false);
          setEditingPresupuesto(null);
          fetchPresupuestosN(); // Refresh the list after save
        }}
      />
    );
  }

  if (viewingPresupuesto) {
    console.log('🔍 Navigating to view presupuesto:', viewingPresupuesto);
    return (
      <PresupuestoNView
        presupuestoId={viewingPresupuesto}
        onBack={() => setViewingPresupuesto(null)}
        onEdit={() => {
          setEditingPresupuesto(viewingPresupuesto);
          setViewingPresupuesto(null);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">PresupuestosN</h1>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Presupuesto
        </Button>
      </div>

      <div className="flex gap-4">
        <Input
          placeholder="Buscar por número o cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Lista de PresupuestosN
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredPresupuestosN.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron presupuestos
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Número</th>
                    <th className="text-left p-2">Cliente</th>
                    <th className="text-left p-2">Fecha Emisión</th>
                    <th className="text-left p-2">Estado</th>
                    <th className="text-left p-2">Total</th>
                    <th className="text-left p-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPresupuestosN.map((presupuesto) => (
                    <tr key={presupuesto.id} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-mono text-sm">{presupuesto.number}</td>
                      <td className="p-2">{presupuesto.customer?.name}</td>
                      <td className="p-2">
                        {new Date(presupuesto.issue_date).toLocaleDateString()}
                      </td>
                      <td className="p-2">
                        <Badge className={getStatusColor(presupuesto.status)}>
                          {getStatusText(presupuesto.status)}
                        </Badge>
                      </td>
                      <td className="p-2 font-semibold">
                        {presupuesto.total_amount.toFixed(2)} €
                      </td>
                      <td className="p-2">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                        onClick={() => {
                          console.log('🔍 Clicking view for presupuesto:', presupuesto.id, 'status:', presupuesto.status);
                          setViewingPresupuesto(presupuesto.id);
                        }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingPresupuesto(presupuesto.id)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(presupuesto.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};