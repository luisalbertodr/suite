
import React, { useState } from 'react';
import { X, Plus, Edit, Trash2, Save, ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFamilies } from '@/hooks/useFamilies';
import { useToast } from '@/hooks/use-toast';
import { BillingCompanySelect } from '@/components/forms/BillingCompanySelect';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { companyDisplayName } from '@/lib/billingCompany';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

interface FamilyManagerProps {
  onClose: () => void;
}

export const FamilyManager: React.FC<FamilyManagerProps> = ({ onClose }) => {
  const {
    families,
    loading,
    addFamily,
    removeFamily,
    updateFamily,
    updateFamilyBilling,
    releaseFamilyFromBilling,
    siblingBillingLabel,
    error,
  } = useFamilies();
  const { billingCompanies, isMultiEntity, companyLabels } = useWorkCenter();
  const { companyId } = useCompanyFilter();
  const currentCompanyLabel =
    (companyId && companyLabels.get(companyId)) ||
    billingCompanies.find((c) => c.id === companyId)?.name ||
    'esta empresa';
  const { toast } = useToast();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newFamily, setNewFamily] = useState({ name: '', billing_company_id: null as string | null });
  const [isAddingNew, setIsAddingNew] = useState(false);

  const billingLabel = (id: string | null | undefined) => {
    if (!id || !isMultiEntity) return null;
    return companyLabels.get(id) ?? billingCompanies.find((c) => c.id === id)?.name ?? id;
  };

  const handleAddFamily = async () => {
    if (newFamily.name.trim()) {
      try {
        const success = await addFamily(newFamily.name.trim(), newFamily.billing_company_id);
        if (success) {
          setNewFamily({ name: '', billing_company_id: null });
          setIsAddingNew(false);
          toast({
            title: 'Familia agregada',
            description: `La familia "${newFamily.name}" ha sido agregada exitosamente.`,
          });
        } else {
          toast({
            title: 'Error',
            description: 'La familia ya existe o el nombre no es válido.',
            variant: 'destructive',
          });
        }
      } catch (err) {
        console.error('Error adding family:', err);
        toast({
          title: 'Error',
          description: 'Error al agregar la familia.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleEditFamily = async (oldName: string, newName: string) => {
    if (newName.trim() && newName !== oldName) {
      try {
        const success = await updateFamily(oldName, newName.trim());
        if (success) {
          setEditingIndex(null);
          toast({
            title: 'Familia actualizada',
            description: `La familia ha sido actualizada a "${newName}".`,
          });
        } else {
          toast({
            title: 'Error',
            description: 'La familia ya existe o el nombre no es válido.',
            variant: 'destructive',
          });
        }
      } catch (err) {
        console.error('Error updating family:', err);
        toast({
          title: 'Error',
          description: 'Error al actualizar la familia.',
          variant: 'destructive',
        });
      }
    } else {
      setEditingIndex(null);
    }
  };

  const handleDeleteFamily = async (familyName: string) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar la familia "${familyName}"?`)) {
      try {
        await removeFamily(familyName);
        toast({
          title: 'Familia eliminada',
          description: `La familia "${familyName}" ha sido eliminada.`,
        });
      } catch (err) {
        console.error('Error deleting family:', err);
        toast({
          title: 'Error',
          description: 'Error al eliminar la familia.',
          variant: 'destructive',
        });
      }
    }
  };

  const handleReleaseFamily = async (family: { id: string; name: string }) => {
    if (!siblingBillingLabel) return;
    const ok = window.confirm(
      `¿Quitar la familia «${family.name}» de ${currentCompanyLabel}?\n\n` +
        `Pasará a ${siblingBillingLabel} para que puedas reasignarla después. ` +
        'Los artículos de esa familia con el mismo emisor también se moverán.',
    );
    if (!ok) return;
    try {
      await releaseFamilyFromBilling(family);
      toast({
        title: 'Familia desasignada',
        description: `«${family.name}» ya no aparece en ${currentCompanyLabel}. Reasígnala desde ${siblingBillingLabel}.`,
      });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'No se pudo desasignar la familia.',
        variant: 'destructive',
      });
    }
  };

  const handleBillingChange = async (familyId: string, billing_company_id: string | null) => {
    try {
      await updateFamilyBilling({ familyId, billing_company_id });
      toast({ title: 'Empresa emisora actualizada' });
    } catch (err) {
      console.error(err);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la empresa emisora.',
        variant: 'destructive',
      });
    }
  };

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">Error al cargar familias</h3>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
          <div className="p-6">
            <p className="text-red-600 mb-4">
              No se pudieron cargar las familias de artículos. Por favor, intenta de nuevo.
            </p>
            <Button onClick={onClose} variant="outline">
              Cerrar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-gray-900">Gestionar Familias de Artículos</h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>
          {isMultiEntity && (
            <p className="text-sm text-muted-foreground mt-2">
              Solo se listan familias de <strong>{currentCompanyLabel}</strong>. Al quitar una,
              pasa a <strong>{siblingBillingLabel ?? 'la otra empresa'}</strong> para reasignarla.
            </p>
          )}
        </div>

        <div className="p-6 space-y-4">
          {loading && (
            <div className="text-center text-gray-500 py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
              <p className="mt-2">Cargando familias...</p>
            </div>
          )}

          {!loading && (
            <>
              <div className="space-y-2">
                {families.map((family, index) => (
                  <div
                    key={family.id}
                    className="flex flex-col gap-2 p-3 border border-gray-200 rounded-lg sm:flex-row sm:items-center sm:justify-between"
                  >
                    {editingIndex === index ? (
                      <div className="flex-1 flex items-center space-x-2">
                        <Input
                          defaultValue={family.name}
                          onBlur={(e) => handleEditFamily(family.name, e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleEditFamily(family.name, e.currentTarget.value);
                            }
                          }}
                          className="flex-1"
                          autoFocus
                        />
                        <Button size="sm" variant="outline" onClick={() => setEditingIndex(null)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-gray-900">{family.name}</span>
                          {isMultiEntity && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Emisor: {billingLabel(family.billing_company_id) ?? 'Por defecto (tenant)'}
                            </p>
                          )}
                          {isMultiEntity && (
                            <div className="mt-2 max-w-xs">
                              <BillingCompanySelect
                                value={family.billing_company_id}
                                onChange={(id) => handleBillingChange(family.id, id)}
                                label="Empresa emisora"
                                inheritLabel="Por defecto (tenant)"
                              />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                          {isMultiEntity && siblingBillingLabel && (
                            <Button
                              size="sm"
                              variant="outline"
                              title={`Mover a ${siblingBillingLabel}`}
                              onClick={() => handleReleaseFamily({ id: family.id, name: family.name })}
                            >
                              <ArrowRightLeft className="w-4 h-4 mr-1" />
                              Quitar
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => setEditingIndex(index)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteFamily(family.name)}
                            className="text-red-600 hover:text-red-700"
                            title="Eliminar del catálogo (todas las empresas)"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}

                {!loading && families.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p>No hay familias de artículos creadas.</p>
                    <p className="text-sm">Añade tu primera familia para comenzar.</p>
                  </div>
                )}
              </div>

              {isAddingNew ? (
                <div className="p-4 border-2 border-dashed border-blue-300 rounded-lg space-y-3">
                  <div>
                    <Label htmlFor="family-name">Nombre de la Familia *</Label>
                    <Input
                      id="family-name"
                      value={newFamily.name}
                      onChange={(e) => setNewFamily({ ...newFamily, name: e.target.value })}
                      placeholder="Ej: Estética, Medicina, etc."
                      className="mt-1"
                    />
                  </div>
                  {isMultiEntity && (
                    <BillingCompanySelect
                      value={newFamily.billing_company_id}
                      onChange={(id) => setNewFamily({ ...newFamily, billing_company_id: id })}
                      inheritLabel="Por defecto (tenant)"
                    />
                  )}
                  <div className="flex space-x-2">
                    <Button onClick={handleAddFamily} size="sm" disabled={loading}>
                      <Save className="w-4 h-4 mr-2" />
                      Guardar
                    </Button>
                    <Button
                      onClick={() => {
                        setIsAddingNew(false);
                        setNewFamily({ name: '', billing_company_id: null });
                      }}
                      size="sm"
                      variant="outline"
                    >
                      <X className="w-4 h-4 mr-2" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  onClick={() => setIsAddingNew(true)}
                  className="w-full border-2 border-dashed border-gray-300 text-gray-600 hover:border-blue-400 hover:text-blue-600"
                  variant="outline"
                  disabled={loading}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Añadir Nueva Familia
                </Button>
              )}
            </>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
          <Button onClick={onClose} variant="outline">
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
};
