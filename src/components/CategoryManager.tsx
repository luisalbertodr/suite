
import React, { useState } from 'react';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Save, 
  X,
  FolderOpen
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useDocumentCategories } from '@/hooks/useDocumentCategories';

interface CategoryManagerProps {
  documents: any[];
}

export const CategoryManager: React.FC<CategoryManagerProps> = ({ documents }) => {
  const { 
    categories, 
    createCategory, 
    updateCategory, 
    deleteCategory,
    isCreating,
    isUpdating,
    isDeleting
  } = useDocumentCategories();

  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');

  const getCategoryDocumentCount = (categoryName: string) => {
    return documents.filter(doc => doc.category === categoryName).length;
  };

  const handleStartEdit = (category: any) => {
    setEditingCategory(category.id);
    setEditName(category.name);
    setEditDescription(category.description || '');
  };

  const handleSaveEdit = () => {
    if (editingCategory && editName.trim()) {
      updateCategory({
        id: editingCategory,
        name: editName.trim(),
        description: editDescription.trim() || undefined
      });
      setEditingCategory(null);
      setEditName('');
      setEditDescription('');
    }
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setEditName('');
    setEditDescription('');
  };

  const handleCreateCategory = () => {
    if (newCategoryName.trim()) {
      createCategory({
        name: newCategoryName.trim(),
        description: newCategoryDescription.trim() || undefined
      });
      setNewCategoryName('');
      setNewCategoryDescription('');
      setCreateDialogOpen(false);
    }
  };

  const handleDeleteCategory = (categoryId: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta categoría?')) {
      deleteCategory(categoryId);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Gestión de Categorías</span>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex items-center space-x-2">
                <Plus className="w-4 h-4" />
                <span>Nueva Categoría</span>
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nueva Categoría</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="categoryName">Nombre</Label>
                  <Input
                    id="categoryName"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Nombre de la categoría"
                  />
                </div>
                <div>
                  <Label htmlFor="categoryDescription">Descripción (opcional)</Label>
                  <Input
                    id="categoryDescription"
                    value={newCategoryDescription}
                    onChange={(e) => setNewCategoryDescription(e.target.value)}
                    placeholder="Descripción de la categoría"
                  />
                </div>
                <Button 
                  onClick={handleCreateCategory} 
                  disabled={!newCategoryName.trim() || isCreating}
                  className="w-full"
                >
                  {isCreating ? 'Creando...' : 'Crear Categoría'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {categories.map((category) => (
            <div key={category.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-3 flex-1">
                <FolderOpen className="w-5 h-5 text-blue-500" />
                <div className="flex-1">
                  {editingCategory === category.id ? (
                    <div className="space-y-2">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Nombre de la categoría"
                      />
                      <Input
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Descripción (opcional)"
                      />
                    </div>
                  ) : (
                    <div>
                      <h4 className="font-medium text-gray-900">{category.name}</h4>
                      {category.description && (
                        <p className="text-sm text-gray-600">{category.description}</p>
                      )}
                      <p className="text-sm text-gray-500">
                        {getCategoryDocumentCount(category.name)} documento(s)
                      </p>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex space-x-2">
                {editingCategory === category.id ? (
                  <>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleSaveEdit}
                      disabled={isUpdating}
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleCancelEdit}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleStartEdit(category)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-red-500 hover:text-red-700"
                      onClick={() => handleDeleteCategory(category.id)}
                      disabled={isDeleting}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No hay categorías creadas. Crea tu primera categoría.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
