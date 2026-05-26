
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface UserWithDetails {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at?: string;
  email_confirmed_at?: string;
  profiles?: {
    company_id: string;
    employee_id?: string | null;
    companies?: {
      name: string;
    };
  };
  employee_name?: string | null;
  permission_ids?: string[];
  user_company_roles?: Array<{
    id: string;
    role: {
      name: string;
      description: string;
    };
  }>;
}

interface CreateUserPayload {
  email: string;
  password: string;
  company_id: string;
  role_id: string;
  employee_id?: string | null;
  permissions?: string[];
}

interface UpdateUserPayload {
  userId: string;
  role_id?: string;
  company_id?: string;
  employee_id?: string | null;
  permission_ids?: string[];
  /**
   * Nueva contraseña para el usuario. Solo se aplica si quien llama tiene el
   * permiso `users:update` (o es superuser). Se valida también en la Edge
   * Function `main`. Mínimo 6 caracteres.
   */
  password?: string;
}

export const useUsers = () => {
  const supabaseApiKey =
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
    '';

  const getMainErrorMessage = async (payload: Record<string, unknown>) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/main`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseApiKey,
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify(payload),
      });
      const body = await resp.json().catch(() => null) as { error?: string; code?: string } | null;
      if (body?.error && body?.code) return `${body.error} (${body.code})`;
      if (body?.error) return body.error;
      return `main returned HTTP ${resp.status}`;
    } catch {
      return null;
    }
  };

  const [users, setUsers] = useState<UserWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const { isSuperuser } = useAuth();

  const fetchUsers = async () => {
    try {
      setLoading(true);
      console.log('Fetching users...', { isSuperuser });

      // Get current session for authorization
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      // Add authorization header if we have a session
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const { data, error } = await supabase.functions.invoke('main', {
        headers
        ,
        body: {
          action: 'listUsers',
          isSuperuser,
        },
      });

      console.log('Users response:', { data, error, isSuperuser });

      if (error) {
        console.error('Error fetching users:', error);
        toast.error('Error al cargar los usuarios');
        setUsers([]);
        return;
      }

      if (data?.success) {
        setUsers(data.users || []);
        console.log(`Loaded ${data.users?.length || 0} users for ${isSuperuser ? 'superuser' : 'regular user'}`);
      } else {
        console.error('Failed to fetch users:', data?.error);
        toast.error(data?.error || 'Error al cargar los usuarios');
        setUsers([]);
      }
    } catch (error) {
      console.error('Error in fetchUsers:', error);
      toast.error('Error al cargar los usuarios');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const { data, error } = await supabase.functions.invoke('main', {
        headers,
        body: {
          action: 'deleteUser',
          userId,
        },
      });

      if (error) {
        console.error('Error deleting user:', error);
        toast.error('Error al eliminar el usuario');
        return false;
      }

      if (data?.success) {
        toast.success('Usuario eliminado correctamente');
        await fetchUsers(); // Refresh the list
        return true;
      } else {
        toast.error(data?.error || 'Error al eliminar el usuario');
        return false;
      }
    } catch (error) {
      console.error('Error in deleteUser:', error);
      toast.error('Error al eliminar el usuario');
      return false;
    }
  };

  const createUser = async (payload: CreateUserPayload) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const { data, error } = await supabase.functions.invoke('main', {
        headers,
        body: {
          action: 'createUser',
          payload,
        },
      });

      if (error) {
        console.error('Error creating user:', error);
        toast.error('Error al crear el usuario');
        return false;
      }

      if (data?.success) {
        toast.success('Usuario creado correctamente');
        await fetchUsers();
        return true;
      }

      toast.error(data?.error || 'Error al crear el usuario');
      return false;
    } catch (error) {
      console.error('Error in createUser:', error);
      toast.error('Error al crear el usuario');
      return false;
    }
  };

  const updateUser = async (payload: UpdateUserPayload) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const { data, error } = await supabase.functions.invoke('main', {
        headers,
        body: {
          action: 'updateUser',
          ...payload,
        },
      });

      if (error) {
        console.error('Error updating user:', error);
        const detail = await getMainErrorMessage({ action: 'updateUser', ...payload });
        toast.error(detail || 'Error al actualizar el usuario (función main)');
        return false;
      }

      if (data?.success) {
        toast.success('Usuario actualizado correctamente');
        await fetchUsers();
        return true;
      }

      toast.error(data?.error || 'Error al actualizar el usuario');
      return false;
    } catch (error) {
      console.error('Error in updateUser:', error);
      const detail = await getMainErrorMessage({ action: 'updateUser', ...payload });
      toast.error(detail || 'Error al actualizar el usuario');
      return false;
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [isSuperuser]); // Re-fetch when superuser status changes

  return {
    users,
    loading,
    fetchUsers,
    deleteUser,
    createUser,
    updateUser,
  };
};
