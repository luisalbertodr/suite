-- Create missing tables for code compatibility

-- Create sales table
CREATE TABLE IF NOT EXISTS public.sales (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id),
    ticket_number text NOT NULL,
    total_amount numeric DEFAULT 0,
    payment_method text DEFAULT 'cash',
    status text DEFAULT 'completed',
    customer_id uuid REFERENCES public.customers(id),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sales in their company" ON public.sales FOR SELECT USING (company_id = get_user_company_id());
CREATE POLICY "Users can insert sales in their company" ON public.sales FOR INSERT WITH CHECK (company_id = get_user_company_id());
CREATE POLICY "Users can update sales in their company" ON public.sales FOR UPDATE USING (company_id = get_user_company_id());
CREATE POLICY "Users can delete sales in their company" ON public.sales FOR DELETE USING (company_id = get_user_company_id());

-- Create sale_items table
CREATE TABLE IF NOT EXISTS public.sale_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    article_id uuid REFERENCES public.articles(id),
    description text,
    quantity numeric DEFAULT 1,
    unit_price numeric DEFAULT 0,
    total_price numeric DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage sale items" ON public.sale_items FOR ALL 
USING (EXISTS (SELECT 1 FROM sales s WHERE s.id = sale_items.sale_id AND s.company_id = get_user_company_id()));

-- Create permissions table
CREATE TABLE IF NOT EXISTS public.permissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    resource text NOT NULL,
    action text NOT NULL,
    name text,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(resource, action)
);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view permissions" ON public.permissions FOR SELECT USING (true);

-- Create roles table
CREATE TABLE IF NOT EXISTS public.roles (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL UNIQUE,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Everyone can view roles" ON public.roles FOR SELECT USING (true);

-- Add company_id to user_permissions if not exists
ALTER TABLE public.user_permissions ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- Add role_id to user_company_roles  
ALTER TABLE public.user_company_roles ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.roles(id);

-- Insert default roles
INSERT INTO public.roles (name, description) VALUES 
('admin', 'Administrator with full access'),
('user', 'Regular user with limited access')
ON CONFLICT (name) DO NOTHING;

-- Insert default permissions
INSERT INTO public.permissions (resource, action, name) VALUES 
('dashboard', 'read', 'Ver Dashboard'),
('customers', 'read', 'Ver Clientes'),
('articles', 'read', 'Ver Artículos'),
('planillas', 'read', 'Ver Planillas'),
('quotes', 'read', 'Ver Presupuestos'),
('presupuestos_n', 'read', 'Ver PresupuestosN'),
('invoices', 'read', 'Ver Facturas'),
('delivery_notes', 'read', 'Ver Albaranes Entrada'),
('delivery_notes_out', 'read', 'Ver Albaranes Salida'),
('suppliers', 'read', 'Ver Proveedores'),
('sales', 'read', 'Ver TPV'),
('agenda', 'read', 'Ver Agenda'),
('documents', 'read', 'Ver Gestión Documental'),
('reports', 'read', 'Ver Reportes'),
('companies', 'read', 'Ver Empresas'),
('settings', 'read', 'Ver Configuración')
ON CONFLICT (resource, action) DO NOTHING;