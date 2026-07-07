#!/usr/bin/env python3
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

print("=== style_sync_cursor ciecab ===")
cur.execute(
    """
  SELECT company_id, tabla, enabled, dbf_baseline_seeded, updated_at
  FROM dunasoft.style_sync_cursor WHERE tabla = 'ciecab'
"""
)
for r in cur.fetchall():
    print(dict(r))

print("\n=== cash_register_sessions ultimos 12 dias ===")
cur.execute(
    """
  SELECT session_date, status, opening_cash, expected_cash, expected_card,
         counted_cash, counted_card, closing_cash, notes, updated_at
  FROM public.cash_register_sessions
  ORDER BY session_date DESC LIMIT 12
"""
)
for r in cur.fetchall():
    print(dict(r))

print("\n=== style_sync_entity_map cash_session recientes ===")
cur.execute(
    """
  SELECT style_key, suite_id, sync_version, updated_at
  FROM dunasoft.style_sync_entity_map
  WHERE entity_type = 'cash_session'
  ORDER BY updated_at DESC LIMIT 10
"""
)
for r in cur.fetchall():
    print(dict(r))

print("\n=== legacy.ciecab ultimos 10 ===")
cur.execute(
    """
  SELECT numcie, feccie, impcie, cerrado, obscie
  FROM legacy.ciecab
  WHERE NULLIF(btrim(feccie),'') IS NOT NULL
  ORDER BY feccie DESC LIMIT 10
"""
)
for r in cur.fetchall():
    print(dict(r))

print("\n=== cieentsal agregado desde 2026-06-25 ===")
cur.execute(
    """
  SELECT c.feccie, c.numcie, c.impcie,
    COALESCE(SUM(CASE WHEN e.tipdoc='E' AND UPPER(e.forpag) LIKE '%EFECT%'
      THEN e.impdoc::numeric ELSE 0 END),0) cash_e,
    COALESCE(SUM(CASE WHEN e.tipdoc='E' AND UPPER(e.forpag) LIKE '%TARJ%'
      THEN e.impdoc::numeric ELSE 0 END),0) card_e
  FROM legacy.ciecab c
  LEFT JOIN legacy.cieentsal e ON e.numcie = c.numcie
  WHERE c.feccie >= '2026-06-25'
  GROUP BY c.feccie, c.numcie, c.impcie
  ORDER BY c.feccie DESC LIMIT 12
"""
)
for r in cur.fetchall():
    print(dict(r))

print("\n=== ventas completadas ultimos dias ===")
cur.execute(
    """
  SELECT created_at::date AS d, count(*)::int n, sum(total_amount)::numeric total
  FROM public.sales
  WHERE status = 'completed' AND created_at::date >= current_date - 12
  GROUP BY 1 ORDER BY 1 DESC
"""
)
for r in cur.fetchall():
    print(dict(r))

conn.close()
