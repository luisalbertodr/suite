-- Limpieza citas de prueba E2E (idplan 999999xxx) en Postgres Suite.
-- Uso: aplicar vía deploy-migration o psql en 110.

DO $$
DECLARE
  v_company_id uuid := '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
  v_idplan numeric;
BEGIN
  FOR v_idplan IN
    SELECT idplan FROM dunasoft.plan2009 WHERE idplan >= 999999990
  LOOP
    DELETE FROM dunasoft.planart WHERE idplan = v_idplan;
    DELETE FROM dunasoft.plan2009 WHERE idplan = v_idplan;
    DELETE FROM public.agenda_appointments
    WHERE company_id = v_company_id AND legacy_idplan = v_idplan::text;
    DELETE FROM public.agenda_dunasoft_bridge
    WHERE company_id = v_company_id AND legacy_idplan = v_idplan::text;
  END LOOP;
END;
$$;
