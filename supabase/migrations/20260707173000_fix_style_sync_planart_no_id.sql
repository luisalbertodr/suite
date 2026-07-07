-- Fix producción: dunasoft.planart no tiene columna id.
-- El sync inbound de Style debe reconstruir appointment_items sin depender de esa PK.

CREATE OR REPLACE FUNCTION dunasoft.sync_appointment_items_from_style(
  p_appointment_id uuid,
  p_company_id uuid,
  p_idplan numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
BEGIN
  IF p_appointment_id IS NULL OR p_company_id IS NULL OR p_idplan IS NULL THEN
    RETURN;
  END IF;

  DELETE FROM public.appointment_items
  WHERE appointment_id = p_appointment_id;

  INSERT INTO public.appointment_items (
    appointment_id,
    kind,
    label,
    duration_minutes,
    occupies_time,
    sort_order,
    article_id,
    quantity,
    unit_price,
    bonus_payment_mode
  )
  SELECT
    p_appointment_id,
    CASE
      WHEN lower(coalesce(a.article_kind, '')) = 'producto' THEN 'product'
      ELSE 'service'
    END AS kind,
    CASE
      WHEN a.id IS NOT NULL AND nullif(btrim(coalesce(a.descripcion, '')), '') IS NOT NULL THEN
        concat_ws(' - ', nullif(btrim(pa.codart), ''), nullif(btrim(a.descripcion), ''))
      ELSE
        coalesce(nullif(btrim(pa.codart), ''), 'Servicio')
    END AS label,
    CASE
      WHEN lower(coalesce(a.article_kind, '')) = 'producto' THEN 0
      ELSE greatest(coalesce(a.duration_minutes, 30), 0)
    END AS duration_minutes,
    CASE
      WHEN lower(coalesce(a.article_kind, '')) = 'producto' THEN false
      ELSE true
    END AS occupies_time,
    row_number() OVER (
      ORDER BY coalesce(nullif(btrim(pa.hora), ''), '99:99'), nullif(btrim(pa.codart), '')
    ) - 1 AS sort_order,
    a.id AS article_id,
    1 AS quantity,
    greatest(coalesce(a.precio, 0), 0) AS unit_price,
    'none' AS bonus_payment_mode
  FROM dunasoft.planart pa
  LEFT JOIN public.articles a
    ON a.company_id = p_company_id
   AND lower(btrim(coalesce(a.codigo, ''))) = lower(btrim(coalesce(pa.codart, '')))
  WHERE pa.idplan = p_idplan;
END;
$$;
