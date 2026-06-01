-- Borra chats y mensajes locales de WhatsApp para una empresa (antes de vincular otro teléfono).

CREATE OR REPLACE FUNCTION public.whatsapp_purge_company_data(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_messages bigint;
  v_chats bigint;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id requerido';
  END IF;

  IF NOT (
    p_company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(p_company_id)
    OR public.is_admin()
  ) THEN
    RAISE EXCEPTION 'No autorizado para limpiar WhatsApp de esta empresa';
  END IF;

  SELECT count(*)::bigint INTO v_messages
  FROM public.whatsapp_messages WHERE company_id = p_company_id;

  SELECT count(*)::bigint INTO v_chats
  FROM public.whatsapp_chats WHERE company_id = p_company_id;

  DELETE FROM public.whatsapp_messages WHERE company_id = p_company_id;
  DELETE FROM public.whatsapp_chats WHERE company_id = p_company_id;

  UPDATE public.whatsapp_config
  SET
    last_status = 'STOPPED',
    last_status_message = NULL,
    last_status_at = now(),
    qr_data_url = NULL,
    qr_updated_at = NULL,
    me_jid = NULL,
    me_pushname = NULL,
    updated_at = now()
  WHERE company_id = p_company_id;

  RETURN jsonb_build_object(
    'ok', true,
    'messages_deleted', v_messages,
    'chats_deleted', v_chats
  );
END;
$$;

COMMENT ON FUNCTION public.whatsapp_purge_company_data(uuid) IS
  'Elimina historial local de WhatsApp (chats/mensajes) y resetea estado de sesión en whatsapp_config.';

GRANT EXECUTE ON FUNCTION public.whatsapp_purge_company_data(uuid) TO authenticated;
