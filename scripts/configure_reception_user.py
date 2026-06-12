#!/usr/bin/env python3
"""Configura un usuario de recepción (Medicina + Estética) con permisos por empresa.

Ejemplo (Gemma):
  python scripts/configure_reception_user.py --email gemma@lipoout.com --employee-name Gemma --apply
  python scripts/configure_reception_user.py --email gemma@lipoout.com --dry-run
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

try:
    import psycopg2
    import psycopg2.extras
except Exception as exc:
    print(f"psycopg2 requerido: {exc}", file=sys.stderr)
    sys.exit(2)

ESTETICA = "816af484-92a0-4f65-a5a7-1c907aa4bb3d"  # Delgado Lamas Medicina Estética SL
MEDICINA = "5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4"  # María del Mar Lamas Pernas
RECEPTION_ROLE = "recepcion"

COMMON_ALLOW = [
    ("agenda", "read"),
    ("customers", "read"),
    ("articles", "read"),
    ("sales", "read"),
    ("invoices", "read"),
    ("phone", "read_missed"),
    ("whatsapp", "read"),
]

ESTETICA_ALLOW = COMMON_ALLOW + [("marketing", "read"), ("marketing", "write")]
MEDICINA_ALLOW = COMMON_ALLOW + [("marketing", "read"), ("marketing", "write")]
MEDICINA_DENY: list[tuple[str, str]] = []


def connect():
    url = os.environ.get("SUPABASE_DB_URL")
    if not url:
        print("Falta SUPABASE_DB_URL en .env", file=sys.stderr)
        sys.exit(2)
    return psycopg2.connect(url)


def fetchone(cur, sql, args=()):
    cur.execute(sql, args)
    return cur.fetchone()


def permission_id(cur, resource: str, action: str) -> str | None:
    row = fetchone(
        cur,
        "SELECT id FROM public.permissions WHERE resource = %s AND action = %s",
        (resource, action),
    )
    return str(row[0]) if row else None


def ensure_role(cur, company_id: str, user_id: str, apply: bool) -> None:
    row = fetchone(
        cur,
        """
        SELECT r.id FROM public.roles r WHERE r.name = %s
        """,
        (RECEPTION_ROLE,),
    )
    if not row:
        raise RuntimeError(f"Rol {RECEPTION_ROLE} no existe. Aplica la migración 20260604150000.")
    role_id = row[0]
    exists = fetchone(
        cur,
        """
        SELECT 1 FROM public.user_company_roles
        WHERE user_id = %s AND company_id = %s
        """,
        (user_id, company_id),
    )
    if exists:
        if apply:
            cur.execute(
                """
                UPDATE public.user_company_roles SET role_id = %s
                WHERE user_id = %s AND company_id = %s
                """,
                (role_id, user_id, company_id),
            )
        return
    if apply:
        cur.execute(
            """
            INSERT INTO public.user_company_roles (user_id, company_id, role_id)
            VALUES (%s, %s, %s)
            ON CONFLICT DO NOTHING
            """,
            (user_id, company_id, role_id),
        )


def upsert_profile(cur, user_id: str, company_id: str, employee_id: str | None, apply: bool) -> None:
    if not apply:
        return
    cur.execute(
        """
        INSERT INTO public.user_profiles (user_id, company_id, employee_id, updated_at)
        VALUES (%s, %s, %s, now())
        ON CONFLICT (company_id, user_id) DO UPDATE
        SET employee_id = EXCLUDED.employee_id,
            updated_at = now()
        """,
        (user_id, company_id, employee_id),
    )


def set_override(
    cur,
    user_id: str,
    company_id: str,
    resource: str,
    action: str,
    mode: str,
    apply: bool,
) -> None:
    pid = permission_id(cur, resource, action)
    if not pid:
        print(f"  AVISO: permiso {resource}:{action} no existe en BD", file=sys.stderr)
        return
    if not apply:
        return
    cur.execute(
        """
        DELETE FROM public.user_permission_overrides
        WHERE user_id = %s AND company_id = %s AND permission_id = %s
        """,
        (user_id, company_id, pid),
    )
    cur.execute(
        """
        INSERT INTO public.user_permission_overrides (
          user_id, company_id, permission_id, resource, action, mode, reason
        ) VALUES (%s, %s, %s, NULL, NULL, %s, %s)
        """,
        (
            user_id,
            company_id,
            pid,
            mode,
            "configure_reception_user.py",
        ),
    )


def apply_company_preset(
    cur,
    user_id: str,
    company_id: str,
    allows: list[tuple[str, str]],
    denies: list[tuple[str, str]],
    apply: bool,
) -> None:
    ensure_role(cur, company_id, user_id, apply)
    for resource, action in allows:
        set_override(cur, user_id, company_id, resource, action, "allow", apply)
    for resource, action in denies:
        set_override(cur, user_id, company_id, resource, action, "deny", apply)


def find_user_id(cur, email: str) -> str:
    row = fetchone(
        cur,
        "SELECT id FROM auth.users WHERE lower(email) = lower(%s)",
        (email.strip(),),
    )
    if not row:
        raise RuntimeError(f"Usuario no encontrado: {email}")
    return str(row[0])


def find_employee_id(cur, name: str, company_id: str) -> str | None:
    row = fetchone(
        cur,
        """
        SELECT id FROM public.agenda_employees
        WHERE company_id = %s AND name ILIKE %s
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 1
        """,
        (company_id, f"%{name}%"),
    )
    return str(row[0]) if row else None


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email", required=True, help="Email del usuario (auth.users)")
    parser.add_argument("--employee-name", default="Gemma", help="Nombre del empleado en agenda")
    parser.add_argument("--profile-company", default=ESTETICA, choices=[ESTETICA, MEDICINA])
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--report",
        default="tmp/configure_reception_user_report.json",
    )
    args = parser.parse_args()
    apply = args.apply and not args.dry_run

    conn = connect()
    report: dict = {"email": args.email, "apply": apply, "steps": []}

    try:
        with conn:
            with conn.cursor() as cur:
                user_id = find_user_id(cur, args.email)
                employee_id = find_employee_id(cur, args.employee_name, args.profile_company)
                report["user_id"] = user_id
                report["employee_id"] = employee_id

                if not employee_id:
                    report["steps"].append(
                        f"AVISO: no se encontró empleado '{args.employee_name}' en empresa {args.profile_company}"
                    )

                upsert_profile(cur, user_id, args.profile_company, employee_id, apply)
                report["steps"].append(f"perfil empresa={args.profile_company} employee_id={employee_id}")

                apply_company_preset(cur, user_id, ESTETICA, ESTETICA_ALLOW, [], apply)
                report["steps"].append("permisos Estética (allow)")

                apply_company_preset(cur, user_id, MEDICINA, MEDICINA_ALLOW, MEDICINA_DENY, apply)
                report["steps"].append("permisos Medicina (allow + deny marketing)")

                if apply:
                    cur.execute(
                        """
                        INSERT INTO public.user_active_company (user_id, company_id, updated_at)
                        VALUES (%s, %s, now())
                        ON CONFLICT (user_id) DO UPDATE
                        SET company_id = EXCLUDED.company_id, updated_at = now()
                        """,
                        (user_id, args.profile_company),
                    )

            if apply:
                conn.commit()
                print("OK — configuración aplicada.")
            else:
                print("DRY-RUN — sin cambios. Usa --apply para escribir.")
    finally:
        conn.close()

    out = Path(args.report)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Informe: {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
