
-- Historial Clínico
CREATE TABLE public.historial_clinico (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  tipo TEXT NOT NULL DEFAULT 'consulta',
  titulo TEXT NOT NULL,
  descripcion TEXT,
  tratamiento TEXT,
  observaciones TEXT,
  empleado_id UUID REFERENCES public.agenda_employees(id),
  firma_cliente_url TEXT,
  firma_profesional_url TEXT,
  fotos_antes TEXT[],
  fotos_despues TEXT[],
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Consentimientos informados
CREATE TABLE public.consentimientos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL,
  titulo TEXT NOT NULL,
  contenido TEXT,
  firmado BOOLEAN DEFAULT false,
  firma_url TEXT,
  fecha_firma TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Bonos prepagados
CREATE TABLE public.bonos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  precio_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  sesiones_totales INTEGER NOT NULL DEFAULT 1,
  sesiones_usadas INTEGER NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'activo',
  fecha_compra DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Uso de bonos
CREATE TABLE public.bono_uso (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bono_id UUID REFERENCES public.bonos(id) ON DELETE CASCADE NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  empleado_id UUID REFERENCES public.agenda_employees(id),
  notas TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.historial_clinico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consentimientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bono_uso ENABLE ROW LEVEL SECURITY;

-- RLS policies for authenticated users
CREATE POLICY "Authenticated users can manage historial_clinico" ON public.historial_clinico FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage consentimientos" ON public.consentimientos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage bonos" ON public.bonos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users can manage bono_uso" ON public.bono_uso FOR ALL TO authenticated USING (true) WITH CHECK (true);
