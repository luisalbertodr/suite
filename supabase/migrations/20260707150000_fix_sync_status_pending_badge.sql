-- Badge «1 Sync» atascado: pending en bridge sin cola activa, o citas Style ya aplicadas.
-- Solo contar outbound Suite→Style realmente pendiente en Style.

UPDATE public.agenda_dunasoft_bridge b
SET dbf_status = 'applied', error_message = NULL, updated_at = now()
WHERE b.dbf_status = 'pending'
  AND b.source = 'dunasoft';

UPDATE public.agenda_dunasoft_bridge b
SET dbf_status = 'applied', error_message = NULL, updated_at = now()
FROM dunasoft.style_reservas_queue q
WHERE b.outbox_id = q.id
  AND b.dbf_status = 'pending'
  AND q.delivered_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.agenda_dunasoft_sync_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
DECLARE
  v_company_id uuid := public.get_user_company_id();
BEGIN
  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('pending_dbf', 0, 'error_dbf', 0, 'pending_outbox', 0);
  END IF;
  RETURN jsonb_build_object(
    'pending_dbf', (
      SELECT count(*)::int
      FROM public.agenda_dunasoft_bridge b
      INNER JOIN dunasoft.style_reservas_queue q ON q.id = b.outbox_id
      WHERE b.company_id = v_company_id
        AND b.dbf_status = 'pending'
        AND b.source = 'suite'
        AND q.delivered_at IS NULL
    ),
    'error_dbf', (
      SELECT count(*)::int FROM public.agenda_dunasoft_bridge b
      WHERE b.company_id = v_company_id AND b.dbf_status = 'error'
    ),
    'pending_outbox', (
      SELECT count(*)::int FROM dunasoft.style_reservas_queue q
      WHERE q.company_id = v_company_id
        AND q.delivered_at IS NULL
        AND q.created_at > now() - interval '7 days'
    )
  );
END;
$$;
