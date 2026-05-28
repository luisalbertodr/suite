"""Diagnóstico rápido de señales de cobro legacy para citas importadas."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor

ROOT = Path(__file__).resolve().parents[1]
env = ROOT / ".env"
if env.is_file():
    for line in env.read_text(encoding="utf-8").splitlines():
        if line.startswith("SUPABASE_DB_URL="):
            os.environ.setdefault("SUPABASE_DB_URL", line.split("=", 1)[1].strip().strip('"'))

from legacy_company import get_company_id  # noqa: E402

cid = get_company_id()
conn = psycopg2.connect(os.environ["SUPABASE_DB_URL"])
cur = conn.cursor(cursor_factory=RealDictCursor)

cur.execute(
    """
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='agenda_appointments' AND column_name LIKE 'legacy%%'
    """
)
print("apt legacy cols:", [r["column_name"] for r in cur.fetchall()])

cur.execute("SELECT COUNT(*) c FROM agenda_appointments WHERE company_id=%s", (cid,))
print("total appts:", cur.fetchone()["c"])

cur.execute(
    "SELECT COUNT(*) c FROM agenda_appointments WHERE company_id=%s AND legacy_planinc_id IS NOT NULL",
    (cid,),
)
print("with legacy_planinc_id:", cur.fetchone()["c"])

cur.execute(
    """
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='agenda_appointments' AND column_name='legacy_idplan'
    """
)
if cur.fetchone():
    cur.execute(
        """
        SELECT COUNT(*) c FROM agenda_appointments
        WHERE company_id=%s AND NULLIF(btrim(legacy_idplan::text), '') IS NOT NULL
        """,
        (cid,),
    )
    print("with legacy_idplan:", cur.fetchone()["c"])

cur.execute(
    "SELECT status, COUNT(*) c FROM agenda_appointments WHERE company_id=%s GROUP BY status ORDER BY c DESC",
    (cid,),
)
print("by status:", cur.fetchall())

cur.execute("SELECT to_regclass('legacy.agenda') t")
if cur.fetchone()["t"]:
    cur.execute(
        """
        SELECT COUNT(*) c FROM legacy.agenda
        WHERE upper(btrim(coalesce(facturado::text, ''))) IN ('S','SI','1','T','TRUE','Y','YES','X')
        """
    )
    print("agenda facturado count:", cur.fetchone()["c"])
    cur.execute(
        "SELECT facturado, COUNT(*) c FROM legacy.agenda GROUP BY facturado ORDER BY c DESC LIMIT 10"
    )
    print("agenda facturado values:", cur.fetchall())

    cur.execute(
        """
        SELECT COUNT(*) c FROM agenda_appointments a
        JOIN legacy.agenda g ON g.idplan = a.legacy_idplan::text
        WHERE a.company_id=%s
          AND upper(btrim(coalesce(g.facturado::text, ''))) IN ('S','SI','1','T','TRUE','Y','YES','X')
        """,
        (cid,),
    )
    try:
        print("appts join agenda facturado via legacy_idplan:", cur.fetchone()["c"])
    except Exception as exc:
        print("join legacy_idplan failed:", exc)

    cur.execute(
        """
        SELECT COUNT(*) c FROM agenda_appointments a
        JOIN legacy.agenda g ON g.idplan = a.legacy_planinc_id::text
        WHERE a.company_id=%s
          AND upper(btrim(coalesce(g.facturado::text, ''))) IN ('S','SI','1','T','TRUE','Y','YES','X')
        """,
        (cid,),
    )
    try:
        print("appts join agenda facturado via legacy_planinc_id:", cur.fetchone()["c"])
    except Exception as exc:
        print("join legacy_planinc_id failed:", exc)

cur.execute("SELECT to_regclass('legacy.albcab') t")
if cur.fetchone()["t"]:
    cur.execute(
        """
        SELECT COUNT(*) c FROM legacy.albcab
        WHERE (total IS NOT NULL AND total::numeric > 0)
           OR (impcob IS NOT NULL AND impcob::numeric > 0)
        """
    )
    print("albcab with amount:", cur.fetchone()["c"])

cur.execute(
    "SELECT COUNT(*) c FROM sales WHERE company_id=%s AND appointment_id IS NOT NULL",
    (cid,),
)
print("existing sales with appointment_id:", cur.fetchone()["c"])

cur.execute(
    """
    SELECT COUNT(*) c FROM appointment_items ai
    JOIN agenda_appointments a ON a.id = ai.appointment_id
    WHERE a.company_id=%s AND ai.notes LIKE '__pricing__%%'
    """,
    (cid,),
)
print("items with pricing:", cur.fetchone()["c"])

cur.execute("SELECT COUNT(*) c FROM legacy.agenda")
print("legacy.agenda rows:", cur.fetchone()["c"])

cur.execute("SELECT COUNT(*) c FROM legacy.planinc")
print("legacy.planinc rows:", cur.fetchone()["c"])

cur.execute(
    """
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='legacy' AND table_name='planinc'
      AND (column_name ILIKE '%%fact%%' OR column_name ILIKE '%%cob%%' OR column_name ILIKE '%%pag%%')
    """
)
print("planinc payment-ish cols:", [r["column_name"] for r in cur.fetchall()])

cur.execute(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='legacy' AND table_name='agenda' ORDER BY ordinal_position"
)
print("agenda cols:", [r["column_name"] for r in cur.fetchall()])

cur.execute(
    """
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='legacy' AND table_name='planinc' ORDER BY ordinal_position
    """
)
planinc_cols = [r["column_name"] for r in cur.fetchall()]
print("planinc cols count:", len(planinc_cols))
print(
    "planinc interesting:",
    [c for c in planinc_cols if any(x in c.lower() for x in ("fact", "cob", "pag", "tip", "est", "anul", "borr"))],
)

cur.execute(
    """
    SELECT tipinc, COUNT(*) c FROM legacy.planinc
    GROUP BY tipinc ORDER BY c DESC LIMIT 15
    """
)
print("planinc TIPINC distribution:", cur.fetchall())

# fallback candidates (fecha desde substring por datos legacy inconsistentes)
cur.execute(
    """
    SELECT COUNT(*) c FROM agenda_appointments a
    WHERE a.company_id=%s AND a.status='confirmed'
      AND left(a.start_time::text, 10) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      AND left(a.start_time::text, 10)::date < CURRENT_DATE
      AND EXISTS (
        SELECT 1 FROM appointment_items ai
        WHERE ai.appointment_id = a.id AND ai.notes LIKE '__pricing__%%'
      )
    """,
    (cid,),
)
print("confirmed past with priced items (fallback candidates):", cur.fetchone()["c"])

cur.execute(
    """
    SELECT left(start_time::text, 19) AS sample, COUNT(*) c
    FROM agenda_appointments WHERE company_id=%s
    GROUP BY 1 ORDER BY c DESC LIMIT 10
    """,
    (cid,),
)
print("start_time samples:", cur.fetchall())

cur.execute(
    """
    SELECT COUNT(*) c FROM agenda_appointments
    WHERE company_id=%s AND left(start_time::text, 10) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    """,
    (cid,),
)
print("appts with ISO date prefix:", cur.fetchone()["c"])

cur.execute(
    """
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='agenda_appointments' AND column_name='appointment_date'
    """
)
if cur.fetchone():
    cur.execute(
        """
        SELECT COUNT(*) c FROM agenda_appointments
        WHERE company_id=%s AND appointment_date IS NOT NULL
        """,
        (cid,),
    )
    print("appts with appointment_date:", cur.fetchone()["c"])
    cur.execute(
        """
        SELECT COUNT(*) c FROM agenda_appointments a
        WHERE a.company_id=%s AND a.status='confirmed'
          AND a.appointment_date IS NOT NULL
          AND a.appointment_date < CURRENT_DATE
          AND EXISTS (
            SELECT 1 FROM appointment_items ai
            WHERE ai.appointment_id = a.id AND ai.notes LIKE '__pricing__%%'
          )
        """,
        (cid,),
    )
    cur.execute("SELECT to_regclass('legacy.faccab') t")
if cur.fetchone()["t"]:
    cur.execute("SELECT COUNT(*) c FROM legacy.faccab")
    print("faccab rows:", cur.fetchone()["c"])
    cur.execute(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_schema='legacy' AND table_name='faccab'
          AND column_name IN ('codcli','fecha','fecfac','total','imptot')
        """
    )
    print("faccab key cols:", [r["column_name"] for r in cur.fetchall()])
    cur.execute(
        """
        SELECT COUNT(*) c FROM agenda_appointments a
        JOIN legacy.faccab f ON btrim(f.codcli::text) = btrim(a.legacy_codcli::text)
          AND f.fecfac::date = a.appointment_date
        WHERE a.company_id=%s
        """,
        (cid,),
    )
    print("appts join faccab exact codcli+date:", cur.fetchone()["c"])
