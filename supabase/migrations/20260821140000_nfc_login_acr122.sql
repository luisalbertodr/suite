-- Login por tarjeta NFC (ACR122U) → user_profiles.nfc_uid + retos de login efímeros.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS nfc_uid text;

COMMENT ON COLUMN public.user_profiles.nfc_uid IS
  'UID normalizado (hex mayúsculas sin separadores) de la tarjeta NFC/MIFARE para login.';

-- Un UID solo puede pertenecer a un usuario (global).
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_nfc_uid_unique
  ON public.user_profiles (nfc_uid)
  WHERE nfc_uid IS NOT NULL AND length(btrim(nfc_uid)) > 0;

CREATE TABLE IF NOT EXISTS public.nfc_login_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id text NOT NULL,
  public_code text NOT NULL,
  poll_token text NOT NULL,
  status text NOT NULL DEFAULT 'waiting'
    CHECK (status = ANY (ARRAY['waiting'::text, 'completed'::text, 'expired'::text, 'failed'::text])),
  nfc_uid text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  access_token text,
  refresh_token text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 minutes'),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_nfc_login_challenges_station_waiting
  ON public.nfc_login_challenges (station_id, status, created_at DESC)
  WHERE status = 'waiting';

CREATE INDEX IF NOT EXISTS idx_nfc_login_challenges_expires
  ON public.nfc_login_challenges (expires_at)
  WHERE status = 'waiting';

COMMENT ON TABLE public.nfc_login_challenges IS
  'Retos efímeros de login NFC: el navegador crea el reto; el agente ACR122U lo completa.';

ALTER TABLE public.nfc_login_challenges ENABLE ROW LEVEL SECURITY;

-- Sin políticas para authenticated/anon: solo service_role (Edge Function) accede.
REVOKE ALL ON TABLE public.nfc_login_challenges FROM anon, authenticated;
GRANT ALL ON TABLE public.nfc_login_challenges TO service_role;

-- Enrolamiento: admins de la misma empresa pueden ver/editar nfc_uid de su compañía
-- (ya cubierto por políticas existentes de user_profiles si permiten update;
--  añadimos lectura del campo vía select habitual).
