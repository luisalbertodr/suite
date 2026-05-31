-- Centro laboral: catálogo compartido (artículos, familias, clientes)
-- bajo el tenant operativo. Las empresas hermanas del mismo work_center
-- deben poder leer/gestionar ese catálogo aunque company_id ≠ empresa activa.

-- ---------------------------------------------------------------------------
-- 1. Sincronizar billing_company_id de artículos con su familia asignada
--    (corrige overrides masivos previos a la separación medicina/estética)
-- ---------------------------------------------------------------------------
UPDATE public.articles a
SET billing_company_id = af.billing_company_id,
    updated_at = now()
FROM public.article_families af
WHERE af.company_id = a.company_id
  AND af.name = a.familia
  AND af.billing_company_id IS NOT NULL
  AND a.billing_company_id IS DISTINCT FROM af.billing_company_id;

-- ---------------------------------------------------------------------------
-- 2. RLS: articles
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can access their company's articles" ON public.articles;
DROP POLICY IF EXISTS "Users can view articles in their company" ON public.articles;
DROP POLICY IF EXISTS "Users can insert articles in their company" ON public.articles;
DROP POLICY IF EXISTS "Users can update articles in their company" ON public.articles;
DROP POLICY IF EXISTS "Users can delete articles in their company" ON public.articles;

CREATE POLICY "Users can view articles in their company"
  ON public.articles FOR SELECT TO authenticated
  USING (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  );

CREATE POLICY "Users can insert articles in their company"
  ON public.articles FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  );

CREATE POLICY "Users can update articles in their company"
  ON public.articles FOR UPDATE TO authenticated
  USING (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  );

CREATE POLICY "Users can delete articles in their company"
  ON public.articles FOR DELETE TO authenticated
  USING (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  );

-- ---------------------------------------------------------------------------
-- 3. RLS: article_families
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view article families in their company" ON public.article_families;
DROP POLICY IF EXISTS "Users can manage article families in their company" ON public.article_families;
DROP POLICY IF EXISTS "Users can access article families" ON public.article_families;

CREATE POLICY "Users can view article families in their company"
  ON public.article_families FOR SELECT TO authenticated
  USING (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  );

CREATE POLICY "Users can manage article families in their company"
  ON public.article_families FOR ALL TO authenticated
  USING (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  );

-- ---------------------------------------------------------------------------
-- 4. RLS: article_variations
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can access article variations" ON public.article_variations;
DROP POLICY IF EXISTS "Users can insert article variations for their company articles" ON public.article_variations;
DROP POLICY IF EXISTS "Users can update article variations for their company articles" ON public.article_variations;
DROP POLICY IF EXISTS "Users can delete article variations for their company articles" ON public.article_variations;

CREATE POLICY "Users can access article variations"
  ON public.article_variations FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.articles a
      WHERE a.id = article_variations.article_id
        AND (
          a.company_id = public.get_user_company_id()
          OR public.company_in_user_work_center(a.company_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.articles a
      WHERE a.id = article_variations.article_id
        AND (
          a.company_id = public.get_user_company_id()
          OR public.company_in_user_work_center(a.company_id)
        )
    )
  );

-- ---------------------------------------------------------------------------
-- 5. RLS: customers (base compartida del centro laboral)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can access their company's customers" ON public.customers;
DROP POLICY IF EXISTS "Users can view customers in their company" ON public.customers;
DROP POLICY IF EXISTS "Users can insert customers in their company" ON public.customers;
DROP POLICY IF EXISTS "Users can update customers in their company" ON public.customers;
DROP POLICY IF EXISTS "Users can delete customers in their company" ON public.customers;

CREATE POLICY "Users can view customers in their company"
  ON public.customers FOR SELECT TO authenticated
  USING (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  );

CREATE POLICY "Users can insert customers in their company"
  ON public.customers FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  );

CREATE POLICY "Users can update customers in their company"
  ON public.customers FOR UPDATE TO authenticated
  USING (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  );

CREATE POLICY "Users can delete customers in their company"
  ON public.customers FOR DELETE TO authenticated
  USING (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  );
