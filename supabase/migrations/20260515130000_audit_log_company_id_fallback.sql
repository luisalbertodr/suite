-- Corrige audit_log_row_change cuando company_id es NULL (ventas legacy, backfills).
-- Resuelve: company_id → host_company_id → get_user_company_id(); omite si sigue NULL.

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

  -- company_id (columna estándar)
  BEGIN
    IF TG_OP = 'DELETE' THEN
      v_company := (OLD).company_id;
    ELSIF TG_OP = 'INSERT' THEN
      v_company := (NEW).company_id;
    ELSE
      v_company := COALESCE((NEW).company_id, (OLD).company_id);
    END IF;
  EXCEPTION WHEN SQLSTATE '42703' THEN
    v_company := NULL;
  END;

  -- host_company_id (ventas split billing / centro laboral)
  IF v_company IS NULL THEN
    BEGIN
      IF TG_OP = 'DELETE' THEN
        v_company := (OLD).host_company_id;
      ELSIF TG_OP = 'INSERT' THEN
        v_company := (NEW).host_company_id;
      ELSE
        v_company := COALESCE((NEW).host_company_id, (OLD).host_company_id);
      END IF;
    EXCEPTION WHEN SQLSTATE '42703' THEN
      v_company := NULL;
    END;
  END IF;

  -- Usuario autenticado como último recurso
  IF v_company IS NULL THEN
    v_company := public.get_user_company_id();
  END IF;

  -- Sin tenant resoluble: no insertar (evita violar NOT NULL en audit_events)
  IF v_company IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
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
  'Registrar INSERT/UPDATE/DELETE. Resuelve company_id vía company_id, host_company_id o get_user_company_id(). Omite si no hay tenant.';

-- Completar backfill pendiente (si la migración anterior falló a medias)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sales' AND column_name = 'host_company_id'
  ) THEN
    ALTER TABLE public.sales DISABLE TRIGGER tr_audit_sales;
    UPDATE public.sales
    SET host_company_id = company_id
    WHERE host_company_id IS NULL
      AND company_id IS NOT NULL;
    ALTER TABLE public.sales ENABLE TRIGGER tr_audit_sales;
  END IF;
END
$$;
