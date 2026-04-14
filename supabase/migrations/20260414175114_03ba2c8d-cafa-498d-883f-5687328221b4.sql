
-- Bonos/Vouchers de cliente
CREATE TABLE public.customer_vouchers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  total_sessions INTEGER NOT NULL DEFAULT 1,
  used_sessions INTEGER NOT NULL DEFAULT 0,
  voucher_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Historial estético del cliente
CREATE TABLE public.customer_aesthetic_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  event_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  event_type TEXT NOT NULL DEFAULT 'treatment',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customer_vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_aesthetic_history ENABLE ROW LEVEL SECURITY;

-- RLS policies using company filter
CREATE POLICY "Users can manage customer vouchers in their company"
ON public.customer_vouchers FOR ALL TO authenticated
USING (company_id = get_user_company_id())
WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can view customer vouchers in their company"
ON public.customer_vouchers FOR SELECT TO authenticated
USING (company_id = get_user_company_id());

CREATE POLICY "Users can manage customer aesthetic history in their company"
ON public.customer_aesthetic_history FOR ALL TO authenticated
USING (company_id = get_user_company_id())
WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "Users can view customer aesthetic history in their company"
ON public.customer_aesthetic_history FOR SELECT TO authenticated
USING (company_id = get_user_company_id());
