-- Bundle de citas Dunasoft por día: plan2009 + planart + descripciones en una sola llamada.
CREATE OR REPLACE FUNCTION public.agenda_dunasoft_day_bundle(p_date date)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
  WITH day_plans AS (
    SELECT
      p._row_id,
      p.idplan,
      p.codemp,
      p.codcli,
      p.fecha,
      p.horini,
      p.horfin,
      p.texto,
      p.nomcli,
      p.tel1cli,
      p.colfon,
      p.collet,
      p.facturado,
      p.codrec
    FROM dunasoft.plan2009 p
    WHERE p.fecha = p_date
  )
  SELECT jsonb_build_object(
    'plans',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            '_row_id', dp._row_id,
            'idplan', dp.idplan,
            'codemp', dp.codemp,
            'codcli', dp.codcli,
            'fecha', dp.fecha,
            'horini', dp.horini,
            'horfin', dp.horfin,
            'texto', dp.texto,
            'nomcli', dp.nomcli,
            'tel1cli', dp.tel1cli,
            'colfon', dp.colfon,
            'collet', dp.collet,
            'facturado', dp.facturado,
            'codrec', dp.codrec
          )
        )
        FROM day_plans dp
      ),
      '[]'::jsonb
    ),
    'planart',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'idplan', pa.idplan,
            'codart', pa.codart,
            'hora', pa.hora,
            'desart', a.desart
          )
        )
        FROM dunasoft.planart pa
        INNER JOIN day_plans dp ON dp.idplan = pa.idplan
        LEFT JOIN dunasoft.articulos a ON btrim(a.codart) = btrim(pa.codart)
      ),
      '[]'::jsonb
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.agenda_dunasoft_day_bundle(date) TO authenticated;
