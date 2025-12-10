
-- Actualizar RLS para agenda_appointments
DROP POLICY IF EXISTS "Allow all operations during development" ON public.agenda_appointments;
CREATE POLICY "Users can access their company's appointments" ON public.agenda_appointments
  FOR ALL USING (company_id = get_user_company_id());

-- Actualizar RLS para articles (más restrictivo)
DROP POLICY IF EXISTS "Allow all users to view articles" ON public.articles;
DROP POLICY IF EXISTS "Allow all users to insert articles" ON public.articles;
DROP POLICY IF EXISTS "Allow all users to update articles" ON public.articles;
DROP POLICY IF EXISTS "Allow all users to delete articles" ON public.articles;

CREATE POLICY "Users can access their company's articles" ON public.articles
  FOR ALL USING (company_id = get_user_company_id());

-- Actualizar RLS para suppliers (más restrictivo)
DROP POLICY IF EXISTS "Allow all operations on suppliers" ON public.suppliers;
CREATE POLICY "Users can access their company's suppliers" ON public.suppliers
  FOR ALL USING (company_id = get_user_company_id());

-- Actualizar RLS para quotes (más restrictivo)
DROP POLICY IF EXISTS "Allow all operations on quotes" ON public.quotes;
CREATE POLICY "Users can access their company's quotes" ON public.quotes
  FOR ALL USING (company_id = get_user_company_id());

-- Actualizar RLS para delivery_notes (más restrictivo)
DROP POLICY IF EXISTS "Allow all operations on delivery_notes" ON public.delivery_notes;
CREATE POLICY "Users can access their company's delivery_notes" ON public.delivery_notes
  FOR ALL USING (company_id = get_user_company_id());

-- Actualizar RLS para delivery_note_items
DROP POLICY IF EXISTS "Allow all operations on delivery_note_items" ON public.delivery_note_items;
CREATE POLICY "Users can access delivery note items" ON public.delivery_note_items
  FOR ALL USING (delivery_note_id IN (
    SELECT id FROM delivery_notes WHERE company_id = get_user_company_id()
  ));

-- Actualizar RLS para quote_items
DROP POLICY IF EXISTS "Allow all operations on quote_items" ON public.quote_items;
CREATE POLICY "Users can access quote items" ON public.quote_items
  FOR ALL USING (quote_id IN (
    SELECT id FROM quotes WHERE company_id = get_user_company_id()
  ));

-- Habilitar RLS en sales y crear políticas
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their company's sales" ON public.sales
  FOR ALL USING (company_id = get_user_company_id());

-- Habilitar RLS en sale_items y crear políticas
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access sale items" ON public.sale_items
  FOR ALL USING (sale_id IN (
    SELECT id FROM sales WHERE company_id = get_user_company_id()
  ));

-- Actualizar RLS para system_settings (más restrictivo)
DROP POLICY IF EXISTS "Allow all operations on system_settings" ON public.system_settings;
CREATE POLICY "Users can access their company's settings" ON public.system_settings
  FOR ALL USING (company_id = get_user_company_id());

-- Actualizar RLS para article_variations
DROP POLICY IF EXISTS "Allow all operations on article_variations" ON public.article_variations;
CREATE POLICY "Users can access article variations" ON public.article_variations
  FOR ALL USING (article_id IN (
    SELECT id FROM articles WHERE company_id = get_user_company_id()
  ));
