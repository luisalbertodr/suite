
import React, { useState } from 'react';
import { useRoles } from '@/hooks/useRoles';
import { usePermissions } from '@/hooks/usePermissions';
import { useUsers } from '@/hooks/useUsers';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, UserPlus, Shield, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { UserListTable } from '@/components/UserListTable';

export const UserManagement = () => {
  const { roles, userRoles, loading: rolesLoading, assignUserRole, removeUserRole } = useRoles();
  const { hasPermission } = usePermissions();
  const { users, loading: usersLoading, fetchUsers, deleteUser } = useUsers();
  const [newUserId, setNewUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // Check if user has permission to manage users
  if (!hasPermission('users', 'read')) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Sin permisos</h3>
          <p className="mt-1 text-sm text-gray-500">
            No tienes permisos para gestionar usuarios.
          </p>
        </div>
      </div>
    );
  }

  const handleAssignRole = async () => {
    if (!newUserId || !selectedRole) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    setIsAssigning(true);
    try {
      // For now, we'll use a placeholder company ID - in a real implementation
      // this would come from the current user's context
      const companyId = '00000000-0000-0000-0000-000000000000';
      
      await assignUserRole(newUserId, companyId, selectedRole);
      setNewUserId('');
      setSelectedRole('');
    } catch (error) {
      // Error already handled in the hook
    } finally {
      setIsAssigning(false);
    }
  };

  const handleRemoveRole = async (userRoleId: string) => {
    if (window.confirm('¿Estás seguro de que quieres remover este rol?')) {
      await removeUserRole(userRoleId);
    }
  };

  const handleDeleteUser = async (userId: string, email: string) => {
    if (window.confirm(`¿Estás seguro de que quieres eliminar el usuario ${email}?`)) {
      await deleteUser(userId);
    }
  };

  const handleEditUser = (user: any) => {
    // TODO: Implement edit user functionality
    toast.info('Funcionalidad de edición en desarrollo');
  };

  const handleRefresh = () => {
    fetchUsers();
  };

  if (rolesLoading || usersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h1>
          <p className="text-gray-600">Administra usuarios y roles de tu empresa</p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {/* Assign Role Form */}
      {hasPermission('users', 'create') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Asignar Rol a Usuario
            </CardTitle>
            <CardDescription>
              Asigna un rol específico a un usuario en tu empresa
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                placeholder="ID del Usuario"
                value={newUserId}
                onChange={(e) => setNewUserId(e.target.value)}
                className="flex-1"
              />
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Seleccionar rol" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.name} - {role.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={handleAssignRole} 
                disabled={isAssigning}
                className="whitespace-nowrap"
              >
                {isAssigning ? 'Asignando...' : 'Asignar Rol'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>Usuarios de la Empresa</CardTitle>
          <CardDescription>
            Lista de usuarios registrados en tu empresa
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserListTable
            users={users}
            loading={usersLoading}
            onDeleteUser={handleDeleteUser}
            onEditUser={handleEditUser}
          />
        </CardContent>
      </Card>
    </div>
  );
};
