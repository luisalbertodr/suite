
import React from 'react';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, signOut } = useAuth();
  const { companyId } = useCompanyFilter();

  const { data: company } = useQuery({
    queryKey: ['company', companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from('companies')
        .select('name')
        .eq('id', companyId)
        .single();
      
      if (error) {
        console.error('Error fetching company:', error);
        return null;
      }
      return data;
    },
    enabled: !!companyId,
  });

  return (
    <header className="flex h-16 items-center gap-4 border-b bg-white px-6 shadow-sm">
      <SidebarTrigger className="h-8 w-8" />
      <div className="flex-1">
        <h1 className="text-lg font-semibold text-gray-900">
          MOGES - Sistema de Gestión
        </h1>
        {company && (
          <p className="text-sm text-gray-600">
            Empresa: {company.name}
          </p>
        )}
      </div>
      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {user.email}
              </p>
              <p className="text-xs text-gray-600">
                Usuario logueado
              </p>
            </div>
            <button 
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-2 rounded-md transition-colors" 
              onClick={signOut}
              title="Cerrar Sesión"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Cerrar Sesión</span>
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
