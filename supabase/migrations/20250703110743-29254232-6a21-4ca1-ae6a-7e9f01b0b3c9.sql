
-- Crear tabla de roles
CREATE TABLE public.roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  is_system_role boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Crear tabla de permisos
CREATE TABLE public.permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  description text,
  resource text NOT NULL,
  action text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Crear tabla de roles-permisos (many-to-many)
CREATE TABLE public.role_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

-- Crear tabla de usuarios-roles por empresa
CREATE TABLE public.user_company_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, company_id, role_id)
);

-- Añadir company_id a las tablas que faltan
ALTER TABLE public.sale_items ADD COLUMN company_id uuid REFERENCES public.companies(id);
ALTER TABLE public.sales ADD COLUMN company_id uuid REFERENCES public.companies(id);

-- Crear índices para mejorar rendimiento
CREATE INDEX idx_user_company_roles_user_id ON public.user_company_roles(user_id);
CREATE INDEX idx_user_company_roles_company_id ON public.user_company_roles(company_id);
CREATE INDEX idx_user_company_roles_role_id ON public.user_company_roles(role_id);
CREATE INDEX idx_role_permissions_role_id ON public.role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission_id ON public.role_permissions(permission_id);

-- Insertar roles básicos del sistema
INSERT INTO public.roles (name, description, is_system_role) VALUES
('superadmin', 'Super Administrador del Sistema', true),
('admin', 'Administrador de Empresa', true),
('manager', 'Gerente', true),
('employee', 'Empleado', true),
('viewer', 'Solo Lectura', true);

-- Insertar permisos básicos
INSERT INTO public.permissions (name, description, resource, action) VALUES
-- Gestión de empresas
('companies.create', 'Crear empresas', 'companies', 'create'),
('companies.read', 'Ver empresas', 'companies', 'read'),
('companies.update', 'Actualizar empresas', 'companies', 'update'),
('companies.delete', 'Eliminar empresas', 'companies', 'delete'),

-- Gestión de usuarios
('users.create', 'Crear usuarios', 'users', 'create'),
('users.read', 'Ver usuarios', 'users', 'read'),
('users.update', 'Actualizar usuarios', 'users', 'update'),
('users.delete', 'Eliminar usuarios', 'users', 'delete'),

-- Gestión de clientes
('customers.create', 'Crear clientes', 'customers', 'create'),
('customers.read', 'Ver clientes', 'customers', 'read'),
('customers.update', 'Actualizar clientes', 'customers', 'update'),
('customers.delete', 'Eliminar clientes', 'customers', 'delete'),

-- Gestión de artículos
('articles.create', 'Crear artículos', 'articles', 'create'),
('articles.read', 'Ver artículos', 'articles', 'read'),
('articles.update', 'Actualizar artículos', 'articles', 'update'),
('articles.delete', 'Eliminar artículos', 'articles', 'delete'),

-- Gestión de facturas
('invoices.create', 'Crear facturas', 'invoices', 'create'),
('invoices.read', 'Ver facturas', 'invoices', 'read'),
('invoices.update', 'Actualizar facturas', 'invoices', 'update'),
('invoices.delete', 'Eliminar facturas', 'invoices', 'delete'),

-- Gestión de presupuestos
('quotes.create', 'Crear presupuestos', 'quotes', 'create'),
('quotes.read', 'Ver presupuestos', 'quotes', 'read'),
('quotes.update', 'Actualizar presupuestos', 'quotes', 'update'),
('quotes.delete', 'Eliminar presupuestos', 'quotes', 'delete'),

-- Gestión de albaranes
('delivery_notes.create', 'Crear albaranes', 'delivery_notes', 'create'),
('delivery_notes.read', 'Ver albaranes', 'delivery_notes', 'read'),
('delivery_notes.update', 'Actualizar albaranes', 'delivery_notes', 'update'),
('delivery_notes.delete', 'Eliminar albaranes', 'delivery_notes', 'delete'),

-- TPV
('sales.create', 'Crear ventas', 'sales', 'create'),
('sales.read', 'Ver ventas', 'sales', 'read'),
('sales.update', 'Actualizar ventas', 'sales', 'update'),
('sales.delete', 'Eliminar ventas', 'sales', 'delete'),

-- Reportes
('reports.read', 'Ver reportes', 'reports', 'read'),

-- Configuración
('settings.read', 'Ver configuración', 'settings', 'read'),
('settings.update', 'Actualizar configuración', 'settings', 'update'),

-- Agenda
('agenda.create', 'Crear citas', 'agenda', 'create'),
('agenda.read', 'Ver agenda', 'agenda', 'read'),
('agenda.update', 'Actualizar citas', 'agenda', 'update'),
('agenda.delete', 'Eliminar citas', 'agenda', 'delete');

-- Asignar permisos a roles
-- Superadmin: todos los permisos
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'superadmin';

-- Admin: todos los permisos excepto gestión de empresas
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'admin' AND p.resource != 'companies';

-- Manager: permisos de lectura y escritura para la mayoría de recursos
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'manager' AND p.resource IN ('customers', 'articles', 'invoices', 'quotes', 'delivery_notes', 'sales', 'reports', 'agenda');

-- Employee: permisos básicos de operación
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'employee' AND p.resource IN ('customers', 'articles', 'sales', 'agenda') AND p.action IN ('create', 'read', 'update');

-- Viewer: solo lectura
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'viewer' AND p.action = 'read';

-- Crear función para obtener permisos de usuario
CREATE OR REPLACE FUNCTION public.get_user_permissions(user_id uuid, company_id uuid)
RETURNS TABLE(permission_name text, resource text, action text) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.name, p.resource, p.action
  FROM public.permissions p
  JOIN public.role_permissions rp ON p.id = rp.permission_id
  JOIN public.roles r ON rp.role_id = r.id
  JOIN public.user_company_roles ucr ON r.id = ucr.role_id
  WHERE ucr.user_id = $1 AND ucr.company_id = $2;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear función para verificar si un usuario tiene un permiso específico
CREATE OR REPLACE FUNCTION public.user_has_permission(user_id uuid, company_id uuid, permission_name text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.get_user_permissions(user_id, company_id) p
    WHERE p.permission_name = $3
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger para actualizar updated_at en roles y user_company_roles
CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_company_roles_updated_at
  BEFORE UPDATE ON public.user_company_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS en las nuevas tablas
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_company_roles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para roles (solo superadmin puede gestionarlos)
CREATE POLICY "Superadmin can manage roles" ON public.roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_company_roles ucr
      JOIN public.roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid() AND r.name = 'superadmin'
    )
  );

-- Políticas RLS para permisos (solo lectura para usuarios autenticados)
CREATE POLICY "Authenticated users can view permissions" ON public.permissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Políticas RLS para role_permissions (solo lectura para usuarios autenticados)
CREATE POLICY "Authenticated users can view role permissions" ON public.role_permissions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Políticas RLS para user_company_roles
CREATE POLICY "Users can view their own company roles" ON public.user_company_roles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Admins can manage user company roles" ON public.user_company_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_company_roles ucr
      JOIN public.roles r ON ucr.role_id = r.id
      WHERE ucr.user_id = auth.uid() 
      AND ucr.company_id = user_company_roles.company_id
      AND r.name IN ('admin', 'superadmin')
    )
  );
