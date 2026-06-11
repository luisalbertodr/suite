-- Notas marketing: RLS multi-empresa + coherencia lead_id / company_id

DROP POLICY IF EXISTS "marketing_lead_notes_company_access" ON public.marketing_lead_notes;

CREATE POLICY "marketing_lead_notes_company_access"
  ON public.marketing_lead_notes FOR ALL TO authenticated
  USING (public.user_can_access_company(company_id))
  WITH CHECK (
    public.user_can_access_company(company_id)
    AND EXISTS (
      SELECT 1
      FROM public.marketing_leads ml
      WHERE ml.id = lead_id
        AND ml.company_id = marketing_lead_notes.company_id
    )
  );
