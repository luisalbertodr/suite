
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Edit, Eye, Trash2, Search, Building2, Mail, Phone, Globe } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { EmpresaForm } from './EmpresaForm';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

interface Company {
  id: string;
  name: string;
  tax_id: string;
  email: string;
  phone: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_postal_code: string | null;
  address_country: string | null;
  logo_url: string | null;
  website: string | null;
  additional_info: string | null;
  created_at: string;
}

export const Empresas: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { companyId, loading: companyLoading } = useCompanyFilter();

  const { data: company, isLoading } = useQuery({
    queryKey: ['company', companyId],
    queryFn: async () => {
      if (!companyId) {
        console.log('No company ID available, skipping company query');
        return null;
      }

      console.log('Fetching company data for:', companyId);

      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .eq('id', companyId)
        .single();
      
      if (error) {
        console.error('Error fetching company:', error);
        throw error;
      }
      
      console.log('Fetched company:', data);
      return data as Company;
    },
    enabled: !!companyId && !companyLoading,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('companies')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId] });
      toast({
        title: "Empresa eliminada",
        description: "La empresa ha sido eliminada correctamente."
      });
    }
  });

  const handleEdit = (company: Company) => {
    setEditingCompany(company);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingCompany(null);
  };

  if (companyLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Cargando información de la empresa...</span>
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700">No se encontró información de empresa</h2>
          <p className="text-gray-500 mt-2">Por favor, contacta con el administrador.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Cargando empresa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Building2 className="w-8 h-8 mr-3 text-blue-600" />
            Mi Empresa
          </h1>
          <p className="text-gray-600 mt-2">Información de tu empresa</p>
        </div>
        {company && (
          <Button 
            onClick={() => handleEdit(company)}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
          >
            <Edit className="w-4 h-4 mr-2" />
            Editar Empresa
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-8">
          {!company ? (
            <div className="text-center py-8">
              <Building2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No se encontró información de la empresa</p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto">
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    {company.name}
                  </h2>
                  <p className="text-lg text-gray-600 mb-1">CIF: {company.tax_id}</p>
                  {company.additional_info && (
                    <p className="text-blue-600 font-medium">{company.additional_info}</p>
                  )}
                </div>
                {company.logo_url && (
                  <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center ml-6">
                    <img 
                      src={company.logo_url} 
                      alt={company.name}
                      className="w-16 h-16 object-contain"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                    Información de Contacto
                  </h3>
                  
                  {company.email && (
                    <div className="flex items-center text-gray-700">
                      <Mail className="w-5 h-5 mr-3 text-gray-400" />
                      <span>{company.email}</span>
                    </div>
                  )}
                  
                  {company.phone && (
                    <div className="flex items-center text-gray-700">
                      <Phone className="w-5 h-5 mr-3 text-gray-400" />
                      <span>{company.phone}</span>
                    </div>
                  )}
                  
                  {company.website && (
                    <div className="flex items-center text-gray-700">
                      <Globe className="w-5 h-5 mr-3 text-gray-400" />
                      <a 
                        href={company.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {company.website}
                      </a>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 border-b pb-2">
                    Dirección
                  </h3>
                  
                  {(company.address_street || company.address_city) ? (
                    <div className="text-gray-700 space-y-1">
                      {company.address_street && <p>{company.address_street}</p>}
                      <p>
                        {company.address_postal_code} {company.address_city}
                        {company.address_state && `, ${company.address_state}`}
                      </p>
                      {company.address_country && <p>{company.address_country}</p>}
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">No se ha registrado dirección</p>
                  )}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t">
                <p className="text-sm text-gray-500">
                  Empresa registrada el {new Date(company.created_at).toLocaleDateString('es-ES')}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {showForm && (
        <EmpresaForm 
          onClose={handleCloseForm}
          company={editingCompany}
        />
      )}
    </div>
  );
};

export default Empresas;
