
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Plus, Trash2, MapPin, User, Mail, Phone } from 'lucide-react';
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

interface CustomerAdvancedFormProps {
  customerId?: string;
  initialContacts?: CustomerContact[];
  initialAddresses?: CustomerShippingAddress[];
  onContactsChange: (contacts: CustomerContact[]) => void;
  onAddressesChange: (addresses: CustomerShippingAddress[]) => void;
  rePercentage: number;
  irpfPercentage: number;
  intracomunitario: string;
  onRePercentageChange: (value: number) => void;
  onIrpfPercentageChange: (value: number) => void;
  onIntracomunitarioChange: (value: string) => void;
}

export const CustomerAdvancedForm: React.FC<CustomerAdvancedFormProps> = ({
  customerId,
  initialContacts = [],
  initialAddresses = [],
  onContactsChange,
  onAddressesChange,
  rePercentage,
  irpfPercentage,
  intracomunitario,
  onRePercentageChange,
  onIrpfPercentageChange,
  onIntracomunitarioChange,
}) => {
  const [contacts, setContacts] = useState<CustomerContact[]>(initialContacts.length > 0 ? initialContacts : [{
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    observations: '',
    is_primary: true
  }]);

  const [addresses, setAddresses] = useState<CustomerShippingAddress[]>(initialAddresses.length > 0 ? initialAddresses : [{
    address_name: 'Principal',
    address_street: '',
    address_city: '',
    address_state: '',
    address_postal_code: '',
    address_country: 'España',
    is_default: true
  }]);

  const { toast } = useToast();

  const addContact = () => {
    const newContacts = [...contacts, {
      contact_name: '',
      contact_email: '',
      contact_phone: '',
      observations: '',
      is_primary: false
    }];
    setContacts(newContacts);
    onContactsChange(newContacts);
  };

  const removeContact = (index: number) => {
    if (contacts.length <= 1) {
      toast({
        title: "No se puede eliminar",
        description: "Debe mantener al menos un contacto.",
        variant: "destructive",
      });
      return;
    }
    const newContacts = contacts.filter((_, i) => i !== index);
    setContacts(newContacts);
    onContactsChange(newContacts);
  };

  const updateContact = (index: number, field: keyof CustomerContact, value: any) => {
    const newContacts = [...contacts];
    if (field === 'is_primary' && value) {
      // Ensure only one primary contact
      newContacts.forEach((contact, i) => {
        contact.is_primary = i === index;
      });
    } else {
      newContacts[index] = { ...newContacts[index], [field]: value };
    }
    setContacts(newContacts);
    onContactsChange(newContacts);
  };

  const addAddress = () => {
    const newAddresses = [...addresses, {
      address_name: `Dirección ${addresses.length + 1}`,
      address_street: '',
      address_city: '',
      address_state: '',
      address_postal_code: '',
      address_country: 'España',
      is_default: false
    }];
    setAddresses(newAddresses);
    onAddressesChange(newAddresses);
  };

  const removeAddress = (index: number) => {
    if (addresses.length <= 1) {
      toast({
        title: "No se puede eliminar",
        description: "Debe mantener al menos una dirección.",
        variant: "destructive",
      });
      return;
    }
    const newAddresses = addresses.filter((_, i) => i !== index);
    setAddresses(newAddresses);
    onAddressesChange(newAddresses);
  };

  const updateAddress = (index: number, field: keyof CustomerShippingAddress, value: any) => {
    const newAddresses = [...addresses];
    if (field === 'is_default' && value) {
      // Ensure only one default address
      newAddresses.forEach((address, i) => {
        address.is_default = i === index;
      });
    } else {
      newAddresses[index] = { ...newAddresses[index], [field]: value };
    }
    setAddresses(newAddresses);
    onAddressesChange(newAddresses);
  };

  const getContactSummary = (contact: CustomerContact) => {
    const parts = [];
    if (contact.contact_name) parts.push(contact.contact_name);
    if (contact.contact_email) parts.push(contact.contact_email);
    if (contact.contact_phone) parts.push(contact.contact_phone);
    return parts.join(' • ') || 'Contacto sin información';
  };

  const getAddressSummary = (address: CustomerShippingAddress) => {
    const parts = [];
    if (address.address_street) parts.push(address.address_street);
    if (address.address_city) parts.push(address.address_city);
    if (address.address_state) parts.push(address.address_state);
    return parts.join(', ') || 'Dirección sin información';
  };

  return (
    <div className="space-y-6">
      {/* Tax Information */}
      <Card>
        <CardHeader>
          <CardTitle>Información Fiscal</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="re_percentage">Porcentaje RE (%)</Label>
            <Input
              id="re_percentage"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={rePercentage}
              onChange={(e) => onRePercentageChange(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label htmlFor="irpf_percentage">Porcentaje IRPF (%)</Label>
            <Input
              id="irpf_percentage"
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={irpfPercentage}
              onChange={(e) => onIrpfPercentageChange(parseFloat(e.target.value) || 0)}
            />
          </div>
          <div>
            <Label htmlFor="intracomunitario">Intracomunitario</Label>
            <Input
              id="intracomunitario"
              value={intracomunitario}
              onChange={(e) => onIntracomunitarioChange(e.target.value)}
              placeholder="Ej: ESB12345678"
            />
          </div>
        </CardContent>
      </Card>

      {/* Multiple Contacts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <User className="w-5 h-5" />
              <span>Contactos ({contacts.length})</span>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={addContact}
            >
              <Plus className="w-4 h-4 mr-1" />
              Agregar Contacto
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {contacts.map((contact, index) => (
              <AccordionItem key={index} value={`contact-${index}`} className="border rounded-lg mb-2">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center justify-between w-full mr-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        {contact.is_primary && (
                          <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                            Principal
                          </div>
                        )}
                        <div className="font-medium">
                          {contact.contact_name || `Contacto ${index + 1}`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      {contact.contact_email && (
                        <div className="flex items-center space-x-1">
                          <Mail className="w-3 h-3" />
                          <span className="truncate max-w-32">{contact.contact_email}</span>
                        </div>
                      )}
                      {contact.contact_phone && (
                        <div className="flex items-center space-x-1">
                          <Phone className="w-3 h-3" />
                          <span>{contact.contact_phone}</span>
                        </div>
                      )}
                      {contacts.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeContact(index);
                          }}
                          className="text-red-600 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 mb-4">
                      <Switch
                        checked={contact.is_primary}
                        onCheckedChange={(checked) => updateContact(index, 'is_primary', checked)}
                      />
                      <Label className="text-sm">Contacto Principal</Label>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`contact_name_${index}`}>Nombre *</Label>
                        <Input
                          id={`contact_name_${index}`}
                          value={contact.contact_name}
                          onChange={(e) => updateContact(index, 'contact_name', e.target.value)}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor={`contact_email_${index}`}>Email</Label>
                        <Input
                          id={`contact_email_${index}`}
                          type="email"
                          value={contact.contact_email}
                          onChange={(e) => updateContact(index, 'contact_email', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`contact_phone_${index}`}>Teléfono</Label>
                        <Input
                          id={`contact_phone_${index}`}
                          value={contact.contact_phone}
                          onChange={(e) => updateContact(index, 'contact_phone', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`contact_observations_${index}`}>Observaciones</Label>
                        <Textarea
                          id={`contact_observations_${index}`}
                          value={contact.observations}
                          onChange={(e) => updateContact(index, 'observations', e.target.value)}
                          rows={2}
                        />
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      {/* Multiple Shipping Addresses */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <MapPin className="w-5 h-5" />
              <span>Direcciones de Envío ({addresses.length})</span>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={addAddress}
            >
              <Plus className="w-4 h-4 mr-1" />
              Agregar Dirección
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {addresses.map((address, index) => (
              <AccordionItem key={index} value={`address-${index}`} className="border rounded-lg mb-2">
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center justify-between w-full mr-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-2">
                        {address.is_default && (
                          <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                            Predeterminada
                          </div>
                        )}
                        <div className="font-medium">
                          {address.address_name}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-sm text-gray-500 truncate max-w-64">
                        {getAddressSummary(address)}
                      </div>
                      {addresses.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeAddress(index);
                          }}
                          className="text-red-600 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <Input
                        value={address.address_name}
                        onChange={(e) => updateAddress(index, 'address_name', e.target.value)}
                        className="font-medium max-w-xs"
                        placeholder="Nombre de la dirección"
                      />
                      <div className="flex items-center space-x-2">
                        <Switch
                          checked={address.is_default}
                          onCheckedChange={(checked) => updateAddress(index, 'is_default', checked)}
                        />
                        <Label className="text-sm">Predeterminada</Label>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <Label htmlFor={`address_street_${index}`}>Dirección</Label>
                        <Input
                          id={`address_street_${index}`}
                          value={address.address_street}
                          onChange={(e) => updateAddress(index, 'address_street', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`address_city_${index}`}>Ciudad</Label>
                        <Input
                          id={`address_city_${index}`}
                          value={address.address_city}
                          onChange={(e) => updateAddress(index, 'address_city', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`address_state_${index}`}>Provincia</Label>
                        <Input
                          id={`address_state_${index}`}
                          value={address.address_state}
                          onChange={(e) => updateAddress(index, 'address_state', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`address_postal_code_${index}`}>Código Postal</Label>
                        <Input
                          id={`address_postal_code_${index}`}
                          value={address.address_postal_code}
                          onChange={(e) => updateAddress(index, 'address_postal_code', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`address_country_${index}`}>País</Label>
                        <Input
                          id={`address_country_${index}`}
                          value={address.address_country}
                          onChange={(e) => updateAddress(index, 'address_country', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
};
