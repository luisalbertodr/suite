
-- Cabinas (salas de tratamiento)
CREATE TABLE public.cabinas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  capacidad INTEGER NOT NULL DEFAULT 1,
  activa BOOLEAN NOT NULL DEFAULT true,
  color TEXT DEFAULT '#8B5CF6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Recursos (equipamiento/aparatología)
CREATE TABLE public.recursos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  tipo TEXT NOT NULL DEFAULT 'equipamiento',
  activo BOOLEAN NOT NULL DEFAULT true,
  cabina_id UUID REFERENCES public.cabinas(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Asignación de recursos/cabinas a citas
CREATE TABLE public.appointment_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID REFERENCES public.agenda_appointments(id) ON DELETE CASCADE NOT NULL,
  cabina_id UUID REFERENCES public.cabinas(id) ON DELETE SET NULL,
  recurso_id UUID REFERENCES public.recursos(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cabinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointment_resources ENABLE ROW LEVEL SECURITY;

-- RLS for cabinas
CREATE POLICY "Users can manage cabinas in their company"
ON public.cabinas FOR ALL TO authenticated
USING (company_id = get_user_company_id())
WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can view cabinas in their company"
ON public.cabinas FOR SELECT TO authenticated
USING (company_id = get_user_company_id());

-- RLS for recursos
CREATE POLICY "Users can manage recursos in their company"
ON public.recursos FOR ALL TO authenticated
USING (company_id = get_user_company_id())
WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can view recursos in their company"
ON public.recursos FOR SELECT TO authenticated
USING (company_id = get_user_company_id());

-- RLS for appointment_resources (via appointment company)
CREATE POLICY "Users can manage appointment resources"
ON public.appointment_resources FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM agenda_appointments a
  WHERE a.id = appointment_resources.appointment_id
  AND a.company_id = get_user_company_id()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM agenda_appointments a
  WHERE a.id = appointment_resources.appointment_id
  AND a.company_id = get_user_company_id()
));

CREATE POLICY "Users can view appointment resources"
ON public.appointment_resources FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM agenda_appointments a
  WHERE a.id = appointment_resources.appointment_id
  AND a.company_id = get_user_company_id()
));
