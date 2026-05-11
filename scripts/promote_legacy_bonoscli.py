"""
Importa bonos de clientes desde legacy.bonoscli a public.bonos.

Cruce:
  - customers: company_id + trim(customers.legacy_codcli) = trim(legacy.bonoscli.codcli)
  - plantilla: public.bonus_definitions (company_id, code = trim(codbon))
  - nombre / sesiones: maestro legacy.bonos + contadores BONOSCLI (ntickets, ticgas, finalizado, etc.)

Requisitos: haber importado BONOSCLI.DBF a legacy.bonoscli; clientes con legacy_codcli
relleno; promocionar antes bonus_definitions (promote_legacy_bonus_coverage).

Variables de entorno:
  SUPABASE_DB_URL=postgresql://...
  LEGACY_COMPANY_ID=<uuid empresa>
  LEGACY_DRY_RUN=0|1
"""
from __future__ import annotations

import os
import re
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

import psycopg2
from psycopg2.extras import Json

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
        k = k.strip()
        v = v.strip().strip('"')
        if k and k not in os.environ:
            os.environ[k] = v


def parse_decimal(value: object, default: Decimal = Decimal("0")) -> Decimal:
    if value is None:
        return default
    s = str(value).strip().replace(",", ".")
    if not s:
        return default
    try:
        return Decimal(s)
    except InvalidOperation:
        return default


def parse_int(value: object, default: int = 0) -> int:
    d = parse_decimal(value, Decimal(default))
    return int(d)


def _truthy(s: str | None) -> bool:
    if s is None:
        return False
    return s.strip().lower() in ("1", "s", "si", "sí", "y", "yes", "t", "true")


def parse_sessions_hint_from_obs(text: object) -> int | None:
    """Número de sesiones o restante inferido de texto libre (Dunasoft/observaciones)."""
    if not text:
        return None
    t = str(text)
    m = re.search(
        r"(?i)(qued[oa]n?|restante|falt[ao])[^\d]*(\d+)",
        t,
    )
    if m:
        return int(m.group(2))
    m2 = re.search(
        r"(?i)(\d+)\s*(?:de|sesi[oó]n|ses\.|tickets?)",
        t,
    )
    if m2:
        v = int(m2.group(1))
        if 0 < v < 10_000:
            return v
    return None


def parse_sql_date(s: str | None) -> date | None:
    if not s:
        return None
    t = s.strip()
    if not t:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%Y%m%d", "%d.%m.%Y"):
        try:
            return datetime.strptime(t[:10], fmt).date()
        except ValueError:
            continue
    m = re.search(r"(\d{2,4})-(\d{1,2})-(\d{1,2})", t)
    if m:
        try:
            y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
            if y < 100:
                y += 2000
            return date(y, mo, d)
        except ValueError:
            pass
    return None


def _definition_coverage(cur, company_id: str, definition_id: str) -> list[dict[str, Any]]:
    cur.execute(
        """
        SELECT
          bdi.coverage_type,
          bdi.article_id,
          bdi.family_code,
          bdi.covered_quantity,
          bdi.notes,
          a.codigo,
          a.descripcion
        FROM public.bonus_definition_items bdi
        LEFT JOIN public.articles a ON a.id = bdi.article_id
        WHERE bdi.definition_id = %s
        ORDER BY bdi.id
        """,
        (definition_id,),
    )
    out: list[dict[str, Any]] = []
    for (
        c_type,
        art_id,
        fam,
        qty,
        notes,
        codigo,
        descripcion,
    ) in cur.fetchall():
        if notes == "legacy-bonus-article":
            continue
        label: str
        if fam:
            label = f"Familia {fam}"
        else:
            label = f"{(codigo or '') + ' - ' if codigo else ''}{descripcion or (notes or 'Cobertura')}"[:200]
        out.append(
            {
                "coverage_type": c_type,
                "article_id": str(art_id) if art_id else None,
                "family_code": str(fam) if fam else None,
                "covered_quantity": float(qty) if qty is not None else 1,
                "label": label,
            }
        )
    return out


def main() -> None:
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_URL", "").strip()
    company_id = os.environ.get("LEGACY_COMPANY_ID", "").strip()
    dry_run = os.environ.get("LEGACY_DRY_RUN", "0").strip().lower() in ("1", "true", "yes", "si")

    if not db_url:
        raise SystemExit("Falta SUPABASE_DB_URL")
    if not company_id:
        raise SystemExit("Falta LEGACY_COMPANY_ID")

    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cur = conn.cursor()
    n_insert = 0
    n_update = 0
    n_skip = 0
    n_dry = 0
    try:
        cur.execute(
            """
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'legacy'
              AND table_name = 'bonoscli'
              AND column_name = 'impgas'
            """
        )
        has_impgas = cur.fetchone() is not None
        impgas_expr = "bc.impgas" if has_impgas else "NULL::numeric"
        cur.execute(
            f"""
            SELECT
              bc.codboncli, bc.codcli, bc.fecha, bc.fecven, bc.importe, bc.obsboncli,
              bc.nocaduca, bc.codbon, bc.ntickets, bc.ticgas, bc.finalizado,
              {impgas_expr} AS impgas
            FROM legacy.bonoscli bc
            WHERE TRIM(COALESCE(bc.codcli, '')) <> ''
            """
        )
        rows = cur.fetchall()

        cur.execute(
            """
            SELECT id, (legacy_codcli)::text, trim(both from legacy_codcli) AS t
            FROM public.customers
            WHERE company_id = %s AND COALESCE(legacy_codcli, '') <> ''
            """,
            (company_id,),
        )
        by_codcli: dict[str, str] = {}
        for cid, _lc, t in cur.fetchall():
            if t:
                by_codcli[str(t).strip().lower()] = str(cid)

        for (
            codboncli,
            codcli,
            fecha,
            fecven,
            importe,
            obsboncli,
            _nocaduca,
            codbon,
            ntickets,
            ticgas,
            finalizado,
            impgas,
        ) in rows:
            cli_key = str(codcli).strip().lower()
            if not cli_key or not by_codcli.get(cli_key):
                n_skip += 1
                continue

            cbon = str(codbon or "").strip()
            if not cbon:
                n_skip += 1
                continue

            cur.execute(
                """
                SELECT id, default_total_sessions, default_price, name, description
                FROM public.bonus_definitions
                WHERE company_id = %s AND code = %s
                """,
                (company_id, cbon),
            )
            drow = cur.fetchone()
            if not drow:
                n_skip += 1
                continue
            def_id, def_tot, def_price, def_name, def_desc = drow[0], drow[1], drow[2], drow[3], drow[4]

            cur.execute(
                """
                SELECT desbon, importe, servicios, obsbon, obsoleto
                FROM legacy.bonos
                WHERE TRIM(COALESCE(codbon, '')) = %s
                LIMIT 1
                """,
                (cbon,),
            )
            m = cur.fetchone()
            m_des, m_importe, m_srv, m_obs, _m_obsol = (m if m else (None, None, None, None, None))

            nombre = (m_des and str(m_des).strip()) or (def_name and str(def_name)) or f"Bono {cbon}"
            descripcion = (m_obs and str(m_obs).strip()) or (def_desc and str(def_desc)) or None
            m_imp = m_importe if m_importe is not None else def_price
            precio = float(parse_decimal(importe, parse_decimal(m_imp, Decimal("0"))))
            servicios_m = max(1, parse_int(m_srv, 1) if m_srv is not None else 1)
            nti0 = parse_int(ntickets, 0)
            tgas0 = parse_int(ticgas, 0)
            nti = nti0
            tgas = tgas0
            if nti0 == 0 and tgas0 == 0 and obsboncli is not None:
                hint = parse_sessions_hint_from_obs(obsboncli)
                if hint is not None and hint > 0:
                    tgas = min(hint, servicios_m * 2 or hint)
            def_tot_i = int(def_tot) if def_tot is not None else 1
            sesiones_totales = max(def_tot_i, servicios_m, 1)
            if nti > 0:
                sesiones_totales = max(sesiones_totales, nti)
            sesiones_usadas = min(tgas, sesiones_totales) if tgas >= 0 else 0
            fin = _truthy(str(finalizado)) if finalizado is not None else False
            if fin:
                sesiones_usadas = sesiones_totales
            estado = "completado" if fin or sesiones_usadas >= sesiones_totales else "activo"

            coverage = _definition_coverage(cur, company_id, str(def_id))
            if not coverage:
                coverage = []

            fc = parse_sql_date(str(fecha) if fecha is not None else None)
            fv = parse_sql_date(str(fecven) if fecven is not None else None)
            fcompra = (fc or date.today()).isoformat()

            lkey = str(codboncli).strip() if codboncli is not None else ""
            if not lkey:
                n_skip += 1
                continue

            imp_d = (
                parse_decimal(impgas, Decimal("0"))
                if (has_impgas and impgas is not None and str(impgas).strip() != "")
                else Decimal("0")
            )
            paid_f = float(imp_d) if imp_d > 0 else precio
            data_quality: dict[str, object] = {}
            if nti0 == 0 and tgas0 == 0 and tgas > 0 and not fin and str(obsboncli or "").strip():
                data_quality["counters_from_obs"] = True
            if nti0 == 0 and tgas0 == 0 and not fin and not re.search(
                r"\d", str(obsboncli or "")
            ):
                data_quality["legacy_counters_empty"] = True
            if has_impgas and (impgas is None or str(impgas).strip() == ""):
                data_quality["impgas_empty"] = True

            data_quality_json = Json(data_quality) if len(data_quality) > 0 else None
            customer_id = by_codcli[cli_key]
            row_payload = {
                "customer_id": customer_id,
                "company_id": company_id,
                "nombre": (nombre or "")[:255],
                "descripcion": descripcion,
                "precio_total": precio,
                "sesiones_totales": sesiones_totales,
                "sesiones_usadas": max(0, min(sesiones_usadas, sesiones_totales)),
                "estado": estado,
                "fecha_compra": fcompra,
                "fecha_vencimiento": fv.isoformat() if fv else None,
                "bonus_definition_id": str(def_id),
                "coverage_items": Json(coverage),
                "payment_mode": "full",
                "paid_amount": paid_f,
                "second_payment_paid": True,
                "data_quality": data_quality_json,
            }

            cur.execute(
                """
                SELECT id FROM public.bonos
                WHERE company_id = %s
                  AND legacy_codboncli IS NOT NULL
                  AND TRIM(legacy_codboncli) = %s
                """,
                (company_id, lkey),
            )
            ex = cur.fetchone()

            if not dry_run:
                if ex:
                    cur.execute(
                        """
                        UPDATE public.bonos
                        SET
                          nombre = %(nombre)s,
                          descripcion = %(descripcion)s,
                          precio_total = %(precio_total)s,
                          sesiones_totales = %(sesiones_totales)s,
                          sesiones_usadas = %(sesiones_usadas)s,
                          estado = %(estado)s,
                          fecha_compra = %(fecha_compra)s::date,
                          fecha_vencimiento = NULLIF(%(fv)s, '')::date,
                          bonus_definition_id = %(bonus_definition_id)s,
                          coverage_items = %(coverage_items)s,
                          payment_mode = %(payment_mode)s,
                          paid_amount = %(paid_amount)s,
                          second_payment_paid = %(second_payment_paid)s,
                          second_payment_due_at_used_sessions = NULL,
                          data_quality = COALESCE(%(data_quality)s::jsonb, data_quality)
                        WHERE id = %(eid)s
                        """,
                        {
                            **row_payload,
                            "eid": str(ex[0]),
                            "fv": fv.isoformat() if fv else None,
                        },
                    )
                    n_update += 1
                else:
                    cur.execute(
                        """
                        INSERT INTO public.bonos (
                          customer_id, company_id, nombre, descripcion, precio_total,
                          sesiones_totales, sesiones_usadas, estado, fecha_compra, fecha_vencimiento,
                          bonus_definition_id, coverage_items, payment_mode, paid_amount, second_payment_paid,
                          second_payment_due_at_used_sessions, legacy_codboncli, data_quality
                        )
                        VALUES (
                          %(customer_id)s, %(company_id)s, %(nombre)s, %(descripcion)s, %(precio_total)s,
                          %(sesiones_totales)s, %(sesiones_usadas)s, %(estado)s, %(fecha_compra)s::date,
                          NULLIF(%(fv)s, '')::date,
                          %(bonus_definition_id)s, %(coverage_items)s, %(payment_mode)s, %(paid_amount)s, %(second_payment_paid)s,
                          NULL, %(lkey)s, %(data_quality)s::jsonb
                        )
                        """,
                        {**row_payload, "lkey": lkey, "fv": fv.isoformat() if fv else None},
                    )
                    n_insert += 1
            else:
                n_dry += 1
        if dry_run:
            conn.rollback()
            print("DRY RUN: sin cambios persistidos.")
        else:
            conn.commit()
        if dry_run:
            print(
                f"Filas BONOSCLI: {len(rows)} | importables (prueba): {n_dry} | "
                f"omitidas: {n_skip} | dry_run=1"
            )
        else:
            print(
                f"Filas BONOSCLI: {len(rows)} | insertadas: {n_insert} | actualizadas: {n_update} | "
                f"omitidas: {n_skip}"
            )
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
