
-- Insertar todos los permisos necesarios para las secciones del menú principal
INSERT INTO public.permissions (name, description, resource, action) VALUES
-- Dashboard (ya existe)
('dashboard.read', 'Ver panel principal', 'dashboard', 'read'),

-- Clientes (ya existe)  
('customers.read', 'Ver clientes', 'customers', 'read'),

-- Artículos (ya existe)
('articles.read', 'Ver artículos', 'articles', 'read'),

-- Presupuestos (ya existe)
('quotes.read', 'Ver presupuestos', 'quotes', 'read'),

-- Facturas (ya existe) 
('invoices.read', 'Ver facturas', 'invoices', 'read'),

-- Albaranes de entrada (ya existe)
('delivery_notes.read', 'Ver albaranes de entrada', 'delivery_notes', 'read'),

-- Albaranes de salida
('delivery_notes_out.read', 'Ver albaranes de salida', 'delivery_notes_out', 'read'),

-- Proveedores (ya existe)
('suppliers.read', 'Ver proveedores', 'suppliers', 'read'),

-- TPV (ya existe)
('sales.read', 'Ver TPV', 'sales', 'read'),

-- Agenda (ya existe)
('agenda.read', 'Ver agenda', 'agenda', 'read'),

-- Gestión Documental
('documents.read', 'Ver gestión documental', 'documents', 'read'),

-- Reportes (ya existe)
('reports.read', 'Ver reportes', 'reports', 'read'),

-- Empresas (ya existe)
('companies.read', 'Ver empresas', 'companies', 'read'),

-- Configuración (ya existe)
('settings.read', 'Ver configuración', 'settings', 'read')

ON CONFLICT (resource, action) DO NOTHING;
