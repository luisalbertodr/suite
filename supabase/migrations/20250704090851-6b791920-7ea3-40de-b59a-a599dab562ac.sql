
-- Insertar permisos adicionales que faltan para las secciones del menú
INSERT INTO public.permissions (name, description, resource, action) VALUES
-- Proveedores (suppliers)
('suppliers.read', 'Ver proveedores', 'suppliers', 'read'),
('suppliers.create', 'Crear proveedores', 'suppliers', 'create'),
('suppliers.update', 'Actualizar proveedores', 'suppliers', 'update'),
('suppliers.delete', 'Eliminar proveedores', 'suppliers', 'delete')
ON CONFLICT (resource, action) DO NOTHING;

-- Actualizar permisos existentes si es necesario
UPDATE public.permissions 
SET name = 'customers.read', description = 'Ver clientes' 
WHERE resource = 'customers' AND action = 'read';

UPDATE public.permissions 
SET name = 'articles.read', description = 'Ver artículos' 
WHERE resource = 'articles' AND action = 'read';

UPDATE public.permissions 
SET name = 'quotes.read', description = 'Ver presupuestos' 
WHERE resource = 'quotes' AND action = 'read';

UPDATE public.permissions 
SET name = 'invoices.read', description = 'Ver facturas' 
WHERE resource = 'invoices' AND action = 'read';

UPDATE public.permissions 
SET name = 'delivery_notes.read', description = 'Ver albaranes' 
WHERE resource = 'delivery_notes' AND action = 'read';

UPDATE public.permissions 
SET name = 'sales.read', description = 'Ver TPV' 
WHERE resource = 'sales' AND action = 'read';

UPDATE public.permissions 
SET name = 'agenda.read', description = 'Ver agenda' 
WHERE resource = 'agenda' AND action = 'read';

UPDATE public.permissions 
SET name = 'reports.read', description = 'Ver reportes' 
WHERE resource = 'reports' AND action = 'read';

UPDATE public.permissions 
SET name = 'users.read', description = 'Ver gestión de usuarios' 
WHERE resource = 'users' AND action = 'read';

UPDATE public.permissions 
SET name = 'companies.read', description = 'Ver empresas' 
WHERE resource = 'companies' AND action = 'read';

UPDATE public.permissions 
SET name = 'settings.read', description = 'Ver configuración' 
WHERE resource = 'settings' AND action = 'read';

-- Crear tabla de permisos específicos de usuario (permisos individuales adicionales a los roles)
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id, permission_id)
);

-- Habilitar RLS en user_permissions
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Política RLS para user_permissions
CREATE POLICY "Allow all operations on user_permissions" ON public.user_permissions
  FOR ALL USING (true) WITH CHECK (true);

-- Actualizar la función get_user_permissions para incluir permisos individuales
CREATE OR REPLACE FUNCTION public.get_user_permissions(user_id uuid, company_id uuid)
RETURNS TABLE(permission_name text, resource text, action text) AS $$
BEGIN
  RETURN QUERY
  -- Permisos desde roles
  SELECT DISTINCT p.name, p.resource, p.action
  FROM public.permissions p
  JOIN public.role_permissions rp ON p.id = rp.permission_id
  JOIN public.roles r ON rp.role_id = r.id
  JOIN public.user_company_roles ucr ON r.id = ucr.role_id
  WHERE ucr.user_id = $1 AND ucr.company_id = $2
  
  UNION
  
  -- Permisos individuales
  SELECT DISTINCT p.name, p.resource, p.action
  FROM public.permissions p
  JOIN public.user_permissions up ON p.id = up.permission_id
  WHERE up.user_id = $1 AND up.company_id = $2;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
