-- Insert permissions for presupuestos_n
INSERT INTO permissions (name, description, resource, action) VALUES
('presupuestos_n_read', 'Ver presupuestos N', 'presupuestos_n', 'read'),
('presupuestos_n_create', 'Crear presupuestos N', 'presupuestos_n', 'create'),
('presupuestos_n_update', 'Actualizar presupuestos N', 'presupuestos_n', 'update'),
('presupuestos_n_delete', 'Eliminar presupuestos N', 'presupuestos_n', 'delete')
ON CONFLICT (resource, action) DO NOTHING;