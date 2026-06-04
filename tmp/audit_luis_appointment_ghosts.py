"""Auditar filas 'appointment' en ficha de Luis Alberto Diaz Rodriguez."""
import json
import os

import psycopg2

DB_URL = os.environ.get(
    "SUPABASE_DB_URL",
    "postgresql://postgres:q48Gj6Hw7sP9bQxR2yZ3cT5vU1aF0eL8@192.168.99.110:5433/postgres",
)


def main() -> None:
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute(
        """
        SELECT id, name FROM customers
        WHERE name ILIKE %s
        LIMIT 5
        """,
        ("%Luis Alberto%Diaz%",),
    )
    customers = cur.fetchall()
    print("customers:", customers)
    if not customers:
        return
    cid = customers[0][0]
    print("customer_id:", cid)

    cur.execute(
        """
        SELECT id, event_type, event_date, data
        FROM customer_aesthetic_history
        WHERE customer_id = %s
          AND (event_type ILIKE %s OR LOWER(COALESCE(data->>'appointment_id', '')) <> '')
        ORDER BY event_date DESC NULLS LAST
        LIMIT 30
        """,
        (cid, "%appoint%"),
    )
    print("\n=== aesthetic (appointment-related) ===")
    for row_id, event_type, event_date, data in cur.fetchall():
        payload = data or {}
        print(
            str(row_id)[:8],
            event_type,
            str(event_date)[:10],
            "apt_id=",
            payload.get("appointment_id"),
            "items=",
            len(payload.get("items") or []),
            "treatment=",
            payload.get("treatment"),
            "source=",
            payload.get("source"),
        )

    cur.execute(
        """
        SELECT i.id, i.item_kind, i.title, i.body, i.ref_table, i.ref_id, l.log_date
        FROM daily_customer_log_items i
        JOIN daily_customer_log l ON l.id = i.log_id
        WHERE l.customer_id = %s
        ORDER BY l.log_date DESC, i.sort_order
        LIMIT 40
        """,
        (cid,),
    )
    print("\n=== daily_customer_log_items (recent) ===")
    for row in cur.fetchall():
        iid, kind, title, body, ref_table, ref_id, log_date = row
        label = (title or kind or "").strip().lower()
        if "appoint" in label or kind == "appointment" or ref_table == "agenda_appointments":
            print(
                str(iid)[:8],
                kind,
                repr(title),
                repr((body or "")[:40]),
                ref_table,
                str(ref_id)[:8] if ref_id else None,
                log_date,
            )

    cur.execute(
        """
        SELECT id, title, appointment_date, start_time, status
        FROM agenda_appointments
        WHERE customer_id = %s
        ORDER BY appointment_date DESC NULLS LAST
        LIMIT 15
        """,
        (cid,),
    )
    print("\n=== agenda_appointments ===")
    for row in cur.fetchall():
        print(row[0][:8], repr(row[1]), row[2], str(row[3])[:19], row[4])

    conn.close()


if __name__ == "__main__":
    main()
