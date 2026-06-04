#!/usr/bin/env python3
"""
Importa cierres diarios Dunasoft (legacy.ciecab + legacy.cieentsal) a cash_register_*.

Idempotente por session_date + notas 'Dunasoft cierre numcie=…'.
No importa feccie >= --no-auto-from (por defecto hoy: cierre manual en Suite).

Uso:
  python scripts/promote_legacy_cash_register.py --dry-run
  python scripts/promote_legacy_cash_register.py --apply
"""
from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor

from legacy_billing_common import default_no_auto_from, load_dotenv, norm_date
from legacy_company import MEDICINA_COMPANY_ID, get_company_id

ROOT = Path(__file__).resolve().parents[1]
NOTE_PREFIX = "Dunasoft cierre numcie="


def money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def note_marker(numcie: str) -> str:
    return f"{NOTE_PREFIX}{numcie}"


def build_session_amounts(
    *,
    profile: str,
    opening: Decimal,
    closing: Decimal,
    agg: dict,
) -> dict[str, float]:
    """
    estetica: cierre físico en efectivo; tarjeta en campo aparte si hay movimientos E.
    medicina: efectivo unificado (impcie); tarjeta contabilizada solo en expected/counted_card.
    """
    withdrawn = agg["s_cash"]
    e_cash = agg["e_cash"]
    a_cash = agg["a_cash"]
    e_card = agg["e_card"]
    s_card = agg["s_card"]

    if profile == "medicina":
        expected_cash = opening + e_cash + a_cash - withdrawn
        expected_card = e_card + s_card
        counted_cash = closing
        counted_card = expected_card
        closing_cash = closing
        cash_difference = counted_cash - expected_cash
        card_difference = Decimal("0")
    else:
        expected_cash = e_cash + a_cash
        expected_card = e_card
        counted_cash = closing
        counted_card = e_card
        closing_cash = closing
        cash_difference = closing - opening - expected_cash + withdrawn
        card_difference = counted_card - expected_card if expected_card else Decimal("0")

    return {
        "opening_cash": float(opening),
        "expected_cash": float(expected_cash),
        "expected_card": float(expected_card),
        "counted_cash": float(counted_cash),
        "counted_card": float(counted_card),
        "withdrawn_cash": float(withdrawn),
        "closing_cash": float(closing_cash),
        "cash_difference": float(cash_difference),
        "card_difference": float(card_difference),
    }


def parse_time(feccie: str, horcie: str | None) -> datetime:
    t = str(horcie or "20:00").strip()[:5]
    if len(t) == 4 and t.isdigit():
        t = f"{t[:2]}:{t[2:]}"
    if ":" not in t:
        t = "20:00"
    return datetime.fromisoformat(f"{feccie}T{t}:00")


def table_columns(cur, schema: str, table: str) -> set[str]:
    cur.execute(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s
        """,
        (schema, table),
    )
    return {r["column_name"] for r in cur.fetchall()}


def fetch_ciecab_rows(cur) -> list[dict]:
    cur.execute("SELECT to_regclass('legacy.ciecab') AS t")
    if not cur.fetchone()["t"]:
        return []
    cur.execute(
        """
        SELECT numcie, feccie, horcie, codemp, impcie, cerrado, obscie
        FROM legacy.ciecab
        WHERE NULLIF(btrim(feccie), '') IS NOT NULL
        ORDER BY feccie ASC, numcie::int ASC
        """
    )
    by_date: dict[str, dict] = {}
    extra_numcies: dict[str, list[str]] = {}
    for row in cur.fetchall():
        feccie = norm_date(row.get("feccie"))
        if not feccie:
            continue
        numcie = str(row.get("numcie") or "").strip()
        prev = by_date.get(feccie)
        if prev:
            extra_numcies.setdefault(feccie, []).append(str(prev.get("numcie") or ""))
            extra_numcies[feccie].append(numcie)
        by_date[feccie] = dict(row)
    out: list[dict] = []
    for feccie in sorted(by_date.keys()):
        cab = by_date[feccie]
        merged = extra_numcies.get(feccie)
        if merged:
            cab = {**cab, "_merged_numcies": ",".join(merged)}
        out.append(cab)
    return out


def aggregate_lines(cur, numcie: str, feccie: str, extra_numcies: list[str] | None = None) -> dict:
    numcies = [numcie] + [n for n in (extra_numcies or []) if n and n != numcie]
    cur.execute(
        """
        SELECT tipdoc, forpag, impdoc::numeric AS imp, desdoc, obsdoc
        FROM legacy.cieentsal
        WHERE numcie = ANY(%s)
           OR (NULLIF(btrim(numcie), '') IS NULL AND fecdoc = %s)
        """,
        (numcies, feccie),
    )
    rows = cur.fetchall()
    out = {
        "e_cash": Decimal("0"),
        "e_card": Decimal("0"),
        "s_cash": Decimal("0"),
        "s_card": Decimal("0"),
        "a_cash": Decimal("0"),
        "movements": [],
    }
    for r in rows:
        imp = money(r.get("imp"))
        tip = str(r.get("tipdoc") or "").strip().upper()
        pay = str(r.get("forpag") or "").strip().upper()
        desc = str(r.get("desdoc") or r.get("obsdoc") or "").strip()[:500]
        if tip == "E" and pay == "EFECTIVO":
            out["e_cash"] += imp
        elif tip == "E" and pay == "TARJETA":
            out["e_card"] += imp
        elif tip == "S" and pay == "EFECTIVO":
            out["s_cash"] += imp
        elif tip == "S" and pay == "TARJETA":
            out["s_card"] += imp
        elif tip == "A" and pay == "EFECTIVO":
            out["a_cash"] += imp
        if tip in ("S", "A") and imp != 0:
            mtype = "withdrawal" if tip == "S" else "cash_in"
            channel = "card" if pay == "TARJETA" else "cash"
            out["movements"].append(
                {"movement_type": mtype, "payment_channel": channel, "amount": imp, "reason": desc or tip}
            )
    return out


def load_existing_by_date(cur, company_id: str) -> dict[str, dict]:
    cur.execute(
        """
        SELECT id, session_date::text AS d, notes
        FROM public.cash_register_sessions
        WHERE company_id = %s AND notes LIKE %s
        """,
        (company_id, f"{NOTE_PREFIX}%"),
    )
    return {str(r["d"]): dict(r) for r in cur.fetchall()}


def main() -> int:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--company-id", default="")
    ap.add_argument(
        "--no-auto-from",
        default="",
        help=f"No importar cierres con feccie >= esta fecha (default: {default_no_auto_from().isoformat()})",
    )
    ap.add_argument(
        "--cash-profile",
        choices=("estetica", "medicina"),
        default="",
        help="medicina: impcie=efectivo unificado; tarjeta solo en expected/counted_card",
    )
    args = ap.parse_args()

    dsn = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not dsn:
        print("Falta SUPABASE_DB_URL", file=sys.stderr)
        return 2

    company_id = (args.company_id or "").strip() or get_company_id()
    no_auto_from = (args.no_auto_from or "").strip() or default_no_auto_from().isoformat()
    profile = (args.cash_profile or "").strip()
    if not profile:
        profile = "medicina" if company_id == MEDICINA_COMPANY_ID else "estetica"
    print(f"Perfil caja: {profile} (company_id={company_id[:8]}…)")

    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT to_regclass('public.cash_register_sessions') AS t")
    if not cur.fetchone()["t"]:
        print("Falta tabla cash_register_sessions (aplica migración 20260603233000).", file=sys.stderr)
        return 2

    sess_cols = table_columns(cur, "public", "cash_register_sessions")
    mov_cols = table_columns(cur, "public", "cash_register_movements")
    ciecab_rows = fetch_ciecab_rows(cur)
    existing = load_existing_by_date(cur, company_id)

    created = updated = skipped_future = skipped = 0
    prev_closing: Decimal | None = None

    for cab in ciecab_rows:
        feccie = norm_date(cab.get("feccie"))
        if not feccie:
            continue
        if feccie >= no_auto_from:
            skipped_future += 1
            continue

        numcie = str(cab.get("numcie") or "").strip()
        merged_raw = str(cab.get("_merged_numcies") or "").strip()
        extra = [n.strip() for n in merged_raw.split(",") if n.strip()] if merged_raw else []
        closing = money(cab.get("impcie"))
        agg = aggregate_lines(cur, numcie, feccie, extra)
        opened_at = parse_time(feccie, cab.get("horcie"))
        closed_at = opened_at
        opening = prev_closing if prev_closing is not None else Decimal("0")
        notes = note_marker(numcie)
        if profile == "medicina":
            notes += " · perfil medicina (efectivo unificado)"
        if merged_raw:
            notes += f" · fusionado {merged_raw}"
        if cab.get("obscie"):
            notes += f" · {str(cab['obscie']).strip()[:200]}"

        amounts = build_session_amounts(
            profile=profile,
            opening=opening,
            closing=closing,
            agg=agg,
        )
        row = {
            "company_id": company_id,
            "session_date": feccie,
            "status": "closed",
            "opened_at": opened_at,
            "closed_at": closed_at,
            "notes": notes,
            **amounts,
        }
        payload = {k: v for k, v in row.items() if k in sess_cols}

        if args.dry_run or not args.apply:
            action = "update" if feccie in existing else "insert"
            print(f"[dry-run] {action} {feccie} numcie={numcie} cierre={closing} movs={len(agg['movements'])}")
            if feccie in existing:
                updated += 1
            else:
                created += 1
            prev_closing = closing
            continue

        session_id = existing.get(feccie, {}).get("id")
        if session_id:
            update_keys = [k for k in payload if k not in ("company_id", "session_date")]
            cur.execute(
                f"""
                UPDATE public.cash_register_sessions
                SET {", ".join(f"{k} = %s" for k in update_keys)}, updated_at = now()
                WHERE id = %s::uuid
                """,
                [payload[k] for k in update_keys] + [session_id],
            )
            cur.execute(
                "DELETE FROM public.cash_register_movements WHERE session_id = %s::uuid",
                (session_id,),
            )
            updated += 1
        else:
            keys = list(payload.keys())
            cur.execute(
                f"""
                INSERT INTO public.cash_register_sessions ({', '.join(keys)})
                VALUES ({', '.join(['%s'] * len(keys))})
                RETURNING id
                """,
                [payload[k] for k in keys],
            )
            session_id = str(cur.fetchone()["id"])
            created += 1

        for mv in agg["movements"]:
            mrow = {
                "session_id": session_id,
                "company_id": company_id,
                "movement_type": mv["movement_type"],
                "payment_channel": mv["payment_channel"],
                "amount": float(mv["amount"]),
                "reason": mv["reason"],
            }
            mpayload = {k: v for k, v in mrow.items() if k in mov_cols}
            keys = list(mpayload.keys())
            cur.execute(
                f"""
                INSERT INTO public.cash_register_movements ({', '.join(keys)})
                VALUES ({', '.join(['%s'] * len(keys))})
                """,
                [mpayload[k] for k in keys],
            )

        prev_closing = closing

    if args.apply:
        conn.commit()
        print(f"OK: sesiones creadas={created} actualizadas={updated}")
    else:
        conn.rollback()
        print(f"Simulación: crear={created} actualizar={updated} (use --apply)")

    print(f"Cierres legacy leídos: {len(ciecab_rows)}")
    print(f"Omitidos (feccie >= {no_auto_from}): {skipped_future}")
    cur.close()
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
