-- Notificaciones internas entre usuarios, opcionalmente vinculadas a una cita.

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL, -- destinatario (compat con código actual)
  from_user_id uuid, -- emisor
  appointment_id uuid REFERENCES public.agenda_appointments(id) ON DELETE SET NULL,
  title text NOT NULL,
  message text,
  type text NOT NULL DEFAULT 'custom',
  link text,
  read boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_company_user_created
  ON public.notifications(company_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_appointment_id
  ON public.notifications(appointment_id);

CREATE INDEX IF NOT EXISTS idx_notifications_read
  ON public.notifications(read);

-- updated_at automático
CREATE OR REPLACE FUNCTION public.set_notifications_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON public.notifications;
CREATE TRIGGER trg_notifications_updated_at
BEFORE UPDATE ON public.notifications
FOR EACH ROW
EXECUTE FUNCTION public.set_notifications_updated_at();

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Ver notificaciones de la propia empresa donde el usuario sea destinatario.
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own
ON public.notifications
FOR SELECT
TO authenticated
USING (
  company_id = get_user_company_id()
  AND user_id = auth.uid()
);

-- Crear notificaciones para usuarios de la misma empresa.
DROP POLICY IF EXISTS notifications_insert_same_company ON public.notifications;
CREATE POLICY notifications_insert_same_company
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = get_user_company_id()
  AND from_user_id = auth.uid()
);

-- Marcar como leída (solo destinatario).
DROP POLICY IF EXISTS notifications_update_read_own ON public.notifications;
CREATE POLICY notifications_update_read_own
ON public.notifications
FOR UPDATE
TO authenticated
USING (
  company_id = get_user_company_id()
  AND user_id = auth.uid()
)
WITH CHECK (
  company_id = get_user_company_id()
  AND user_id = auth.uid()
);

-- Borrado opcional por destinatario.
DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;
CREATE POLICY notifications_delete_own
ON public.notifications
FOR DELETE
TO authenticated
USING (
  company_id = get_user_company_id()
  AND user_id = auth.uid()
);
