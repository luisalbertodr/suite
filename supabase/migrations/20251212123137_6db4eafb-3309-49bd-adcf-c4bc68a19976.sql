-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.article_variations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_note_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presupuestos_n ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presupuesto_n_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planillas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planilla_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifactu_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifactu_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifactu_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifactu_xml_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestashop_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestashop_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestashop_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.superusers ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- SECURITY HELPER FUNCTIONS
-- =====================================================

-- Function to get the user's company ID
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.user_profiles WHERE user_id = auth.uid() LIMIT 1
$$;

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role IN ('admin', 'superuser')
  )
$$;

-- =====================================================
-- RLS POLICIES FOR COMPANIES
-- =====================================================

CREATE POLICY "Users can view their own company"
ON public.companies FOR SELECT
TO authenticated
USING (id = public.get_user_company_id());

CREATE POLICY "Admins can update their own company"
ON public.companies FOR UPDATE
TO authenticated
USING (id = public.get_user_company_id() AND public.is_admin());

-- =====================================================
-- RLS POLICIES FOR USER_PROFILES
-- =====================================================

CREATE POLICY "Users can view profiles in their company"
ON public.user_profiles FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can update their own profile"
ON public.user_profiles FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can insert profiles"
ON public.user_profiles FOR INSERT
TO authenticated
WITH CHECK (company_id = public.get_user_company_id() AND public.is_admin());

-- =====================================================
-- RLS POLICIES FOR USER_ROLES
-- =====================================================

CREATE POLICY "Admins can view roles in their company"
ON public.user_roles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.user_id = user_roles.user_id
    AND up.company_id = public.get_user_company_id()
  )
);

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- =====================================================
-- RLS POLICIES FOR CUSTOMERS
-- =====================================================

CREATE POLICY "Users can view customers in their company"
ON public.customers FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can insert customers in their company"
ON public.customers FOR INSERT
TO authenticated
WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Users can update customers in their company"
ON public.customers FOR UPDATE
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can delete customers in their company"
ON public.customers FOR DELETE
TO authenticated
USING (company_id = public.get_user_company_id());

-- =====================================================
-- RLS POLICIES FOR SUPPLIERS
-- =====================================================

CREATE POLICY "Users can view suppliers in their company"
ON public.suppliers FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can insert suppliers in their company"
ON public.suppliers FOR INSERT
TO authenticated
WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Users can update suppliers in their company"
ON public.suppliers FOR UPDATE
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can delete suppliers in their company"
ON public.suppliers FOR DELETE
TO authenticated
USING (company_id = public.get_user_company_id());

-- =====================================================
-- RLS POLICIES FOR ARTICLES
-- =====================================================

CREATE POLICY "Users can view articles in their company"
ON public.articles FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can insert articles in their company"
ON public.articles FOR INSERT
TO authenticated
WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Users can update articles in their company"
ON public.articles FOR UPDATE
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can delete articles in their company"
ON public.articles FOR DELETE
TO authenticated
USING (company_id = public.get_user_company_id());

-- =====================================================
-- RLS POLICIES FOR ARTICLE_VARIATIONS
-- =====================================================

CREATE POLICY "Users can view article variations in their company"
ON public.article_variations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.articles a
    WHERE a.id = article_variations.article_id
    AND a.company_id = public.get_user_company_id()
  )
);

CREATE POLICY "Users can manage article variations in their company"
ON public.article_variations FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.articles a
    WHERE a.id = article_variations.article_id
    AND a.company_id = public.get_user_company_id()
  )
);

-- =====================================================
-- RLS POLICIES FOR QUOTES
-- =====================================================

CREATE POLICY "Users can view quotes in their company"
ON public.quotes FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can insert quotes in their company"
ON public.quotes FOR INSERT
TO authenticated
WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Users can update quotes in their company"
ON public.quotes FOR UPDATE
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can delete quotes in their company"
ON public.quotes FOR DELETE
TO authenticated
USING (company_id = public.get_user_company_id());

-- =====================================================
-- RLS POLICIES FOR QUOTE_ITEMS
-- =====================================================

CREATE POLICY "Users can view quote items in their company"
ON public.quote_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_items.quote_id
    AND q.company_id = public.get_user_company_id()
  )
);

CREATE POLICY "Users can manage quote items in their company"
ON public.quote_items FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_items.quote_id
    AND q.company_id = public.get_user_company_id()
  )
);

-- =====================================================
-- RLS POLICIES FOR INVOICES
-- =====================================================

CREATE POLICY "Users can view invoices in their company"
ON public.invoices FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can insert invoices in their company"
ON public.invoices FOR INSERT
TO authenticated
WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Users can update invoices in their company"
ON public.invoices FOR UPDATE
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can delete invoices in their company"
ON public.invoices FOR DELETE
TO authenticated
USING (company_id = public.get_user_company_id());

-- =====================================================
-- RLS POLICIES FOR INVOICE_ITEMS
-- =====================================================

CREATE POLICY "Users can view invoice items in their company"
ON public.invoice_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_items.invoice_id
    AND i.company_id = public.get_user_company_id()
  )
);

CREATE POLICY "Users can manage invoice items in their company"
ON public.invoice_items FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_items.invoice_id
    AND i.company_id = public.get_user_company_id()
  )
);

-- =====================================================
-- RLS POLICIES FOR DELIVERY_NOTES
-- =====================================================

CREATE POLICY "Users can view delivery notes in their company"
ON public.delivery_notes FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can insert delivery notes in their company"
ON public.delivery_notes FOR INSERT
TO authenticated
WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Users can update delivery notes in their company"
ON public.delivery_notes FOR UPDATE
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can delete delivery notes in their company"
ON public.delivery_notes FOR DELETE
TO authenticated
USING (company_id = public.get_user_company_id());

-- =====================================================
-- RLS POLICIES FOR DELIVERY_NOTE_ITEMS
-- =====================================================

CREATE POLICY "Users can view delivery note items in their company"
ON public.delivery_note_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.delivery_notes dn
    WHERE dn.id = delivery_note_items.delivery_note_id
    AND dn.company_id = public.get_user_company_id()
  )
);

CREATE POLICY "Users can manage delivery note items in their company"
ON public.delivery_note_items FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.delivery_notes dn
    WHERE dn.id = delivery_note_items.delivery_note_id
    AND dn.company_id = public.get_user_company_id()
  )
);

-- =====================================================
-- RLS POLICIES FOR PRESUPUESTOS_N
-- =====================================================

CREATE POLICY "Users can view presupuestos_n in their company"
ON public.presupuestos_n FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can insert presupuestos_n in their company"
ON public.presupuestos_n FOR INSERT
TO authenticated
WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Users can update presupuestos_n in their company"
ON public.presupuestos_n FOR UPDATE
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can delete presupuestos_n in their company"
ON public.presupuestos_n FOR DELETE
TO authenticated
USING (company_id = public.get_user_company_id());

-- =====================================================
-- RLS POLICIES FOR PRESUPUESTO_N_ITEMS
-- =====================================================

CREATE POLICY "Users can view presupuesto_n items in their company"
ON public.presupuesto_n_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.presupuestos_n p
    WHERE p.id = presupuesto_n_items.presupuesto_id
    AND p.company_id = public.get_user_company_id()
  )
);

CREATE POLICY "Users can manage presupuesto_n items in their company"
ON public.presupuesto_n_items FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.presupuestos_n p
    WHERE p.id = presupuesto_n_items.presupuesto_id
    AND p.company_id = public.get_user_company_id()
  )
);

-- =====================================================
-- RLS POLICIES FOR PLANILLAS
-- =====================================================

CREATE POLICY "Users can view planillas in their company"
ON public.planillas FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can insert planillas in their company"
ON public.planillas FOR INSERT
TO authenticated
WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Users can update planillas in their company"
ON public.planillas FOR UPDATE
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can delete planillas in their company"
ON public.planillas FOR DELETE
TO authenticated
USING (company_id = public.get_user_company_id());

-- =====================================================
-- RLS POLICIES FOR PLANILLA_ITEMS
-- =====================================================

CREATE POLICY "Users can view planilla items in their company"
ON public.planilla_items FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.planillas p
    WHERE p.id = planilla_items.planilla_id
    AND p.company_id = public.get_user_company_id()
  )
);

CREATE POLICY "Users can manage planilla items in their company"
ON public.planilla_items FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.planillas p
    WHERE p.id = planilla_items.planilla_id
    AND p.company_id = public.get_user_company_id()
  )
);

-- =====================================================
-- RLS POLICIES FOR FAMILIES
-- =====================================================

CREATE POLICY "Users can view families in their company"
ON public.families FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can manage families in their company"
ON public.families FOR ALL
TO authenticated
USING (company_id = public.get_user_company_id());

-- =====================================================
-- RLS POLICIES FOR AGENDA
-- =====================================================

CREATE POLICY "Users can view agenda employees in their company"
ON public.agenda_employees FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can manage agenda employees in their company"
ON public.agenda_employees FOR ALL
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can view appointments in their company"
ON public.agenda_appointments FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can manage appointments in their company"
ON public.agenda_appointments FOR ALL
TO authenticated
USING (company_id = public.get_user_company_id());

-- =====================================================
-- RLS POLICIES FOR VERIFACTU
-- =====================================================

CREATE POLICY "Users can view verifactu config in their company"
ON public.verifactu_config FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Admins can manage verifactu config"
ON public.verifactu_config FOR ALL
TO authenticated
USING (company_id = public.get_user_company_id() AND public.is_admin());

CREATE POLICY "Users can view verifactu logs in their company"
ON public.verifactu_logs FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can insert verifactu logs in their company"
ON public.verifactu_logs FOR INSERT
TO authenticated
WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Users can view verifactu queue in their company"
ON public.verifactu_queue FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can manage verifactu queue in their company"
ON public.verifactu_queue FOR ALL
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can view verifactu xml in their company"
ON public.verifactu_xml_documents FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can manage verifactu xml in their company"
ON public.verifactu_xml_documents FOR ALL
TO authenticated
USING (company_id = public.get_user_company_id());

-- =====================================================
-- RLS POLICIES FOR DOCUMENTS
-- =====================================================

CREATE POLICY "Users can view document categories in their company"
ON public.document_categories FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can manage document categories in their company"
ON public.document_categories FOR ALL
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can view documents in their company"
ON public.documents FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can manage documents in their company"
ON public.documents FOR ALL
TO authenticated
USING (company_id = public.get_user_company_id());

-- =====================================================
-- RLS POLICIES FOR EMAIL CONFIG
-- =====================================================

CREATE POLICY "Admins can view email config"
ON public.email_config FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id() AND public.is_admin());

CREATE POLICY "Admins can manage email config"
ON public.email_config FOR ALL
TO authenticated
USING (company_id = public.get_user_company_id() AND public.is_admin());

-- =====================================================
-- RLS POLICIES FOR PRESTASHOP
-- =====================================================

CREATE POLICY "Admins can view prestashop config"
ON public.prestashop_config FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id() AND public.is_admin());

CREATE POLICY "Admins can manage prestashop config"
ON public.prestashop_config FOR ALL
TO authenticated
USING (company_id = public.get_user_company_id() AND public.is_admin());

CREATE POLICY "Users can view prestashop mappings in their company"
ON public.prestashop_mappings FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can manage prestashop mappings in their company"
ON public.prestashop_mappings FOR ALL
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can view prestashop logs in their company"
ON public.prestashop_sync_logs FOR SELECT
TO authenticated
USING (company_id = public.get_user_company_id());

CREATE POLICY "Users can insert prestashop logs in their company"
ON public.prestashop_sync_logs FOR INSERT
TO authenticated
WITH CHECK (company_id = public.get_user_company_id());

-- =====================================================
-- RLS POLICIES FOR SUPERUSERS (Only service role)
-- =====================================================

CREATE POLICY "Superusers table is service role only"
ON public.superusers FOR ALL
TO authenticated
USING (false);

-- =====================================================
-- CREATE SUPERUSER FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_superuser(p_email TEXT, p_password TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_password_hash TEXT;
  v_superuser_id UUID;
BEGIN
  -- Hash the password using pgcrypto
  v_password_hash := crypt(p_password, gen_salt('bf'));
  
  -- Insert the superuser
  INSERT INTO public.superusers (email, password_hash)
  VALUES (p_email, v_password_hash)
  RETURNING id INTO v_superuser_id;
  
  RETURN v_superuser_id;
END;
$$;

-- =====================================================
-- AUTO-CREATE USER PROFILE TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (user_id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- UPDATE TIMESTAMPS TRIGGER
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply update trigger to all tables with updated_at
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON public.articles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_article_variations_updated_at BEFORE UPDATE ON public.article_variations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_quotes_updated_at BEFORE UPDATE ON public.quotes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_delivery_notes_updated_at BEFORE UPDATE ON public.delivery_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_presupuestos_n_updated_at BEFORE UPDATE ON public.presupuestos_n FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_planillas_updated_at BEFORE UPDATE ON public.planillas FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_planilla_items_updated_at BEFORE UPDATE ON public.planilla_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_families_updated_at BEFORE UPDATE ON public.families FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_agenda_employees_updated_at BEFORE UPDATE ON public.agenda_employees FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_agenda_appointments_updated_at BEFORE UPDATE ON public.agenda_appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_verifactu_config_updated_at BEFORE UPDATE ON public.verifactu_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_email_config_updated_at BEFORE UPDATE ON public.email_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_prestashop_config_updated_at BEFORE UPDATE ON public.prestashop_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_superusers_updated_at BEFORE UPDATE ON public.superusers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- STORAGE BUCKET FOR ARTICLE PHOTOS
-- =====================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('article-photos', 'article-photos', true);

CREATE POLICY "Anyone can view article photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'article-photos');

CREATE POLICY "Authenticated users can upload article photos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'article-photos');

CREATE POLICY "Authenticated users can update article photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'article-photos');

CREATE POLICY "Authenticated users can delete article photos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'article-photos');

-- =====================================================
-- STORAGE BUCKET FOR DOCUMENTS
-- =====================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

CREATE POLICY "Authenticated users can view documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

CREATE POLICY "Authenticated users can update documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'documents');

CREATE POLICY "Authenticated users can delete documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'documents');