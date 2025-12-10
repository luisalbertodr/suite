
-- Agregar campos simples a la tabla customers
ALTER TABLE customers 
ADD COLUMN re_percentage numeric(5,2) DEFAULT 0,
ADD COLUMN irpf_percentage numeric(5,2) DEFAULT 0,
ADD COLUMN intracomunitario text;

-- Crear tabla para direcciones de envío múltiples
CREATE TABLE customer_shipping_addresses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  address_name text NOT NULL,
  address_street text,
  address_city text,
  address_state text,
  address_postal_code text,
  address_country text DEFAULT 'España',
  is_default boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Crear tabla para contactos múltiples
CREATE TABLE customer_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  contact_name text NOT NULL,
  contact_email text,
  contact_phone text,
  observations text,
  is_primary boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS para las nuevas tablas
ALTER TABLE customer_shipping_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para direcciones de envío
CREATE POLICY "Users can access shipping addresses for their company customers"
ON customer_shipping_addresses
FOR ALL
USING (
  customer_id IN (
    SELECT id FROM customers 
    WHERE company_id = get_user_company_id()
  )
);

-- Políticas RLS para contactos
CREATE POLICY "Users can access contacts for their company customers"
ON customer_contacts
FOR ALL
USING (
  customer_id IN (
    SELECT id FROM customers 
    WHERE company_id = get_user_company_id()
  )
);

-- Agregar trigger para updated_at en las nuevas tablas
CREATE TRIGGER update_customer_shipping_addresses_updated_at
    BEFORE UPDATE ON customer_shipping_addresses
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_customer_contacts_updated_at
    BEFORE UPDATE ON customer_contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
