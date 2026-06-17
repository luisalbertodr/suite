-- Fix: style_reservas_parse_servicios usaba v_line ~ '^\[' que en PG se interpreta
-- como clase de caracteres inválida → "brackets [] not balanced" con cualquier servicio.

CREATE OR REPLACE FUNCTION dunasoft.style_reservas_parse_servicios(
  p_servicios text,
  p_idplan numeric,
  p_horini text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_line text;
  v_codart text;
  v_hora text;
  v_match text[];
BEGIN
  DELETE FROM dunasoft.planart WHERE idplan = p_idplan;
  IF coalesce(btrim(p_servicios), '') = '' THEN
    RETURN;
  END IF;

  FOR v_line IN
    SELECT btrim(x) FROM unnest(regexp_split_to_array(p_servicios, E'[\\r\\n]+')) AS x
    WHERE btrim(x) <> ''
  LOOP
    IF left(v_line, 1) = '[' THEN
      v_match := regexp_match(v_line, '^\[([^\]]+)\]');
      v_hora := coalesce(v_match[1], coalesce(nullif(btrim(p_horini), ''), '09:00'));
      v_codart := btrim(split_part(regexp_replace(v_line, '^\[[^\]]+\]\s*', ''), '-', 1));
    ELSE
      IF length(v_line) >= 10 THEN
        v_codart := btrim(left(v_line, length(v_line) - 5));
        v_hora := btrim(right(v_line, 5));
      ELSE
        v_codart := btrim(v_line);
        v_hora := coalesce(nullif(btrim(p_horini), ''), '09:00');
      END IF;
    END IF;
    IF btrim(v_codart) = '' THEN
      CONTINUE;
    END IF;
    INSERT INTO dunasoft.planart (idplan, codart, hora, enviar, artcom, artcomrel)
    VALUES (
      p_idplan,
      btrim(v_codart),
      coalesce(nullif(btrim(v_hora), ''), p_horini),
      false,
      false,
      0
    );
  END LOOP;
END;
$$;
