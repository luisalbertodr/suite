-- Create colors table
CREATE TABLE IF NOT EXISTS public.colors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.colors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view colors in their company"
  ON public.colors
  FOR SELECT
  USING (company_id IS NULL OR company_id = get_user_company_id());

CREATE POLICY "Users can manage colors in their company"
  ON public.colors
  FOR ALL
  USING (company_id IS NULL OR company_id = get_user_company_id());

-- Create customer_contacts table
CREATE TABLE IF NOT EXISTS public.customer_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  observations TEXT,
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view customer contacts in their company"
  ON public.customer_contacts
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM customers c 
    WHERE c.id = customer_contacts.customer_id 
    AND c.company_id = get_user_company_id()
  ));

CREATE POLICY "Users can manage customer contacts in their company"
  ON public.customer_contacts
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM customers c 
    WHERE c.id = customer_contacts.customer_id 
    AND c.company_id = get_user_company_id()
  ));

-- Create customer_shipping_addresses table
CREATE TABLE IF NOT EXISTS public.customer_shipping_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  address_name TEXT NOT NULL,
  address_street TEXT,
  address_city TEXT,
  address_state TEXT,
  address_postal_code TEXT,
  address_country TEXT DEFAULT 'España',
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_shipping_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view customer shipping addresses in their company"
  ON public.customer_shipping_addresses
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM customers c 
    WHERE c.id = customer_shipping_addresses.customer_id 
    AND c.company_id = get_user_company_id()
  ));

CREATE POLICY "Users can manage customer shipping addresses in their company"
  ON public.customer_shipping_addresses
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM customers c 
    WHERE c.id = customer_shipping_addresses.customer_id 
    AND c.company_id = get_user_company_id()
  ));

-- Add missing columns to verifactu_queue table
ALTER TABLE public.verifactu_queue
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS processed_at TIMESTAMP WITH TIME ZONE;

-- Add missing column to verifactu_xml_documents table
ALTER TABLE public.verifactu_xml_documents
ADD COLUMN IF NOT EXISTS xml_type TEXT DEFAULT 'request';