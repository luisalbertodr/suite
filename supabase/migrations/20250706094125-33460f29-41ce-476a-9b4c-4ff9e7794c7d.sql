
-- Verificar e insertar el permiso de planillas si no existe
INSERT INTO public.permissions (name, description, resource, action)
SELECT 'Planillas - Lectura', 'Permite acceder a la sección de planillas', 'planillas', 'read'
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions 
  WHERE resource = 'planillas' AND action = 'read'
);

-- Insertar otros permisos relacionados con planillas
INSERT INTO public.permissions (name, description, resource, action)
SELECT 'Planillas - Escritura', 'Permite crear y editar planillas', 'planillas', 'write'
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions 
  WHERE resource = 'planillas' AND action = 'write'
);

INSERT INTO public.permissions (name, description, resource, action)
SELECT 'Planillas - Eliminación', 'Permite eliminar planillas', 'planillas', 'delete'
WHERE NOT EXISTS (
  SELECT 1 FROM public.permissions 
  WHERE resource = 'planillas' AND action = 'delete'
);
