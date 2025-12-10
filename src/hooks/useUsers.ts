
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
    companies?: {
      name: string;
    };
  };
  user_company_roles?: Array<{
    id: string;
    role: {
      name: string;
      description: string;
    };
  }>;
}

export const useUsers = () => {
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

      // Build URL with superuser parameter if needed
      let url = 'list-users';
      if (isSuperuser) {
        url += '?is_superuser=true';
      }

      const { data, error } = await supabase.functions.invoke(url, {
        method: 'GET',
        headers
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
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId }
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

  useEffect(() => {
    fetchUsers();
  }, [isSuperuser]); // Re-fetch when superuser status changes

  return {
    users,
    loading,
    fetchUsers,
    deleteUser
  };
};
