
-- Crear tabla para empleados de la agenda
CREATE TABLE public.agenda_employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  company_id UUID REFERENCES public.companies(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Crear tabla para citas de la agenda
CREATE TABLE public.agenda_appointments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.agenda_employees(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  description TEXT,
  start_time TEXT NOT NULL, -- formato HH:mm
  end_time TEXT NOT NULL,   -- formato HH:mm
  appointment_date DATE NOT NULL,
  color TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'pending', 'cancelled')),
  company_id UUID REFERENCES public.companies(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS en ambas tablas
ALTER TABLE public.agenda_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_appointments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para agenda_employees
CREATE POLICY "Users can access their company's agenda employees" 
  ON public.agenda_employees 
  FOR ALL 
  USING (company_id = get_user_company_id());

-- Políticas RLS para agenda_appointments
CREATE POLICY "Users can access their company's agenda appointments" 
  ON public.agenda_appointments 
  FOR ALL 
  USING (company_id = get_user_company_id());

-- Insertar empleados por defecto
INSERT INTO public.agenda_employees (name, color, company_id) VALUES
  ('Emple1', 'bg-blue-100 border-blue-300', NULL),
  ('Emple2', 'bg-green-100 border-green-300', NULL),
  ('Emple3', 'bg-purple-100 border-purple-300', NULL),
  ('Emple4', 'bg-yellow-100 border-yellow-300', NULL),
  ('Emple5', 'bg-pink-100 border-pink-300', NULL),
  ('Emple6', 'bg-indigo-100 border-indigo-300', NULL);

-- Trigger para actualizar updated_at
CREATE TRIGGER update_agenda_employees_updated_at
  BEFORE UPDATE ON public.agenda_employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_agenda_appointments_updated_at
  BEFORE UPDATE ON public.agenda_appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
