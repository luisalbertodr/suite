-- Suma rápida de no leídos (evita GET masivo a PostgREST desde el dock).

CREATE OR REPLACE FUNCTION public.whatsapp_unread_total(p_company_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_total integer;
BEGIN
  v_company_id := COALESCE(p_company_id, public.get_user_company_id());
  IF v_company_id IS NULL THEN
    RETURN 0;
  END IF;

  IF NOT (
    public.user_can_access_company(v_company_id)
    OR public.is_admin()
  ) THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(SUM(unread_count), 0)::integer
  INTO v_total
  FROM public.whatsapp_chats
  WHERE company_id = v_company_id
    AND archived = false
    AND unread_count > 0;

  RETURN COALESCE(v_total, 0);
END;
$$;

COMMENT ON FUNCTION public.whatsapp_unread_total(uuid) IS
  'Total de mensajes no leídos WhatsApp para la empresa (dock / badge).';

GRANT EXECUTE ON FUNCTION public.whatsapp_unread_total(uuid) TO authenticated;

CREATE INDEX IF NOT EXISTS whatsapp_chats_company_unread_idx
  ON public.whatsapp_chats (company_id)
  WHERE archived = false AND unread_count > 0;
