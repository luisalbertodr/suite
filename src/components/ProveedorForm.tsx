
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

interface Supplier {
  id: string;
  name: string;
  tax_id?: string;
  email?: string;
  phone?: string;
  address_street?: string;
  address_city?: string;
  address_state?: string;
  address_postal_code?: string;
  address_country?: string;
  contact_person?: string;
  payment_terms?: number;
  notes?: string;
}

interface ProveedorFormProps {
  supplier?: Supplier | null;
  onClose: () => void;
}

interface FormData {
  name: string;
  tax_id: string;
  email: string;
  phone: string;
  address_street: string;
  address_city: string;
  address_state: string;
  address_postal_code: string;
  address_country: string;
  contact_person: string;
  payment_terms: number;
  notes: string;
}

export const ProveedorForm: React.FC<ProveedorFormProps> = ({ supplier, onClose }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyFilter();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      name: supplier?.name || '',
      tax_id: supplier?.tax_id || '',
      email: supplier?.email || '',
      phone: supplier?.phone || '',
      address_street: supplier?.address_street || '',
      address_city: supplier?.address_city || '',
      address_state: supplier?.address_state || '',
      address_postal_code: supplier?.address_postal_code || '',
      address_country: supplier?.address_country || 'España',
      contact_person: supplier?.contact_person || '',
      payment_terms: supplier?.payment_terms || 30,
      notes: supplier?.notes || '',
    }
  });

  const saveSupplierMutation = useMutation({
    mutationFn: async (data: FormData) => {
      console.log('Starting supplier save process...', { supplier, companyId, data });
      
      if (!companyId) {
        throw new Error('No se pudo obtener el ID de la empresa');
      }

      const supplierData = {
        ...data,
        company_id: companyId,
      };

      console.log('Supplier data to save:', supplierData);

      if (supplier) {
        console.log('Updating existing supplier:', supplier.id);
        const { data: updatedData, error } = await supabase
          .from('suppliers')
          .update(supplierData)
          .eq('id', supplier.id)
          .select();
        
        if (error) {
          console.error('Error updating supplier:', error);
          throw error;
        }
        
        console.log('Supplier updated successfully:', updatedData);
      } else {
        console.log('Creating new supplier');
        const { data: newData, error } = await supabase
          .from('suppliers')
          .insert([supplierData])
          .select();
        
        if (error) {
          console.error('Error creating supplier:', error);
          throw error;
        }
        
        console.log('Supplier created successfully:', newData);
      }
    },
    onSuccess: () => {
      console.log('Supplier save mutation successful');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers', companyId] });
      toast({
        title: supplier ? "Proveedor actualizado" : "Proveedor creado",
        description: supplier ? "El proveedor ha sido actualizado exitosamente." : "El nuevo proveedor ha sido creado exitosamente.",
      });
      onClose();
    },
    onError: (error) => {
      console.error('Supplier save mutation error:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar el proveedor: " + (error as any).message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FormData) => {
    console.log('Form submitted with data:', data);
    
    if (!companyId) {
      toast({
        title: "Error",
        description: "No se pudo obtener la información de la empresa. Por favor, recarga la página.",
        variant: "destructive",
      });
      return;
    }
    
    saveSupplierMutation.mutate(data);
  };

  if (!companyId) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-700">Cargando información de la empresa...</h2>
          <p className="text-gray-500 mt-2">Por favor, espera un momento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" onClick={onClose}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <h1 className="text-3xl font-bold text-gray-900">
          {supplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Información Básica</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                {...register('name', { required: 'El nombre es obligatorio' })}
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1">{errors.name.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="tax_id">DNI/CIF</Label>
              <Input
                id="tax_id"
                {...register('tax_id')}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
              />
            </div>
            <div>
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                {...register('phone')}
              />
            </div>
            <div>
              <Label htmlFor="contact_person">Persona de Contacto</Label>
              <Input
                id="contact_person"
                {...register('contact_person')}
              />
            </div>
            <div>
              <Label htmlFor="payment_terms">Términos de Pago (días)</Label>
              <Input
                id="payment_terms"
                type="number"
                min="0"
                {...register('payment_terms', { valueAsNumber: true })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dirección</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="address_street">Dirección</Label>
              <Input
                id="address_street"
                {...register('address_street')}
              />
            </div>
            <div>
              <Label htmlFor="address_city">Ciudad</Label>
              <Input
                id="address_city"
                {...register('address_city')}
              />
            </div>
            <div>
              <Label htmlFor="address_state">Provincia</Label>
              <Input
                id="address_state"
                {...register('address_state')}
              />
            </div>
            <div>
              <Label htmlFor="address_postal_code">Código Postal</Label>
              <Input
                id="address_postal_code"
                {...register('address_postal_code')}
              />
            </div>
            <div>
              <Label htmlFor="address_country">País</Label>
              <Input
                id="address_country"
                {...register('address_country')}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <textarea
              {...register('notes')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={4}
              placeholder="Notas adicionales sobre el proveedor..."
            />
          </CardContent>
        </Card>

        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saveSupplierMutation.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {saveSupplierMutation.isPending ? 'Guardando...' : 'Guardar Proveedor'}
          </Button>
        </div>
      </form>
    </div>
  );
};
