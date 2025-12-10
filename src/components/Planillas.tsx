
import React, { useState } from 'react';
import { Plus, Edit, Trash2, Calendar, Building2, FileSpreadsheet, CheckCircle, XCircle, Clock } from 'lucide-react';
import { usePlanillas } from '@/hooks/usePlanillas';
import { PlanillaForm } from './PlanillaForm';
import { PlanillaSpreadsheet } from './PlanillaSpreadsheet';
import { toast } from 'sonner';

export const Planillas: React.FC = () => {
  const { planillas, loading, createPlanilla, updatePlanilla, deletePlanilla, isCreating } = usePlanillas();
  const [showForm, setShowForm] = useState(false);
  const [editingPlanilla, setEditingPlanilla] = useState<string | null>(null);

  const handleCreatePlanilla = async (data: any) => {
    try {
      await createPlanilla(data);
      setShowForm(false);
    } catch (error) {
      console.error('Error creating planilla:', error);
    }
  };

  const handleDeletePlanilla = async (id: string) => {
    if (window.confirm('¿Está seguro de que desea eliminar esta planilla?')) {
      try {
        await deletePlanilla(id);
      } catch (error) {
        console.error('Error deleting planilla:', error);
      }
    }
  };

  const handleChangeStatus = async (id: string, newStatus: 'activa' | 'procesada' | 'cancelada') => {
    try {
      await updatePlanilla({ id, data: { estado: newStatus } });
    } catch (error) {
      console.error('Error updating planilla status:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'activa':
        return <Clock className="w-4 h-4 text-blue-600" />;
      case 'procesada':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'cancelada':
        return <XCircle className="w-4 h-4 text-red-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'activa':
        return 'Activa';
      case 'procesada':
        return 'Procesada';
      case 'cancelada':
        return 'Cancelada';
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'activa':
        return 'bg-blue-100 text-blue-800';
      case 'procesada':
        return 'bg-green-100 text-green-800';
      case 'cancelada':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Cargando planillas...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Planillas</h1>
          <p className="text-gray-600 mt-1">
            Gestione las planillas de carga masiva de artículos
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          <span>Nueva Planilla</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <FileSpreadsheet className="w-8 h-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{planillas.length}</p>
              <p className="text-gray-600 text-sm">Total Planillas</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <Clock className="w-8 h-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">
                {planillas.filter(p => p.estado === 'activa').length}
              </p>
              <p className="text-gray-600 text-sm">Activas</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">
                {planillas.filter(p => p.estado === 'procesada').length}
              </p>
              <p className="text-gray-600 text-sm">Procesadas</p>
            </div>
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center">
            <XCircle className="w-8 h-8 text-red-600" />
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">
                {planillas.filter(p => p.estado === 'cancelada').length}
              </p>
              <p className="text-gray-600 text-sm">Canceladas</p>
            </div>
          </div>
        </div>
      </div>

      {/* Planillas List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Código
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fecha
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Proveedor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Creación
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {planillas.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <FileSpreadsheet className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p>No hay planillas creadas</p>
                    <p className="text-sm">Crea tu primera planilla para comenzar</p>
                  </td>
                </tr>
              ) : (
                planillas.map((planilla) => (
                  <tr key={planilla.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <FileSpreadsheet className="w-5 h-5 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-900">
                          {planilla.codigo}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="w-4 h-4 mr-2" />
                        {new Date(planilla.fecha).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-600">
                        <Building2 className="w-4 h-4 mr-2" />
                        {(planilla as any).suppliers?.name || 'Sin proveedor'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(planilla.estado)}
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(planilla.estado)}`}>
                          {getStatusText(planilla.estado)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(planilla.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        {planilla.estado === 'activa' && (
                          <>
                            <button
                              onClick={() => setEditingPlanilla(planilla.id)}
                              className="text-blue-600 hover:text-blue-900 p-1"
                              title="Editar planilla"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <select
                              value={planilla.estado}
                              onChange={(e) => handleChangeStatus(planilla.id, e.target.value as any)}
                              className="text-xs border border-gray-300 rounded px-2 py-1"
                            >
                              <option value="activa">Activa</option>
                              <option value="procesada">Procesada</option>
                              <option value="cancelada">Cancelada</option>
                            </select>
                          </>
                        )}
                        <button
                          onClick={() => handleDeletePlanilla(planilla.id)}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="Eliminar planilla"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {showForm && (
        <PlanillaForm
          onClose={() => setShowForm(false)}
          onSave={handleCreatePlanilla}
          isLoading={isCreating}
        />
      )}

      {editingPlanilla && (
        <PlanillaSpreadsheet
          planillaId={editingPlanilla}
          onClose={() => setEditingPlanilla(null)}
        />
      )}
    </div>
  );
};
