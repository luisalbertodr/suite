
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CustomerContact {
  id?: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  observations: string;
  is_primary: boolean;
}

interface CustomerShippingAddress {
  id?: string;
  address_name: string;
  address_street: string;
  address_city: string;
  address_state: string;
  address_postal_code: string;
  address_country: string;
  is_default: boolean;
}

export const useCustomerAdvanced = (customerId?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch customer contacts
  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ['customer-contacts', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      
      const { data, error } = await supabase
        .from('customer_contacts')
        .select('*')
        .eq('customer_id', customerId)
        .order('is_primary', { ascending: false });

      if (error) throw error;
      return data as CustomerContact[];
    },
    enabled: !!customerId,
  });

  // Fetch customer shipping addresses
  const { data: addresses = [], isLoading: addressesLoading } = useQuery({
    queryKey: ['customer-addresses', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      
      const { data, error } = await supabase
        .from('customer_shipping_addresses')
        .select('*')
        .eq('customer_id', customerId)
        .order('is_default', { ascending: false });

      if (error) throw error;
      return data as CustomerShippingAddress[];
    },
    enabled: !!customerId,
  });

  // Save contacts mutation
  const saveContactsMutation = useMutation({
    mutationFn: async ({ customerId, contacts }: { customerId: string; contacts: CustomerContact[] }) => {
      console.log('Saving contacts for customer:', customerId, contacts);

      // Delete existing contacts
      await supabase
        .from('customer_contacts')
        .delete()
        .eq('customer_id', customerId);

      // Insert new contacts
      if (contacts.length > 0) {
        const contactsToInsert = contacts.map(contact => ({
          customer_id: customerId,
          contact_name: contact.contact_name,
          contact_email: contact.contact_email || null,
          contact_phone: contact.contact_phone || null,
          observations: contact.observations || null,
          is_primary: contact.is_primary,
        }));

        const { error } = await supabase
          .from('customer_contacts')
          .insert(contactsToInsert);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-contacts', customerId] });
      toast({
        title: "Contactos guardados",
        description: "Los contactos del cliente han sido actualizados correctamente.",
      });
    },
    onError: (error) => {
      console.error('Error saving contacts:', error);
      toast({
        title: "Error",
        description: "No se pudieron guardar los contactos del cliente.",
        variant: "destructive",
      });
    },
  });

  // Save addresses mutation
  const saveAddressesMutation = useMutation({
    mutationFn: async ({ customerId, addresses }: { customerId: string; addresses: CustomerShippingAddress[] }) => {
      console.log('Saving addresses for customer:', customerId, addresses);

      // Delete existing addresses
      await supabase
        .from('customer_shipping_addresses')
        .delete()
        .eq('customer_id', customerId);

      // Insert new addresses
      if (addresses.length > 0) {
        const addressesToInsert = addresses.map(address => ({
          customer_id: customerId,
          address_name: address.address_name,
          address_street: address.address_street || null,
          address_city: address.address_city || null,
          address_state: address.address_state || null,
          address_postal_code: address.address_postal_code || null,
          address_country: address.address_country || 'España',
          is_default: address.is_default,
        }));

        const { error } = await supabase
          .from('customer_shipping_addresses')
          .insert(addressesToInsert);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-addresses', customerId] });
      toast({
        title: "Direcciones guardadas",
        description: "Las direcciones del cliente han sido actualizadas correctamente.",
      });
    },
    onError: (error) => {
      console.error('Error saving addresses:', error);
      toast({
        title: "Error",
        description: "No se pudieron guardar las direcciones del cliente.",
        variant: "destructive",
      });
    },
  });

  const saveContacts = (customerId: string, contacts: CustomerContact[]) => {
    saveContactsMutation.mutate({ customerId, contacts });
  };

  const saveAddresses = (customerId: string, addresses: CustomerShippingAddress[]) => {
    saveAddressesMutation.mutate({ customerId, addresses });
  };

  return {
    contacts,
    addresses,
    contactsLoading,
    addressesLoading,
    saveContacts,
    saveAddresses,
    isSavingContacts: saveContactsMutation.isPending,
    isSavingAddresses: saveAddressesMutation.isPending,
  };
};
