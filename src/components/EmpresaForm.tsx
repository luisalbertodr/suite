
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { X, Building2 } from 'lucide-react';

interface Company {
  name: string;
  tax_id: string;
  email: string;
  phone: string;
  address_street: string;
  address_city: string;
  address_state: string;
  address_postal_code: string;
  address_country: string;
  website: string;
  additional_info: string;
}

interface EmpresaFormProps {
  onClose: () => void;
  company?: Company & { id: string };
}

export const EmpresaForm: React.FC<EmpresaFormProps> = ({ onClose, company }) => {
  const [formData, setFormData] = useState<Company>({
    name: company?.name || '',
    tax_id: company?.tax_id || '',
    email: company?.email || '',
    phone: company?.phone || '',
    address_street: company?.address_street || '',
    address_city: company?.address_city || '',
    address_state: company?.address_state || '',
    address_postal_code: company?.address_postal_code || '',
    address_country: company?.address_country || 'España',
    website: company?.website || '',
    additional_info: company?.additional_info || ''
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async (data: Company) => {
      const { error } = await supabase
        .from('companies')
        .insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast({
        title: "Empresa creada",
        description: "La empresa ha sido creada correctamente."
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo crear la empresa. " + error.message,
        variant: "destructive"
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Company) => {
      if (!company?.id) throw new Error('ID de empresa no encontrado');
      const { error } = await supabase
        .from('companies')
        .update(data)
        .eq('id', company.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast({
        title: "Empresa actualizada",
        description: "La empresa ha sido actualizada correctamente."
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "No se pudo actualizar la empresa. " + error.message,
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (company?.id) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleInputChange = (field: keyof Company, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center">
            <Building2 className="w-5 h-5 mr-2" />
            {company ? 'Editar Empresa' : 'Nueva Empresa'}
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Nombre de la empresa *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="tax_id">CIF/NIF *</Label>
                <Input
                  id="tax_id"
                  value={formData.tax_id}
                  onChange={(e) => handleInputChange('tax_id', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="website">Sitio web</Label>
              <Input
                id="website"
                type="url"
                value={formData.website}
                onChange={(e) => handleInputChange('website', e.target.value)}
                placeholder="https://ejemplo.com"
              />
            </div>

            <div>
              <Label htmlFor="additional_info">Información adicional</Label>
              <Input
                id="additional_info"
                value={formData.additional_info}
                onChange={(e) => handleInputChange('additional_info', e.target.value)}
                maxLength={50}
                placeholder="Información adicional (máx. 50 caracteres)"
              />
              <p className="text-sm text-gray-500 mt-1">
                {formData.additional_info.length}/50 caracteres
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Dirección</h3>
              <div>
                <Label htmlFor="address_street">Calle</Label>
                <Input
                  id="address_street"
                  value={formData.address_street}
                  onChange={(e) => handleInputChange('address_street', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="address_city">Ciudad</Label>
                  <Input
                    id="address_city"
                    value={formData.address_city}
                    onChange={(e) => handleInputChange('address_city', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="address_state">Provincia/Estado</Label>
                  <Input
                    id="address_state"
                    value={formData.address_state}
                    onChange={(e) => handleInputChange('address_state', e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="address_postal_code">Código postal</Label>
                  <Input
                    id="address_postal_code"
                    value={formData.address_postal_code}
                    onChange={(e) => handleInputChange('address_postal_code', e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="address_country">País</Label>
                <Input
                  id="address_country"
                  value={formData.address_country}
                  onChange={(e) => handleInputChange('address_country', e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending 
                  ? 'Guardando...' 
                  : (company ? 'Actualizar' : 'Crear')
                }
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
