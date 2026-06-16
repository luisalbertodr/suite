import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
src = (ROOT / "src/lib/consentimientoSeeds/indibaDeepBeauty2024.ts").read_text(encoding="utf-8")
content = re.search(
    r"export const INDIBA_DEEP_BEAUTY_2024_CONTENT = `([\s\S]*?)`;",
    src,
).group(1)

meta = {
    "codigo": "indiba_deep_beauty_2024",
    "tipo": "Radiofrecuencia INDIBA",
    "titulo": "Consentimiento INDIBA® Deep Beauty (2024)",
    "keywords": "indiba,radiofrecuencia,capacitiva,resistiva,448,deep beauty",
    "orden": 10,
}

sql_path = ROOT / "supabase/migrations/20260616120000_consentimiento_indiba_plantilla.sql"
sql_path.write_text(
    f"""-- Metadatos de plantillas + seed INDIBA Deep Beauty 2024 por empresa.

ALTER TABLE public.consentimiento_plantillas
  ADD COLUMN IF NOT EXISTS codigo TEXT,
  ADD COLUMN IF NOT EXISTS keywords TEXT,
  ADD COLUMN IF NOT EXISTS orden INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_consentimiento_plantillas_company_codigo
  ON public.consentimiento_plantillas (company_id, codigo)
  WHERE codigo IS NOT NULL;

INSERT INTO public.consentimiento_plantillas (
  company_id, codigo, tipo, titulo, contenido, keywords, orden, activo, version
)
SELECT
  c.id,
  '{meta["codigo"]}',
  '{meta["tipo"]}',
  '{meta["titulo"]}',
  $indiba${content}$indiba$,
  '{meta["keywords"]}',
  {meta["orden"]},
  true,
  1
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.consentimiento_plantillas p
  WHERE p.company_id = c.id AND p.codigo = '{meta["codigo"]}'
);
""",
    encoding="utf-8",
)
print(f"Wrote {sql_path} ({sql_path.stat().st_size} bytes)")
