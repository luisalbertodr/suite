import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useRoles } from '@/hooks/useRoles';

interface Company {
  id: string;
  name: string;
}

interface UserWithDetails {
  id: string;
  email: string;
  profiles?: {
    company_id: string;
    companies?: {
      name: string;
    };
  };
  user_company_roles?: Array<{
    id: string;
    role: {
      name: string;
    };
  }>;
}

interface EditUserModalProps {
  user: UserWithDetails | null;
  companies: Company[];
  availablePermissions: any[];
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: () => void;
}

const MENU_PERMISSIONS = [
  { resource: 'dashboard', action: 'read', label: 'Dashboard' },
  { resource: 'customers', action: 'read', label: 'Clientes' },
  { resource: 'articles', action: 'read', label: 'Artículos' },
  { resource: 'planillas', action: 'read', label: 'Planillas' },
  { resource: 'quotes', action: 'read', label: 'Presupuestos' },
  { resource: 'presupuestos_n', action: 'read', label: 'PresupuestosN' },
  { resource: 'invoices', action: 'read', label: 'Facturas' },
  { resource: 'delivery_notes', action: 'read', label: 'Alb. Entrada' },
  { resource: 'delivery_notes_out', action: 'read', label: 'Alb. Salida' },
  { resource: 'suppliers', action: 'read', label: 'Proveedores' },
  { resource: 'sales', action: 'read', label: 'TPV' },
  { resource: 'agenda', action: 'read', label: 'Agenda' },
  { resource: 'documents', action: 'read', label: 'Gestión Documental' },
  { resource: 'reports', action: 'read', label: 'Reportes' },
  { resource: 'companies', action: 'read', label: 'Empresas' },
  { resource: 'settings', action: 'read', label: 'Configuración' }
];

export const EditUserModal: React.FC<EditUserModalProps> = ({
  user,
  companies,
  availablePermissions,
  isOpen,
  onClose,
  onUserUpdated
}) => {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [roleId, setRoleId] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  
  const { toast } = useToast();
  const { roles } = useRoles();

  const hasCompaniesPermission = () => {
    const companiesPermission = availablePermissions.find(
      p => p.resource === 'companies' && p.action === 'read'
    );
    return companiesPermission && selectedPermissions.includes(companiesPermission.id);
  };

  const fetchUserPermissions = async (userId: string, userCompanyId: string) => {
    if (!userId || !userCompanyId) return [];
    
    setLoadingPermissions(true);
    try {
      const { data: userPermissions, error: userPermError } = await supabase
        .from('user_permissions')
        .select(`
          permission_id,
          permissions (
            id,
            resource,
            action,
            name
          )
        `)
        .eq('user_id', userId)
        .eq('company_id', userCompanyId);

      if (userPermError) {
        console.error('Error fetching user permissions:', userPermError);
        return [];
      }

      const permissionIds = userPermissions?.map(up => up.permission_id) || [];
      console.log('Current user permissions:', permissionIds);
      return permissionIds;
    } catch (error) {
      console.error('Error in fetchUserPermissions:', error);
      return [];
    } finally {
      setLoadingPermissions(false);
    }
  };

  useEffect(() => {
    const loadUserData = async () => {
      if (user) {
        console.log('Loading user data:', user);
        setEmail(user.email);
        setNewPassword('');
        setCompanyId(user.profiles?.company_id || '');
        setRoleId(user.user_company_roles?.[0]?.role ? 
          roles.find(r => r.name === user.user_company_roles![0].role.name)?.id || '' : '');
        
        if (user.profiles?.company_id) {
          const currentPermissions = await fetchUserPermissions(user.id, user.profiles.company_id);
          setSelectedPermissions(currentPermissions);
          console.log('Setting selected permissions:', currentPermissions);
        }
      }
    };

    if (isOpen && user) {
      loadUserData();
    }
  }, [user, roles, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    try {
      console.log('Starting user update process...');

      if (email !== user.email) {
        console.log('Updating email...');
        const { error: emailError } = await supabase.auth.admin.updateUserById(
          user.id,
          { email }
        );
        if (emailError) throw emailError;
      }

      if (newPassword.trim()) {
        console.log('Updating password...');
        const { error: passwordError } = await supabase.auth.admin.updateUserById(
          user.id,
          { password: newPassword }
        );
        if (passwordError) throw passwordError;
      }

      if (companyId && companyId !== user.profiles?.company_id) {
        console.log('Updating company profile...');
        const { error: profileError } = await supabase
          .from('user_profiles')
          .upsert({
            user_id: user.id,
            company_id: companyId
          });
        if (profileError) throw profileError;
      }

      if (roleId) {
        console.log('Updating user roles...');
        await supabase
          .from('user_company_roles')
          .delete()
          .eq('user_id', user.id);

        const { error: roleError } = await supabase
          .from('user_company_roles')
          .insert({
            user_id: user.id,
            company_id: companyId,
            role_id: roleId
          });
        if (roleError) throw roleError;
      }

      console.log('Updating user permissions...', selectedPermissions);
      const targetCompanyId = companyId || user.profiles?.company_id;
      
      if (targetCompanyId) {
        await supabase
          .from('user_permissions')
          .delete()
          .eq('user_id', user.id)
          .eq('company_id', targetCompanyId);

        if (selectedPermissions.length > 0) {
          const permissionsToInsert = selectedPermissions.map(permissionId => ({
            user_id: user.id,
            company_id: targetCompanyId,
            permission_id: permissionId
          }));

          const { error: permissionsError } = await supabase
            .from('user_permissions')
            .insert(permissionsToInsert);
          
          if (permissionsError) throw permissionsError;
        }
      }

      toast({
        title: "Usuario actualizado",
        description: "Los datos del usuario han sido actualizados correctamente."
      });
      
      onUserUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el usuario: " + (error as any).message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    console.log('Permission change:', permissionId, checked);
    setSelectedPermissions(prev => {
      const newPermissions = checked 
        ? [...prev, permissionId]
        : prev.filter(id => id !== permissionId);
      console.log('New permissions array:', newPermissions);
      return newPermissions;
    });
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Usuario: {user.email}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-password">Nueva Contraseña (opcional)</Label>
              <Input
                id="edit-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Dejar vacío para mantener actual"
              />
            </div>
          </div>

          {hasCompaniesPermission() && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-company">Empresa</Label>
                <Select value={companyId} onValueChange={setCompanyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-role">Rol</Label>
                <Select value={roleId} onValueChange={setRoleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar rol" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <Label className="text-base font-semibold">
              Permisos de Acceso a Secciones
              {loadingPermissions && <span className="text-sm font-normal text-gray-500 ml-2">(Cargando...)</span>}
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {MENU_PERMISSIONS.map((permission) => {
                const matchingPermission = availablePermissions.find(
                  p => p.resource === permission.resource && p.action === permission.action
                );
                
                if (!matchingPermission) return null;
                
                const isChecked = selectedPermissions.includes(matchingPermission.id);
                
                return (
                  <div key={`${permission.resource}-${permission.action}`} className="flex items-start space-x-3 p-3 border rounded-lg">
                    <Checkbox
                      id={`edit-${matchingPermission.id}`}
                      checked={isChecked}
                      onCheckedChange={(checked) => handlePermissionChange(matchingPermission.id, checked as boolean)}
                      disabled={loadingPermissions}
                    />
                    <div className="flex-1">
                      <Label 
                        htmlFor={`edit-${matchingPermission.id}`} 
                        className="font-medium cursor-pointer"
                      >
                        {permission.label}
                      </Label>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-sm text-gray-600">
              Permisos seleccionados: {selectedPermissions.length}
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || loadingPermissions}>
              {loading ? 'Actualizando...' : 'Actualizar Usuario'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
