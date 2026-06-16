-- Activar Stripe señal de reserva para Lipoout
-- ============================================================================

DO $$
DECLARE
  v_company uuid := '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
  v_stage_id uuid;
BEGIN
  SELECT id INTO v_stage_id
  FROM public.marketing_lead_stages
  WHERE company_id = v_company
    AND (
      name ILIKE 'Cita confirmada (10%pagados)'
      OR name ILIKE 'Cita Confirmada (10%pagados)'
      OR name ILIKE '%10%pagados%'
    )
  ORDER BY position
  LIMIT 1;

  IF v_stage_id IS NULL THEN
    SELECT id INTO v_stage_id
    FROM public.marketing_lead_stages
    WHERE company_id = v_company
      AND name ILIKE 'Cita Confirmada (Sin pago)'
    ORDER BY position
    LIMIT 1;
  END IF;

  UPDATE public.stripe_config
  SET
    enabled = true,
    default_deposit_amount_cents = COALESCE(default_deposit_amount_cents, 1000),
    public_app_url = COALESCE(public_app_url, 'https://suite.lipoout.com'),
    confirmed_stage_id = COALESCE(v_stage_id, confirmed_stage_id),
    updated_at = now()
  WHERE company_id = v_company;

  -- Formularios Meta: señal Stripe 10 € (importe por formulario si no estaba)
  UPDATE public.meta_forms
  SET
    stripe_deposit_enabled = true,
    stripe_deposit_amount_cents = COALESCE(stripe_deposit_amount_cents, 1000),
    updated_at = now()
  WHERE company_id = v_company
    AND enabled = true;
END $$;
