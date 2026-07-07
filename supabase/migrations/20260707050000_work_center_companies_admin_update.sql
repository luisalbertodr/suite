-- Admins del centro laboral pueden editar datos fiscales de empresas hermanas (Medicina / Estética).

DROP POLICY IF EXISTS "Admins can update their own company" ON public.companies;

CREATE POLICY "Admins can update their own company"
  ON public.companies FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    AND (
      id = public.get_user_company_id()
      OR public.company_in_user_work_center(id)
    )
  )
  WITH CHECK (
    public.is_admin()
    AND (
      id = public.get_user_company_id()
      OR public.company_in_user_work_center(id)
    )
  );

COMMENT ON POLICY "Admins can update their own company" ON public.companies IS
  'Admin puede editar la empresa activa y las del mismo centro laboral (emisores fiscales).';
