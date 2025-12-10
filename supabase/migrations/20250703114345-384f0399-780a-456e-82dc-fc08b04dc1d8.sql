
-- Create roles table
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system_role BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create permissions table
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(resource, action)
);

-- Create role_permissions junction table
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(role_id, permission_id)
);

-- Create user_company_roles table
CREATE TABLE public.user_company_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id, role_id)
);

-- Create function to get user permissions
CREATE OR REPLACE FUNCTION public.get_user_permissions(user_id UUID, company_id UUID)
RETURNS TABLE (
  permission_name TEXT,
  resource TEXT,
  action TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.name as permission_name,
    p.resource,
    p.action
  FROM public.permissions p
  JOIN public.role_permissions rp ON p.id = rp.permission_id
  JOIN public.roles r ON rp.role_id = r.id
  JOIN public.user_company_roles ucr ON r.id = ucr.role_id
  WHERE ucr.user_id = get_user_permissions.user_id 
    AND ucr.company_id = get_user_permissions.company_id;
END;
$$;

-- Enable RLS on new tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_company_roles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for roles
CREATE POLICY "Allow all users to view roles" ON public.roles FOR SELECT USING (true);
CREATE POLICY "Allow all users to manage roles" ON public.roles FOR ALL USING (true);

-- Create RLS policies for permissions
CREATE POLICY "Allow all users to view permissions" ON public.permissions FOR SELECT USING (true);
CREATE POLICY "Allow all users to manage permissions" ON public.permissions FOR ALL USING (true);

-- Create RLS policies for role_permissions
CREATE POLICY "Allow all users to view role permissions" ON public.role_permissions FOR SELECT USING (true);
CREATE POLICY "Allow all users to manage role permissions" ON public.role_permissions FOR ALL USING (true);

-- Create RLS policies for user_company_roles
CREATE POLICY "Allow all users to view user company roles" ON public.user_company_roles FOR SELECT USING (true);
CREATE POLICY "Allow all users to manage user company roles" ON public.user_company_roles FOR ALL USING (true);

-- Insert some basic roles
INSERT INTO public.roles (name, description, is_system_role) VALUES
  ('admin', 'Administrator with full access', true),
  ('manager', 'Manager with limited admin access', false),
  ('user', 'Regular user with basic access', false);

-- Insert some basic permissions
INSERT INTO public.permissions (name, description, resource, action) VALUES
  ('View Users', 'Can view user list', 'users', 'read'),
  ('Create Users', 'Can create new users', 'users', 'create'),
  ('Update Users', 'Can update user information', 'users', 'update'),
  ('Delete Users', 'Can delete users', 'users', 'delete'),
  ('View Companies', 'Can view company information', 'companies', 'read'),
  ('Create Companies', 'Can create new companies', 'companies', 'create'),
  ('Update Companies', 'Can update company information', 'companies', 'update'),
  ('Delete Companies', 'Can delete companies', 'companies', 'delete');

-- Assign all permissions to admin role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name = 'admin';

-- Assign basic permissions to user role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.resource IN ('users', 'companies') AND p.action = 'read'
WHERE r.name = 'user';
