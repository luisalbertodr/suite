-- insert_planinc_borrar: 25 columnas planinc pero solo 24 VALUES (faltaba planartx).
-- Provocaba 400 "INSERT has more target columns than expressions" en agenda_dual_delete.

CREATE OR REPLACE FUNCTION dunasoft.insert_planinc_borrar(
  p_idplan numeric,
  p_codusu text,
  p_old jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE v_id bigint := dunasoft.allocate_idplaninc();
BEGIN
  INSERT INTO dunasoft.planinc (
    idplaninc, codusu, fechorinc, tipinc, idplan,
    codemp, codcli, fecha, horini, horfin, texto, codrec, nomcli, tel1cli, planart,
    codempx, codclix, fechax, horinix, horfinx, textox, codrecx, nomclix, tel1clix, planartx
  ) VALUES (
    v_id,
    left(coalesce(nullif(btrim(p_codusu), ''), 'SUITE'), 15),
    now(),
    'BORRAR',
    p_idplan,
    coalesce(p_old->>'codemp', ''),
    coalesce(p_old->>'codcli', '0'),
    (p_old->>'fecha')::date,
    coalesce(p_old->>'horini', ''),
    coalesce(p_old->>'horfin', ''),
    coalesce(p_old->>'texto', ''),
    coalesce(p_old->>'codrec', ''),
    coalesce(p_old->>'nomcli', ''),
    coalesce(p_old->>'tel1cli', ''),
    coalesce(p_old->>'planart_memo', ''),
    '', '0', NULL, '', '', '', '', '', '', ''
  );
  RETURN v_id;
END;
$$;
