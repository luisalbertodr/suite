#!/usr/bin/env python3
"""Fusiona clientes duplicados por nombre dentro de una empresa.

Regla: dentro de un mismo nombre normalizado, si hay exactamente un cliente con
legacy_codcli y uno o varios sin codigo, se conserva el que tiene codigo (winner)
y se le anexan los datos del resto (losers): se reasignan todas las referencias
(customer_id) y se rellenan los campos vacios del winner. Luego se borra el loser.

Por defecto ejecuta dry-run. Para escribir hay que pasar --apply.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
from pathlib import Path
from typing import Any

try:
    import psycopg2
    import psycopg2.extras
    from psycopg2 import errors
except Exception as exc:  # pragma: no cover
    print(f"No se pudo importar psycopg2: {exc}", file=sys.stderr)
    sys.exit(2)


DEFAULT_COMPANY_ID = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"  # Maria del Mar Lamas Pernas
DEFAULT_REPORT = Path("tmp/merge_duplicate_customers_report.json")

# Campos de customers que se rellenan en el winner solo si estan vacios.
TEXT_FIELDS = [
    "tax_id",
    "email",
    "phone",
    "phone_home",
    "phone_mobile",
    "address_street",
    "address_city",
    "address_state",
    "address_postal_code",
    "address_country",
    "contact_person",
    "iban_account",
    "photo_url",
    "intracomunitario",
    "dunasoft_codcli",
]
PHONE_FIELDS = {"phone", "phone_home", "phone_mobile"}
NUMERIC_FIELDS = ["credit_limit", "re_percentage", "irpf_percentage", "payment_terms"]
DATE_FIELDS = ["birth_date"]
SELECT_COLUMNS = (
    ["id", "company_id", "name", "legacy_codcli", "notes"]
    + TEXT_FIELDS
    + NUMERIC_FIELDS
    + DATE_FIELDS
)


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def normalize_name(value: str) -> str:
    value = unicodedata.normalize("NFKD", value or "")
    value = "".join(ch for ch in value if not unicodedata.combining(ch))
    value = re.sub(r"[^0-9A-Za-zñÑ]+", " ", value).lower().strip()
    return re.sub(r"\s+", " ", value)


def has_value(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, str):
        return value.strip() != ""
    return True


def fk_tables(cur: Any) -> list[tuple[str, str]]:
    cur.execute(
        """
        SELECT tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
        JOIN information_schema.referential_constraints rc
          ON tc.constraint_name = rc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_name = 'customers'
          AND ccu.column_name = 'id'
          AND tc.table_schema = 'public'
        ORDER BY tc.table_name, kcu.column_name
        """
    )
    return [(row["table_name"], row["column_name"]) for row in cur.fetchall()]


def load_customers(cur: Any, company_id: str | None) -> list[dict[str, Any]]:
    columns = ", ".join(SELECT_COLUMNS)
    if company_id:
        cur.execute(
            f"SELECT {columns} FROM public.customers WHERE company_id = %s",
            (company_id,),
        )
    else:
        cur.execute(f"SELECT {columns} FROM public.customers")
    return [dict(row) for row in cur.fetchall()]


def group_duplicates(customers: list[dict[str, Any]]) -> dict[tuple[str, str], list[dict[str, Any]]]:
    groups: dict[tuple[str, str], list[dict[str, Any]]] = {}
    for customer in customers:
        key = (str(customer["company_id"]), normalize_name(customer["name"]))
        if not key[1]:
            continue
        groups.setdefault(key, []).append(customer)
    return {key: members for key, members in groups.items() if len(members) > 1}


def plan_merges(groups: dict[tuple[str, str], list[dict[str, Any]]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    merges: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []
    for (company_id, norm), members in groups.items():
        with_code = [m for m in members if has_value(m.get("legacy_codcli"))]
        without_code = [m for m in members if not has_value(m.get("legacy_codcli"))]
        sample_name = members[0]["name"]
        if len(with_code) == 1 and without_code:
            merges.append(
                {
                    "company_id": company_id,
                    "normalized_name": norm,
                    "name": sample_name,
                    "winner": with_code[0],
                    "losers": without_code,
                }
            )
        else:
            skipped.append(
                {
                    "company_id": company_id,
                    "name": sample_name,
                    "normalized_name": norm,
                    "reason": "multiple_with_code" if len(with_code) > 1 else "no_code_in_group",
                    "members": [
                        {"id": m["id"], "name": m["name"], "legacy_codcli": m.get("legacy_codcli")}
                        for m in members
                    ],
                }
            )
    merges.sort(key=lambda m: m["name"].lower())
    skipped.sort(key=lambda m: m["name"].lower())
    return merges, skipped


def compute_field_updates(winner: dict[str, Any], loser: dict[str, Any], include_phones: bool) -> dict[str, Any]:
    updates: dict[str, Any] = {}
    for field in TEXT_FIELDS + NUMERIC_FIELDS + DATE_FIELDS:
        if field in PHONE_FIELDS and not include_phones:
            continue
        if not has_value(winner.get(field)) and has_value(loser.get(field)):
            updates[field] = loser.get(field)
    winner_notes = (winner.get("notes") or "").strip()
    loser_notes = (loser.get("notes") or "").strip()
    if loser_notes and loser_notes not in winner_notes:
        merged_notes = f"{winner_notes}\n{loser_notes}".strip() if winner_notes else loser_notes
        updates["notes"] = merged_notes
    return updates


def reassign_and_delete(
    cur: Any,
    fks: list[tuple[str, str]],
    winner_id: str,
    loser: dict[str, Any],
    include_phones: bool,
) -> dict[str, Any]:
    loser_id = loser["id"]
    moved: dict[str, int] = {}
    for table, column in fks:
        cur.execute(
            f"UPDATE public.{table} SET {column} = %s WHERE {column} = %s",
            (winner_id, loser_id),
        )
        if cur.rowcount:
            moved[table] = cur.rowcount

    cur.execute("DELETE FROM public.customers WHERE id = %s", (loser_id,))

    field_updates = compute_field_updates_from_db(cur, winner_id, loser, include_phones)
    if field_updates:
        assignments = ", ".join(f"{field} = %({field})s" for field in field_updates)
        cur.execute(
            f"UPDATE public.customers SET {assignments} WHERE id = %(winner_id)s",
            {**field_updates, "winner_id": winner_id},
        )
    return {"moved": moved, "field_updates": list(field_updates.keys())}


def compute_field_updates_from_db(cur: Any, winner_id: str, loser: dict[str, Any], include_phones: bool) -> dict[str, Any]:
    columns = ", ".join(SELECT_COLUMNS)
    cur.execute(f"SELECT {columns} FROM public.customers WHERE id = %s", (winner_id,))
    winner = dict(cur.fetchone())
    return compute_field_updates(winner, loser, include_phones)


def load_customer_by_id(cur: Any, customer_id: str) -> dict[str, Any] | None:
    columns = ", ".join(SELECT_COLUMNS)
    cur.execute(f"SELECT {columns} FROM public.customers WHERE id = %s", (customer_id,))
    row = cur.fetchone()
    return dict(row) if row else None


def build_manual_merges(cur: Any, winner_id: str, loser_ids: list[str]) -> list[dict[str, Any]]:
    winner = load_customer_by_id(cur, winner_id)
    if not winner:
        raise SystemExit(f"No existe el cliente winner: {winner_id}")
    losers = []
    for loser_id in loser_ids:
        loser = load_customer_by_id(cur, loser_id)
        if not loser:
            raise SystemExit(f"No existe el cliente loser: {loser_id}")
        losers.append(loser)
    return [{"name": winner["name"], "winner": winner, "losers": losers}]


def run(args: argparse.Namespace) -> dict[str, Any]:
    conn = psycopg2.connect(args.database_url)
    conn.autocommit = False
    report: dict[str, Any] = {
        "apply": args.apply,
        "company_id": args.company_id,
        "groups_merged": 0,
        "customers_deleted": 0,
        "merges": [],
        "skipped_groups": [],
        "errors": [],
    }
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            fks = fk_tables(cur)
            report["fk_tables"] = [f"{t}.{c}" for t, c in fks]
            if args.winner_id:
                report["mode"] = "manual"
                merges = build_manual_merges(cur, args.winner_id, args.loser_ids)
                skipped: list[dict[str, Any]] = []
                report["customers_loaded"] = 1 + len(args.loser_ids)
            else:
                customers = load_customers(cur, args.company_id)
                report["customers_loaded"] = len(customers)
                groups = group_duplicates(customers)
                merges, skipped = plan_merges(groups)
            report["skipped_groups"] = skipped

            for merge in merges:
                winner = merge["winner"]
                merge_entry: dict[str, Any] = {
                    "name": merge["name"],
                    "winner": {
                        "id": winner["id"],
                        "name": winner["name"],
                        "legacy_codcli": winner.get("legacy_codcli"),
                    },
                    "losers": [],
                }
                for loser in merge["losers"]:
                    loser_entry = {
                        "id": loser["id"],
                        "name": loser["name"],
                    }
                    if args.apply:
                        cur.execute("SAVEPOINT sp_merge")
                        try:
                            result = reassign_and_delete(cur, fks, winner["id"], loser, include_phones=True)
                            cur.execute("RELEASE SAVEPOINT sp_merge")
                        except errors.UniqueViolation:
                            cur.execute("ROLLBACK TO SAVEPOINT sp_merge")
                            try:
                                result = reassign_and_delete(cur, fks, winner["id"], loser, include_phones=False)
                                cur.execute("RELEASE SAVEPOINT sp_merge")
                                result["phones_skipped"] = True
                            except Exception as exc:  # noqa: BLE001
                                cur.execute("ROLLBACK TO SAVEPOINT sp_merge")
                                report["errors"].append(
                                    {"winner": winner["id"], "loser": loser["id"], "error": str(exc)}
                                )
                                loser_entry["error"] = str(exc)
                                merge_entry["losers"].append(loser_entry)
                                continue
                        except Exception as exc:  # noqa: BLE001
                            cur.execute("ROLLBACK TO SAVEPOINT sp_merge")
                            report["errors"].append(
                                {"winner": winner["id"], "loser": loser["id"], "error": str(exc)}
                            )
                            loser_entry["error"] = str(exc)
                            merge_entry["losers"].append(loser_entry)
                            continue
                        loser_entry.update(result)
                        report["customers_deleted"] += 1
                    else:
                        loser_entry["field_updates_preview"] = list(
                            compute_field_updates(winner, loser, include_phones=True).keys()
                        )
                    merge_entry["losers"].append(loser_entry)

                report["merges"].append(merge_entry)
                report["groups_merged"] += 1

            if args.apply and not report["errors"]:
                conn.commit()
            elif args.apply:
                # Hubo errores aislados por savepoint; los merges correctos ya estan
                # confirmados con RELEASE, asi que confirmamos lo bueno.
                conn.commit()
            else:
                conn.rollback()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return report


def main() -> int:
    load_dotenv(Path(".env"))
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--company-id", default=DEFAULT_COMPANY_ID)
    parser.add_argument("--all-companies", action="store_true", help="Procesa todas las empresas.")
    parser.add_argument("--database-url", default=os.environ.get("SUPABASE_DB_URL"))
    parser.add_argument("--report", type=Path, default=DEFAULT_REPORT)
    parser.add_argument("--winner-id", default=None, help="Merge manual: id del cliente a conservar.")
    parser.add_argument(
        "--loser-ids",
        default="",
        help="Merge manual: ids (separados por coma) a fusionar en el winner.",
    )
    parser.add_argument("--apply", action="store_true", help="Escribe cambios. Sin el flag solo dry-run.")
    args = parser.parse_args()

    args.loser_ids = [x.strip() for x in str(args.loser_ids).split(",") if x.strip()]
    if args.winner_id and not args.loser_ids:
        print("Con --winner-id hay que indicar --loser-ids.", file=sys.stderr)
        return 2
    if args.all_companies:
        args.company_id = None
    if not args.database_url:
        print("Falta --database-url o SUPABASE_DB_URL en .env", file=sys.stderr)
        return 2

    report = run(args)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    print(
        "apply" if args.apply else "dry-run",
        f"empresa={'TODAS' if args.company_id is None else args.company_id}",
        f"clientes={report.get('customers_loaded')}",
        f"grupos_fusion={report['groups_merged']}",
        f"borrados={report['customers_deleted']}",
        f"saltados={len(report['skipped_groups'])}",
        f"errores={len(report['errors'])}",
        f"reporte={args.report}",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
