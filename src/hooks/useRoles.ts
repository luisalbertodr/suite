
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Role {
  id: string;
  name: string;
  description: string;
  is_system_role: boolean;
  created_at: string;
  updated_at: string;
}

export interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  created_at: string;
}

export interface UserCompanyRole {
  id: string;
  user_id: string;
  company_id: string;
  role_id: string;
  created_at: string;
  updated_at: string;
  role?: Role;
}

export const useRoles = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userRoles, setUserRoles] = useState<UserCompanyRole[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setRoles(data || []);
    } catch (error) {
      console.error('Error fetching roles:', error);
      toast.error('Error al cargar los roles');
    }
  };

  const fetchPermissions = async () => {
    try {
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setPermissions(data || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      toast.error('Error al cargar los permisos');
    }
  };

  const fetchUserRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('user_company_roles')
        .select(`
          *,
          role:roles(*)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setUserRoles(data || []);
    } catch (error) {
      console.error('Error fetching user roles:', error);
      toast.error('Error al cargar los roles de usuario');
    }
  };

  const assignUserRole = async (userId: string, companyId: string, roleId: string) => {
    try {
      const { error } = await supabase
        .from('user_company_roles')
        .insert([{
          user_id: userId,
          company_id: companyId,
          role_id: roleId
        }]);

      if (error) throw error;
      
      toast.success('Rol asignado correctamente');
      await fetchUserRoles();
    } catch (error) {
      console.error('Error assigning role:', error);
      toast.error('Error al asignar el rol: ' + (error as any).message);
      throw error;
    }
  };

  const removeUserRole = async (userRoleId: string) => {
    try {
      const { error } = await supabase
        .from('user_company_roles')
        .delete()
        .eq('id', userRoleId);

      if (error) throw error;
      
      toast.success('Rol removido correctamente');
      await fetchUserRoles();
    } catch (error) {
      console.error('Error removing role:', error);
      toast.error('Error al remover el rol: ' + (error as any).message);
      throw error;
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchRoles(),
        fetchPermissions(),
        fetchUserRoles()
      ]);
      setLoading(false);
    };

    loadData();
  }, []);

  return {
    roles,
    permissions,
    userRoles,
    loading,
    assignUserRole,
    removeUserRole,
    refetch: async () => {
      await Promise.all([
        fetchRoles(),
        fetchPermissions(),
        fetchUserRoles()
      ]);
    }
  };
};
