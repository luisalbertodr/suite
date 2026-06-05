"""Diagnóstico deuda Natalia Rodas Moncada — Suite vs legacy."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor

ROOT = Path(__file__).resolve().parents[1]


def load_dotenv() -> None:
    env = ROOT / ".env"
    if not env.is_file():
        return
    for line in env.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))


def main() -> None:
    load_dotenv()
    url = os.environ.get("SUPABASE_DB_URL")
    if not url:
        print("SUPABASE_DB_URL missing", file=sys.stderr)
        sys.exit(1)

    conn = psycopg2.connect(url)
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute(
        """
        SELECT id, name, legacy_codcli, dunasoft_codcli, company_id, phone
        FROM public.customers
        WHERE lower(name) LIKE %s
        ORDER BY name
        """,
        ("%natalia rodas%",),
    )
    customers = cur.fetchall()
    print("=== CUSTOMERS ===")
    for c in customers:
        print(json.dumps({k: str(v) if v is not None else None for k, v in c.items()}, ensure_ascii=False))

    cur.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'legacy' AND table_name = 'clientes'
          AND (column_name ILIKE '%%deu%%' OR column_name ILIKE '%%saldo%%' OR column_name ILIKE '%%pend%%')
        ORDER BY 1
        """
    )
    debt_cols = [r["column_name"] for r in cur.fetchall()]
    print("\nlegacy.clientes debt-related cols:", debt_cols)

    for c in customers:
        cid = c["id"]
        cod = str(c.get("legacy_codcli") or c.get("dunasoft_codcli") or "").strip()
        print(f"\n======== customer {c['name']} ({cid}) codcli={cod} ========")

        cur.execute(
            """
            SELECT number, issue_date, total_amount, status, paid_status, company_id, notes
            FROM public.invoices
            WHERE customer_id = %s
            ORDER BY issue_date DESC NULLS LAST
            LIMIT 30
            """,
            (cid,),
        )
        invs = cur.fetchall()
        print("--- invoices ---")
        for i in invs:
            print(dict(i))
        suite_debt = sum(
            float(i["total_amount"] or 0)
            for i in invs
            if str(i.get("status") or "") == "issued"
            and i.get("paid_status") in (None, False)
        )
        print("Suite UI debt (issued + unpaid):", suite_debt)

        if cod:
            cod_variants = list({cod, cod.lstrip("0") or "0", cod.zfill(6)})
            cur.execute(
                """
                SELECT *
                FROM legacy.clientes
                WHERE trim(codcli) = ANY(%s)
                LIMIT 3
                """,
                (cod_variants,),
            )
            rows = cur.fetchall()
            print("--- legacy.clientes ---")
            for row in rows:
                slim = {k: row[k] for k in debt_cols if k in row}
                slim.update({"codcli": row.get("codcli"), "nomcli": row.get("nomcli")})
                print(slim)

        # faccab / unpaid legacy invoices if table exists
        cur.execute(
            "SELECT to_regclass('legacy.faccab') IS NOT NULL AS has_faccab"
        )
        if cur.fetchone()["has_faccab"] and cod:
            cur.execute(
                """
                SELECT column_name FROM information_schema.columns
                WHERE table_schema='legacy' AND table_name='faccab'
                  AND column_name IN ('codcli','impfac','pendiente','cobrado','estado','numfac')
                """
            )
            fc_cols = {r["column_name"] for r in cur.fetchall()}
            sel = ["codcli"]
            for col in ("numfac", "impfac", "pendiente", "cobrado", "estado", "fecfac"):
                if col in fc_cols or True:
                    pass
            cur.execute(
                """
                SELECT column_name FROM information_schema.columns
                WHERE table_schema='legacy' AND table_name='faccab'
                ORDER BY ordinal_position
                """
            )
            all_fc = [r["column_name"] for r in cur.fetchall()]
            print("legacy.faccab cols sample:", all_fc[:25], "... total", len(all_fc))

            # try common unpaid patterns
            for q, label in [
                (
                    """
                    SELECT numfac, impfac, codcli, fecfac
                    FROM legacy.faccab
                    WHERE trim(codcli) = ANY(%s)
                    ORDER BY fecfac DESC NULLS LAST
                    LIMIT 15
                    """,
                    "faccab rows",
                ),
            ]:
                try:
                    cur.execute(q, (cod_variants,))
                    rows = cur.fetchall()
                    print(f"--- {label} ({len(rows)}) ---")
                    for row in rows:
                        print(dict(row))
                except Exception as e:
                    conn.rollback()
                    print(f"skip {label}:", e)

    conn.close()


if __name__ == "__main__":
    main()
