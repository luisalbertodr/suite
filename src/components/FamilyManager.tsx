
import React, { useState } from 'react';
import { X, Plus, Edit, Trash2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFamilies } from '@/hooks/useFamilies';
import { useToast } from '@/hooks/use-toast';

interface FamilyManagerProps {
  onClose: () => void;
}

export const FamilyManager: React.FC<FamilyManagerProps> = ({ onClose }) => {
  const { families, loading, addFamily, removeFamily, updateFamily, error } = useFamilies();
  const { toast } = useToast();
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [newFamily, setNewFamily] = useState({ name: '', description: '' });
  const [isAddingNew, setIsAddingNew] = useState(false);

  const handleAddFamily = async () => {
    if (newFamily.name.trim()) {
      try {
        const success = await addFamily(newFamily.name.trim());
        if (success) {
          setNewFamily({ name: '', description: '' });
          setIsAddingNew(false);
          toast({
            title: "Familia agregada",
            description: `La familia "${newFamily.name}" ha sido agregada exitosamente.`,
          });
        } else {
          toast({
            title: "Error",
            description: "La familia ya existe o el nombre no es válido.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error adding family:', error);
        toast({
          title: "Error",
          description: "Error al agregar la familia.",
          variant: "destructive",
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
            title: "Familia actualizada",
            description: `La familia ha sido actualizada a "${newName}".`,
          });
        } else {
          toast({
            title: "Error",
            description: "La familia ya existe o el nombre no es válido.",
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error('Error updating family:', error);
        toast({
          title: "Error",
          description: "Error al actualizar la familia.",
          variant: "destructive",
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
          title: "Familia eliminada",
          description: `La familia "${familyName}" ha sido eliminada.`,
        });
      } catch (error) {
        console.error('Error deleting family:', error);
        toast({
          title: "Error",
          description: "Error al eliminar la familia.",
          variant: "destructive",
        });
      }
    }
  };

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-gray-900">
                Error al cargar familias
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
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
            <h3 className="text-xl font-semibold text-gray-900">
              Gestionar Familias de Artículos
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {loading && (
            <div className="text-center text-gray-500 py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2">Cargando familias...</p>
            </div>
          )}

          {!loading && (
            <>
              {/* Lista de familias existentes */}
              <div className="space-y-2">
                {families.map((family, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    {editingIndex === index ? (
                      <div className="flex-1 flex items-center space-x-2">
                        <Input
                          defaultValue={family}
                          onBlur={(e) => handleEditFamily(family, e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              handleEditFamily(family, e.currentTarget.value);
                            }
                          }}
                          className="flex-1"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingIndex(null)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="font-medium text-gray-900">{family}</span>
                        <div className="flex space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingIndex(index)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeleteFamily(family)}
                            className="text-red-600 hover:text-red-700"
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

              {/* Añadir nueva familia */}
              {isAddingNew ? (
                <div className="p-4 border-2 border-dashed border-blue-300 rounded-lg space-y-3">
                  <div>
                    <Label htmlFor="family-name">Nombre de la Familia *</Label>
                    <Input
                      id="family-name"
                      value={newFamily.name}
                      onChange={(e) => setNewFamily({ ...newFamily, name: e.target.value })}
                      placeholder="Ej: Routers, Cables, etc."
                      className="mt-1"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleAddFamily();
                        }
                      }}
                    />
                  </div>
                  <div className="flex space-x-2">
                    <Button onClick={handleAddFamily} size="sm" disabled={loading}>
                      <Save className="w-4 h-4 mr-2" />
                      Guardar
                    </Button>
                    <Button
                      onClick={() => {
                        setIsAddingNew(false);
                        setNewFamily({ name: '', description: '' });
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
          <Button
            onClick={onClose}
            variant="outline"
          >
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
};
