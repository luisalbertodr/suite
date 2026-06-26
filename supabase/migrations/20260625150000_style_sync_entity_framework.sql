-- Fase 0 del plan de integración Style ↔ Suite (maestros + transacciones).
-- Infraestructura transversal reutilizada por todas las fases:
--   * dunasoft.style_sync_entity_map  → mapeo style_key ↔ suite_id idempotente
--   * dunasoft.style_sync_cursor       → high-water mark por tabla de cola_sincro
--   * dunasoft.style_sync_outbox        → cola Suite→Style genérica (payloads grandes)
--   * helpers de upsert de mapeo, enqueue y ack
-- No activa ninguna entidad nueva: el agente solo procesa las tablas con cursor.enabled = true.

-- ---------------------------------------------------------------------------
-- 1. Mapeo de entidades Style ↔ Suite (evita duplicados, permite ACK idempotente)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dunasoft.style_sync_entity_map (
  company_id   uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entity_type  text NOT NULL,        -- customer | article | bono | sale | invoice | cash_session
  style_key    text NOT NULL,        -- codcli | codart | codboncli | numalb | numfac | numcie
  suite_id     uuid,                 -- fila public.* asociada (NULL hasta aplicar)
  sync_version bigint NOT NULL DEFAULT 0,
  last_direction text,               -- style_to_suite | suite_to_style
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, entity_type, style_key)
);

CREATE INDEX IF NOT EXISTS style_sync_entity_map_suite_idx
  ON dunasoft.style_sync_entity_map (company_id, entity_type, suite_id);

COMMENT ON TABLE dunasoft.style_sync_entity_map IS
  'Mapeo idempotente Style(style_key) ↔ Suite(suite_id) por entidad. sync_version implementa LWW.';

-- ---------------------------------------------------------------------------
-- 2. Cursor por tabla de cola_sincro (alta incremental sin perder filas)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dunasoft.style_sync_cursor (
  company_id   uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  tabla        text NOT NULL,        -- clientes | articulos | bonoscli | albcab | faccab | ciecab
  last_id      bigint NOT NULL DEFAULT 0,
  enabled      boolean NOT NULL DEFAULT false,
  last_ok_at   timestamptz,
  last_lag_ms  bigint,
  last_error   text,
  last_error_at timestamptz,
  errors       bigint NOT NULL DEFAULT 0,
  pending      bigint NOT NULL DEFAULT 0,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, tabla)
);

COMMENT ON TABLE dunasoft.style_sync_cursor IS
  'High-water mark Style→Suite por tabla de cola_sincro. enabled=false ⇒ el agente ignora la tabla.';

CREATE OR REPLACE FUNCTION dunasoft.style_sync_cursor_touch()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS style_sync_cursor_touch ON dunasoft.style_sync_cursor;
CREATE TRIGGER style_sync_cursor_touch
BEFORE UPDATE ON dunasoft.style_sync_cursor
FOR EACH ROW EXECUTE FUNCTION dunasoft.style_sync_cursor_touch();

-- ---------------------------------------------------------------------------
-- 3. Cola Suite→Style genérica (entidades con payload > 254 chars de cola_sincro)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dunasoft.style_sync_outbox (
  id           bigserial PRIMARY KEY,
  company_id   uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entity_type  text NOT NULL,
  operation    text NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  style_key    text,
  suite_id     uuid,
  payload      jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivered_at timestamptz,
  error        text,
  attempts     int NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS style_sync_outbox_pending_idx
  ON dunasoft.style_sync_outbox (company_id, created_at)
  WHERE delivered_at IS NULL;

COMMENT ON TABLE dunasoft.style_sync_outbox IS
  'Cola Suite→Style para entidades maestras/transacciones. El agente escribe JSON inbound por entity_type.';

-- ---------------------------------------------------------------------------
-- 4. Helpers de mapeo (LWW por sync_version) y resolución
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dunasoft.style_map_upsert(
  p_company_id  uuid,
  p_entity_type text,
  p_style_key   text,
  p_suite_id    uuid,
  p_sync_version bigint DEFAULT 0,
  p_direction   text DEFAULT 'style_to_suite'
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
  INSERT INTO dunasoft.style_sync_entity_map AS m (
    company_id, entity_type, style_key, suite_id, sync_version, last_direction, updated_at
  ) VALUES (
    p_company_id, p_entity_type, btrim(p_style_key), p_suite_id,
    COALESCE(p_sync_version, 0), p_direction, now()
  )
  ON CONFLICT (company_id, entity_type, style_key) DO UPDATE SET
    suite_id = COALESCE(EXCLUDED.suite_id, m.suite_id),
    sync_version = GREATEST(m.sync_version, EXCLUDED.sync_version),
    last_direction = EXCLUDED.last_direction,
    updated_at = now();
$$;

CREATE OR REPLACE FUNCTION dunasoft.style_map_suite_id(
  p_company_id  uuid,
  p_entity_type text,
  p_style_key   text
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
  SELECT suite_id
  FROM dunasoft.style_sync_entity_map
  WHERE company_id = p_company_id
    AND entity_type = p_entity_type
    AND style_key = btrim(p_style_key)
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION dunasoft.style_map_style_key(
  p_company_id  uuid,
  p_entity_type text,
  p_suite_id    uuid
)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
  SELECT style_key
  FROM dunasoft.style_sync_entity_map
  WHERE company_id = p_company_id
    AND entity_type = p_entity_type
    AND suite_id = p_suite_id
  LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- 5. Enqueue/ACK genéricos Suite→Style (style_sync_outbox)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dunasoft.enqueue_style_entity(
  p_company_id  uuid,
  p_entity_type text,
  p_operation   text,
  p_style_key   text,
  p_suite_id    uuid,
  p_payload     jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_id bigint;
BEGIN
  -- Solo encolar si la entidad está habilitada en el cursor (kill switch por tabla).
  IF NOT EXISTS (
    SELECT 1 FROM public.style_reservas_sync_config c
    WHERE c.company_id = p_company_id AND c.sync_enabled
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO dunasoft.style_sync_outbox (
    company_id, entity_type, operation, style_key, suite_id, payload
  ) VALUES (
    p_company_id, p_entity_type, p_operation,
    NULLIF(btrim(coalesce(p_style_key, '')), ''), p_suite_id,
    coalesce(p_payload, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION dunasoft.style_entity_ack(
  p_company_id  uuid,
  p_outbox_id   bigint,
  p_style_key   text,
  p_ok          boolean,
  p_error       text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_row dunasoft.style_sync_outbox%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM dunasoft.style_sync_outbox
  WHERE id = p_outbox_id AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Outbox no encontrada');
  END IF;

  IF p_ok THEN
    UPDATE dunasoft.style_sync_outbox
    SET delivered_at = now(), error = NULL
    WHERE id = p_outbox_id;

    -- Si Style asignó/confirmó la clave, fijarla en el mapeo.
    IF NULLIF(btrim(coalesce(p_style_key, '')), '') IS NOT NULL AND v_row.suite_id IS NOT NULL THEN
      PERFORM dunasoft.style_map_upsert(
        p_company_id, v_row.entity_type, p_style_key, v_row.suite_id, 0, 'suite_to_style'
      );
    END IF;
  ELSE
    UPDATE dunasoft.style_sync_outbox
    SET error = coalesce(p_error, 'Style rechazó'), attempts = attempts + 1
    WHERE id = p_outbox_id;
  END IF;

  RETURN jsonb_build_object('ok', p_ok, 'outbox_id', p_outbox_id, 'style_key', p_style_key);
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Cursor: lectura/avance por tabla (consumido por el agente Node)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dunasoft.style_sync_cursor_advance(
  p_company_id uuid,
  p_tabla      text,
  p_last_id    bigint,
  p_lag_ms     bigint DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
  INSERT INTO dunasoft.style_sync_cursor AS c (
    company_id, tabla, last_id, last_ok_at, last_lag_ms, last_error, last_error_at, updated_at
  ) VALUES (
    p_company_id, p_tabla, p_last_id, now(), p_lag_ms, NULL, NULL, now()
  )
  ON CONFLICT (company_id, tabla) DO UPDATE SET
    last_id = GREATEST(c.last_id, EXCLUDED.last_id),
    last_ok_at = now(),
    last_lag_ms = COALESCE(EXCLUDED.last_lag_ms, c.last_lag_ms),
    last_error = NULL,
    last_error_at = NULL,
    updated_at = now();
$$;

CREATE OR REPLACE FUNCTION dunasoft.style_sync_cursor_error(
  p_company_id uuid,
  p_tabla      text,
  p_error      text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
  INSERT INTO dunasoft.style_sync_cursor AS c (
    company_id, tabla, last_error, last_error_at, errors, updated_at
  ) VALUES (
    p_company_id, p_tabla, p_error, now(), 1, now()
  )
  ON CONFLICT (company_id, tabla) DO UPDATE SET
    last_error = EXCLUDED.last_error,
    last_error_at = now(),
    errors = c.errors + 1,
    updated_at = now();
$$;

-- ---------------------------------------------------------------------------
-- 7. Permisos service_role (agente Node usa service key)
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON dunasoft.style_sync_entity_map TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON dunasoft.style_sync_cursor TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON dunasoft.style_sync_outbox TO service_role;
GRANT USAGE, SELECT ON SEQUENCE dunasoft.style_sync_outbox_id_seq TO service_role;

GRANT EXECUTE ON FUNCTION dunasoft.style_map_upsert(uuid, text, text, uuid, bigint, text) TO service_role;
GRANT EXECUTE ON FUNCTION dunasoft.style_map_suite_id(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION dunasoft.style_map_style_key(uuid, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION dunasoft.enqueue_style_entity(uuid, text, text, text, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION dunasoft.style_entity_ack(uuid, bigint, text, boolean, text) TO service_role;
GRANT EXECUTE ON FUNCTION dunasoft.style_sync_cursor_advance(uuid, text, bigint, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION dunasoft.style_sync_cursor_error(uuid, text, text) TO service_role;
