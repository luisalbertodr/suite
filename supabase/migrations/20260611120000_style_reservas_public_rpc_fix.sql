-- PostgREST: la Edge Function pasa p_style_modified_at pero el wrapper public.* no lo tenía → 500 en stylereservas.

DROP FUNCTION IF EXISTS public.style_reservas_apply_from_style(
  uuid, text, numeric, text, text, date, text, text, text, text, text, text, boolean, text, numeric, numeric
);

DROP FUNCTION IF EXISTS dunasoft.style_reservas_apply_from_style(
  uuid, text, numeric, text, text, date, text, text, text, text, text, text, boolean, text, numeric, numeric
);

CREATE OR REPLACE FUNCTION public.style_reservas_apply_from_style(
  p_company_id uuid,
  p_accion text,
  p_idplan numeric,
  p_codemp text,
  p_codcli text,
  p_fecha date,
  p_horini text,
  p_horfin text,
  p_texto text,
  p_codrec text,
  p_nomcli text,
  p_tel1cli text,
  p_facturado boolean,
  p_servicios text,
  p_colfon numeric,
  p_collet numeric,
  p_style_modified_at text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
  SELECT dunasoft.style_reservas_apply_from_style(
    p_company_id, p_accion, p_idplan, p_codemp, p_codcli, p_fecha,
    p_horini, p_horfin, p_texto, p_codrec, p_nomcli, p_tel1cli,
    p_facturado, p_servicios, p_colfon, p_collet, p_style_modified_at
  );
$$;

GRANT EXECUTE ON FUNCTION public.style_reservas_apply_from_style(
  uuid, text, numeric, text, text, date, text, text, text, text, text, text, boolean, text, numeric, numeric, text
) TO service_role;

NOTIFY pgrst, 'reload schema';
