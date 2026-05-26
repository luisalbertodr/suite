-- ============================================================================
-- Integración con WhatsApp vía Waha
-- ----------------------------------------------------------------------------
-- Waha (https://waha.devlike.pro/) expone una API HTTP y webhooks para
-- enviar/recibir mensajes de WhatsApp. Esta migración prepara:
--   * whatsapp_config   → configuración por empresa (URL Waha, API key,
--                          nombre de sesión, estado y QR de login).
--   * whatsapp_chats    → cache local de cada chat (jid, nombre, último
--                          mensaje, no-leídos, foto…) por empresa.
--   * whatsapp_messages → todos los mensajes (entrantes y salientes) con
--                          referencia opcional a media y estado de ack.
--   * Permisos RBAC: whatsapp:read/write y whatsapp_config:read/write.
--   * RLS por empresa (igual que el resto del proyecto).
--   * Realtime sobre chats y mensajes para tener UI en vivo.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) whatsapp_config (una fila por empresa)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_config (
  company_id          UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  -- Endpoint del servidor Waha self-hosted, p.ej. https://waha.lipoout.com
  base_url            TEXT,
  -- API key configurada en Waha (header X-Api-Key)
  api_key             TEXT,
  -- Nombre de la sesión dentro de Waha (única por empresa)
  session_name        TEXT NOT NULL DEFAULT 'default',
  -- Secreto compartido para verificar webhooks entrantes (X-Webhook-Secret)
  webhook_secret      TEXT,
  -- Prefijo de país por defecto para normalizar números sin código
  default_country_code TEXT DEFAULT '34',
  enabled             BOOLEAN NOT NULL DEFAULT true,
  -- Último estado conocido de la sesión Waha: STOPPED, STARTING, SCAN_QR_CODE,
  -- WORKING, FAILED, etc. (lo rellena el edge function al consultar Waha).
  last_status         TEXT,
  last_status_message TEXT,
  last_status_at      TIMESTAMPTZ,
  -- Último QR pintado por Waha (data URL PNG o cadena base64) y cuándo se actualizó
  qr_data_url         TEXT,
  qr_updated_at       TIMESTAMPTZ,
  -- Información del propio teléfono conectado
  me_jid              TEXT,
  me_pushname         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2) whatsapp_chats (cache local de la lista de chats)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_chats (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id            UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  -- jid de WhatsApp (p.ej. 34666777888@c.us o 12036...@g.us)
  chat_id               TEXT NOT NULL,
  name                  TEXT,
  is_group              BOOLEAN NOT NULL DEFAULT false,
  profile_picture_url   TEXT,
  last_message_preview  TEXT,
  last_message_at       TIMESTAMPTZ,
  last_message_from_me  BOOLEAN NOT NULL DEFAULT false,
  unread_count          INTEGER NOT NULL DEFAULT 0,
  pinned                BOOLEAN NOT NULL DEFAULT false,
  archived              BOOLEAN NOT NULL DEFAULT false,
  -- Vinculación opcional con un cliente / lead existente en la plataforma
  customer_id           UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  marketing_lead_id     UUID REFERENCES public.marketing_leads(id) ON DELETE SET NULL,
  raw                   JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, chat_id)
);

CREATE INDEX IF NOT EXISTS whatsapp_chats_company_idx
  ON public.whatsapp_chats(company_id);
CREATE INDEX IF NOT EXISTS whatsapp_chats_company_last_msg_idx
  ON public.whatsapp_chats(company_id, last_message_at DESC NULLS LAST);

-- ---------------------------------------------------------------------------
-- 3) whatsapp_messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  -- jid del chat (igual que whatsapp_chats.chat_id)
  chat_id             TEXT NOT NULL,
  -- id del mensaje en Waha (p.ej. false_34666777888@c.us_3EB0XXXXXX)
  waha_message_id     TEXT,
  -- Quién lo envió (jid)
  from_jid            TEXT,
  from_me             BOOLEAN NOT NULL DEFAULT false,
  -- Tipo: text | image | video | audio | document | sticker | location | contact | unknown
  type                TEXT NOT NULL DEFAULT 'text',
  body                TEXT,
  caption             TEXT,
  -- Para multimedia: la URL de descarga (proxy edge function) y metadatos
  media_url           TEXT,
  media_mime_type     TEXT,
  media_filename      TEXT,
  media_size          BIGINT,
  -- ack de WhatsApp: -1 error, 0 pending, 1 server, 2 device, 3 read, 4 played
  ack                 INTEGER NOT NULL DEFAULT 0,
  -- Mensaje al que cita (waha_message_id)
  quoted_message_id   TEXT,
  -- Momento en que se envió/recibió (UTC). Por defecto, ahora.
  timestamp           TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Payload original recibido de Waha (útil para debug)
  raw                 JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Algunos eventos de Waha llegan sin waha_message_id (p.ej. el propio echo
-- inmediato tras enviar) por eso lo dejamos NULLable, pero garantizamos
-- unicidad cuando viene relleno para no duplicar al recibir el webhook
-- inmediatamente después del POST de envío.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_company_waha_id_uidx
  ON public.whatsapp_messages(company_id, waha_message_id)
  WHERE waha_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS whatsapp_messages_chat_time_idx
  ON public.whatsapp_messages(company_id, chat_id, timestamp DESC);

-- ============================================================================
-- RLS
-- ============================================================================
ALTER TABLE public.whatsapp_config   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_chats    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "whatsapp_config_company_access" ON public.whatsapp_config;
CREATE POLICY "whatsapp_config_company_access"
  ON public.whatsapp_config FOR ALL TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "whatsapp_chats_company_access" ON public.whatsapp_chats;
CREATE POLICY "whatsapp_chats_company_access"
  ON public.whatsapp_chats FOR ALL TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

DROP POLICY IF EXISTS "whatsapp_messages_company_access" ON public.whatsapp_messages;
CREATE POLICY "whatsapp_messages_company_access"
  ON public.whatsapp_messages FOR ALL TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

-- ============================================================================
-- Triggers updated_at
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column'
  ) THEN
    DROP TRIGGER IF EXISTS trg_whatsapp_config_updated_at ON public.whatsapp_config;
    CREATE TRIGGER trg_whatsapp_config_updated_at
      BEFORE UPDATE ON public.whatsapp_config
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    DROP TRIGGER IF EXISTS trg_whatsapp_chats_updated_at ON public.whatsapp_chats;
    CREATE TRIGGER trg_whatsapp_chats_updated_at
      BEFORE UPDATE ON public.whatsapp_chats
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    DROP TRIGGER IF EXISTS trg_whatsapp_messages_updated_at ON public.whatsapp_messages;
    CREATE TRIGGER trg_whatsapp_messages_updated_at
      BEFORE UPDATE ON public.whatsapp_messages
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ============================================================================
-- Realtime: añadir las tablas a la publicación supabase_realtime
-- ============================================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_chats;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_config;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- ============================================================================
-- Permisos del módulo
-- ============================================================================
INSERT INTO public.permissions (resource, action, name) VALUES
  ('whatsapp',        'read',  'WhatsApp (ver chats y leer mensajes)'),
  ('whatsapp',        'write', 'WhatsApp (enviar mensajes)'),
  ('whatsapp_config', 'read',  'Ver configuración WhatsApp'),
  ('whatsapp_config', 'write', 'Editar configuración WhatsApp')
ON CONFLICT (resource, action) DO NOTHING;

-- Heredar lectura/escritura de WhatsApp a quien hoy tenga marketing:write y
-- la configuración a quien tenga settings:write. Idempotente.
WITH src AS (
  SELECT id FROM public.permissions WHERE resource = 'marketing' AND action = 'write'
), dst_r AS (
  SELECT id FROM public.permissions WHERE resource = 'whatsapp' AND action = 'read'
), dst_w AS (
  SELECT id FROM public.permissions WHERE resource = 'whatsapp' AND action = 'write'
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT rp.role_id, p.id
FROM public.role_permissions rp
CROSS JOIN (
  SELECT id FROM dst_r
  UNION
  SELECT id FROM dst_w
) p
WHERE rp.permission_id = (SELECT id FROM src)
ON CONFLICT DO NOTHING;

WITH src AS (
  SELECT id FROM public.permissions WHERE resource = 'settings' AND action = 'write'
), dst_cr AS (
  SELECT id FROM public.permissions WHERE resource = 'whatsapp_config' AND action = 'read'
), dst_cw AS (
  SELECT id FROM public.permissions WHERE resource = 'whatsapp_config' AND action = 'write'
)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT rp.role_id, p.id
FROM public.role_permissions rp
CROSS JOIN (
  SELECT id FROM dst_cr
  UNION
  SELECT id FROM dst_cw
) p
WHERE rp.permission_id = (SELECT id FROM src)
ON CONFLICT DO NOTHING;
