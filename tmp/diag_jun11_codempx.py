import os
from pathlib import Path
import psycopg2
from psycopg2.extras import RealDictCursor

ROOT = Path(__file__).resolve().parents[1]
for line in (ROOT / ".env").read_text(encoding="utf-8", errors="replace").splitlines():
    if "=" in line and not line.strip().startswith("#"):
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))

conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute(
    """
    SELECT codemp, codempx, horini, horinix, nomcli, idplan, tipinc, fechax, fecha
    FROM legacy.planinc
    WHERE (fechax::text LIKE '2026-06-11%' OR fecha::text LIKE '2026-06-11%')
    ORDER BY COALESCE(NULLIF(btrim(horinix::text), ''), horini::text)
    """
)
rows = cur.fetchall()
print(f"Filas totales 2026-06-11 en legacy: {len(rows)}")
for r in rows:
    print(
        f"  codemp={r['codemp']!r} codempx={r['codempx']!r} "
        f"{r.get('horinix') or r.get('horini')} {str(r.get('nomcli') or '')[:35]} idplan={r.get('idplan')}"
    )

cur.execute(
    """
    SELECT count(*) AS n FROM legacy.planinc
    WHERE (fechax::text LIKE '2026-06-11%' OR fecha::text LIKE '2026-06-11%')
      AND btrim(coalesce(codempx::text, '')) = '10'
      AND btrim(codemp::text) <> '10'
    """
)
print("Filas con codemp<>10 pero codempx=10:", cur.fetchone()["n"])
conn.close()
