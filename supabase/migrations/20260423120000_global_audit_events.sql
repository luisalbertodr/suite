-- =============================================================================
-- Auditoría global (Suite): quién / qué / cuándo, append-only.
-- Los campos legacy.* en tablas públicas son transitorios: nutren la app hasta
-- completar el traspaso; luego se podrán retirar. El historial Dunasoft bruto
-- sigue en el esquema legacy (no sustituye esta auditoría de la app).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.audit_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
  entity_schema text NOT NULL DEFAULT 'public',
  entity_table text NOT NULL,
  entity_id text,
  old_record jsonb,
  new_record jsonb,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.audit_events IS
  'Registro append-only de cambios en la app (quién/qué/cuándo). No borrar filas salvo políticas de archivo. '
  'Los datos legacy importados viven en schema legacy y columnas legacy_* transitorias en tablas públicas.';

CREATE INDEX IF NOT EXISTS idx_audit_events_company_created
  ON public.audit_events (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_entity
  ON public.audit_events (entity_schema, entity_table, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_events_actor
  ON public.audit_events (actor_user_id)
  WHERE actor_user_id IS NOT NULL;

ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Helpers RLS (idempotente): en algunos entornos no está aplicada la migración que los crea.
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.user_profiles WHERE user_id = auth.uid() LIMIT 1
$$;

DROP POLICY IF EXISTS audit_events_select_company_admin ON public.audit_events;
DROP POLICY IF EXISTS audit_events_select_company ON public.audit_events;

-- Lectura: usuarios autenticados de la misma empresa (no exige public.user_roles).
-- Cuando tengas roles finos, añade política aparte o columna "auditor" y restinge aquí.
CREATE POLICY audit_events_select_company
  ON public.audit_events
  FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE SCHEMA IF NOT EXISTS legacy;

COMMENT ON SCHEMA legacy IS
  'Volcado fiel del sistema origen (Dunasoft/Style). Historial de negocio allí; columnas legacy_* en public son puente hasta estabilizar datos en la app nueva.';

-- =============================================================================
-- Trigger genérico: exige filas con company_id e id (uuid). Ampliar con:
-- CREATE TRIGGER tr_audit_<tabla> AFTER INSERT OR UPDATE OR DELETE ON public.<tabla>
-- FOR EACH ROW EXECUTE FUNCTION public.audit_log_row_change();
-- =============================================================================

CREATE OR REPLACE FUNCTION public.audit_log_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid;
  v_entity_id text;
  v_old jsonb;
  v_new jsonb;
  v_actor uuid;
BEGIN
  v_actor := auth.uid();

  IF TG_OP = 'DELETE' THEN
    BEGIN
      v_company := (OLD).company_id;
    EXCEPTION WHEN SQLSTATE '42703' THEN
      RETURN OLD;
    END;
    BEGIN
      v_entity_id := (OLD).id::text;
    EXCEPTION WHEN SQLSTATE '42703' THEN
      v_entity_id := NULL;
    END;
    v_old := to_jsonb(row_to_json(OLD));
    INSERT INTO public.audit_events (
      company_id, actor_user_id, action, entity_schema, entity_table, entity_id, old_record, new_record, metadata
    ) VALUES (
      v_company, v_actor, 'delete', TG_TABLE_SCHEMA, TG_TABLE_NAME, v_entity_id, v_old, NULL,
      jsonb_build_object('source', 'trigger')
    );
    RETURN OLD;
  END IF;

  IF TG_OP = 'INSERT' THEN
    BEGIN
      v_company := (NEW).company_id;
    EXCEPTION WHEN SQLSTATE '42703' THEN
      RETURN NEW;
    END;
    BEGIN
      v_entity_id := (NEW).id::text;
    EXCEPTION WHEN SQLSTATE '42703' THEN
      v_entity_id := NULL;
    END;
    v_new := to_jsonb(row_to_json(NEW));
    INSERT INTO public.audit_events (
      company_id, actor_user_id, action, entity_schema, entity_table, entity_id, old_record, new_record, metadata
    ) VALUES (
      v_company, v_actor, 'insert', TG_TABLE_SCHEMA, TG_TABLE_NAME, v_entity_id, NULL, v_new,
      jsonb_build_object('source', 'trigger')
    );
    RETURN NEW;
  END IF;

  -- UPDATE
  BEGIN
    v_company := COALESCE((NEW).company_id, (OLD).company_id);
  EXCEPTION WHEN SQLSTATE '42703' THEN
    RETURN NEW;
  END;
  BEGIN
    v_entity_id := COALESCE((NEW).id, (OLD).id)::text;
  EXCEPTION WHEN SQLSTATE '42703' THEN
    v_entity_id := NULL;
  END;
  v_old := to_jsonb(row_to_json(OLD));
  v_new := to_jsonb(row_to_json(NEW));
  INSERT INTO public.audit_events (
    company_id, actor_user_id, action, entity_schema, entity_table, entity_id, old_record, new_record, metadata
  ) VALUES (
    v_company, v_actor, 'update', TG_TABLE_SCHEMA, TG_TABLE_NAME, v_entity_id, v_old, v_new,
    jsonb_build_object('source', 'trigger')
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.audit_log_row_change() IS
  'Registrar INSERT/UPDATE/DELETE. Reutilizar en tablas con company_id e id (uuid). Scripts con service_role no tienen auth.uid().';

DROP TRIGGER IF EXISTS tr_audit_agenda_appointments ON public.agenda_appointments;
CREATE TRIGGER tr_audit_agenda_appointments
  AFTER INSERT OR UPDATE OR DELETE ON public.agenda_appointments
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_row_change();

DROP TRIGGER IF EXISTS tr_audit_customers ON public.customers;
CREATE TRIGGER tr_audit_customers
  AFTER INSERT OR UPDATE OR DELETE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_row_change();

DROP TRIGGER IF EXISTS tr_audit_invoices ON public.invoices;
CREATE TRIGGER tr_audit_invoices
  AFTER INSERT OR UPDATE OR DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_row_change();

GRANT SELECT ON public.audit_events TO authenticated;
GRANT ALL ON public.audit_events TO service_role;
