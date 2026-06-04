"""Citas hoy/futuras con ticket o factura legacy que bloquean cobro en agenda."""
from __future__ import annotations

import os
import re
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor

ROOT = Path(__file__).resolve().parents[1]
COMPANY = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"


def load_db_url() -> str:
    for line in (ROOT / ".env").read_text(encoding="utf-8").splitlines():
        if line.startswith("SUPABASE_DB_URL="):
            db = line.split("=", 1)[1].strip().strip('"').strip("'")
            return re.sub(r"@([^/:]+):\d+/", "@127.0.0.1:15432/", db)
    raise SystemExit("SUPABASE_DB_URL missing")


def main() -> None:
    conn = psycopg2.connect(load_db_url())
    cur = conn.cursor(cursor_factory=RealDictCursor)

    print("=== Citas >= hoy con ventas completadas (bloquean TPV) ===\n")
    cur.execute(
        """
        SELECT
          a.id,
          COALESCE(a.appointment_date, (a.start_time::date)) AS apt_date,
          a.start_time,
          a.status,
          a.legacy_codcli,
          c.name AS customer_name,
          s.id AS sale_id,
          s.ticket_number,
          s.total_amount,
          s.status AS sale_status,
          s.invoice_id,
          s.notes,
          i.number AS invoice_number
        FROM agenda_appointments a
        JOIN sales s ON s.appointment_id = a.id AND s.status = 'completed'
        LEFT JOIN customers c ON c.id = a.customer_id
        LEFT JOIN invoices i ON i.id = s.invoice_id
        WHERE a.company_id = %s
          AND COALESCE(a.appointment_date, a.start_time::date) >= CURRENT_DATE
        ORDER BY apt_date, a.start_time
        LIMIT 40
        """,
        (COMPANY,),
    )
    rows = cur.fetchall()
    print(f"Encontradas: {len(rows)} (muestra max 40)\n")
    for r in rows:
        notes = (r.get("notes") or "")[:80]
        print(
            f"{r['apt_date']} {str(r['start_time'])[11:16]} | {r['customer_name'] or '?'} | "
            f"ticket {r['ticket_number']} {r['total_amount']}€ | inv={r['invoice_number'] or '—'} | {notes}"
        )

    cur.execute(
        """
        SELECT COUNT(*)::int AS c
        FROM agenda_appointments a
        JOIN sales s ON s.appointment_id = a.id AND s.status = 'completed'
        WHERE a.company_id = %s
          AND COALESCE(a.appointment_date, a.start_time::date) >= CURRENT_DATE
        """,
        (COMPANY,),
    )
    total = cur.fetchone()["c"]
    print(f"\nTotal citas futuras/hoy con ticket completado: {total}")

    cur.execute(
        """
        SELECT COUNT(*)::int AS c
        FROM agenda_appointments a
        JOIN sales s ON s.appointment_id = a.id AND s.status = 'completed' AND s.invoice_id IS NOT NULL
        WHERE a.company_id = %s
          AND COALESCE(a.appointment_date, a.start_time::date) >= CURRENT_DATE
        """,
        (COMPANY,),
    )
    print(f"Con factura vinculada: {cur.fetchone()['c']}")

    print("\n=== Tickets LEG-* en citas futuras (import legacy) ===\n")
    cur.execute(
        """
        SELECT COUNT(*)::int c,
               COUNT(*) FILTER (WHERE s.ticket_number LIKE 'LEG-%%')::int leg
        FROM agenda_appointments a
        JOIN sales s ON s.appointment_id = a.id
        WHERE a.company_id = %s
          AND COALESCE(a.appointment_date, a.start_time::date) >= CURRENT_DATE
        """,
        (COMPANY,),
    )
    print(dict(cur.fetchone()))

    print("\n=== Citas HOY con ticket (bloquean cobro/factura en agenda) ===\n")
    cur.execute(
        """
        SELECT
          a.id,
          COALESCE(a.appointment_date, a.start_time::date) AS d,
          substring(a.start_time::text, 12, 5) AS hora,
          c.name,
          s.ticket_number,
          s.total_amount,
          s.invoice_id IS NOT NULL AS tiene_factura
        FROM agenda_appointments a
        JOIN sales s ON s.appointment_id = a.id AND s.status = 'completed'
        LEFT JOIN customers c ON c.id = a.customer_id
        WHERE a.company_id = %s
          AND COALESCE(a.appointment_date, a.start_time::date) = CURRENT_DATE
        ORDER BY hora
        """,
        (COMPANY,),
    )
    for r in cur.fetchall():
        print(r)

    print("\n=== Próximos 14 días: citas con ticket LEG (import erróneo) ===\n")
    cur.execute(
        """
        SELECT COUNT(*)::int
        FROM agenda_appointments a
        JOIN sales s ON s.appointment_id = a.id
        WHERE a.company_id = %s
          AND COALESCE(a.appointment_date, a.start_time::date) BETWEEN CURRENT_DATE AND CURRENT_DATE + 14
          AND s.ticket_number LIKE 'LEG-%%'
        """,
        (COMPANY,),
    )
    print("Total:", cur.fetchone())

    print("\n=== Ventas completadas sin cita pero misma fecha/cliente (posible cruce) ===\n")
    cur.execute(
        """
        SELECT COUNT(*)::int
        FROM sales s
        WHERE s.company_id = %s
          AND s.status = 'completed'
          AND s.appointment_id IS NULL
          AND s.created_at::date >= CURRENT_DATE - 7
        """,
        (COMPANY,),
    )
    print("Tickets TPV sin appointment_id (última semana):", cur.fetchone())

    conn.close()


if __name__ == "__main__":
    main()
