"""
Promociona definiciones de bonos legacy y su cobertura a tablas públicas:
  - public.bonus_definitions
  - public.bonus_definition_items

Lee:
  - legacy.bonos
  - legacy.bonosart
  - legacy.bonosfam
  - public.articles (mapeo por legacy_codart)

Variables:
  SUPABASE_DB_URL=postgresql://...
  LEGACY_COMPANY_ID=<uuid empresa destino>  (default: scripts/legacy_company.py)
  LEGACY_DRY_RUN=0|1
  LEGACY_SKIP_OBSOLETE_BONOS=0|1  (default 0: importa también obsoletos, necesario para clientes)
"""
from __future__ import annotations

import os
from decimal import Decimal, InvalidOperation
from pathlib import Path

import psycopg2

from legacy_company import get_company_id

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
    return int(parse_decimal(value, Decimal(default)))


def _legacy_table_columns(cur, rel: str) -> set[str]:
    cur.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'legacy' AND table_name = %s
        """,
        (rel,),
    )
    return {str(r[0]).lower() for r in cur.fetchall()}


def _first_col(cols: set[str], candidates: tuple[str, ...]) -> str | None:
    for c in candidates:
        if c in cols:
            return c
    return None


def main() -> None:
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_URL", "").strip()
    company_id = get_company_id()
    dry_run = os.environ.get("LEGACY_DRY_RUN", "0").strip().lower() in ("1", "true", "yes", "si")
    skip_obsolete = os.environ.get("LEGACY_SKIP_OBSOLETE_BONOS", "0").strip().lower() in (
        "1",
        "true",
        "yes",
        "si",
    )

    if not db_url:
        raise SystemExit("Falta SUPABASE_DB_URL")

    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT code, id
            FROM (
              SELECT
                REPLACE(legacy_codart, 'BONO:', '') AS code,
                id,
                ROW_NUMBER() OVER (
                  PARTITION BY REPLACE(legacy_codart, 'BONO:', '')
                  ORDER BY created_at DESC
                ) AS rn
              FROM public.articles
              WHERE company_id = %s
                AND legacy_codart LIKE 'BONO:%%'
            ) t
            WHERE rn = 1
            """,
            (company_id,),
        )
        bono_article_map = {str(code).strip(): str(article_id) for code, article_id in cur.fetchall()}

        cur.execute(
            """
            SELECT id, codigo, descripcion, legacy_codart
            FROM public.articles
            WHERE company_id = %s
            """,
            (company_id,),
        )
        article_by_legacy_code: dict[str, str] = {}
        for article_id, codigo, _descripcion, legacy_codart in cur.fetchall():
            for key in {str(k).strip() for k in (legacy_codart, codigo) if k and str(k).strip()}:
                article_by_legacy_code.setdefault(key, str(article_id))

        cur.execute(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'bonus_definition_items'
            """
        )
        bdi_cols = {str(r[0]).lower() for r in cur.fetchall()}
        has_max_unpaid = "max_covered_if_unpaid" in bdi_cols
        has_commission = "commission_pvp" in bdi_cols

        bcols = _legacy_table_columns(cur, "bonosart")
        col_cant = _first_col(
            bcols, ("cant", "cantidad", "cantic", "nucant", "cante")
        )
        col_cantmax = _first_col(
            bcols, ("cantmax", "maxcant", "canmaxi", "ticmax", "cant_m", "cmaxim")
        )
        col_pvp = _first_col(
            bcols, ("pvpcom", "pvp_com", "comision", "compvp", "pvp", "pcom")
        )

        # Fragmento SQL coherente con columnas reales (p. ej. cant / cantmax / pvpcom tras reimportar DBF)
        bonoart_select = (
            f"TRIM(COALESCE(codart, '')) AS codart, "
            f"{(col_cant + '::text') if col_cant else 'NULL::text'} AS cant, "
            f"{(col_cantmax + '::text') if col_cantmax else 'NULL::text'} AS cantmax, "
            f"{(col_pvp + '::text') if col_pvp else 'NULL::text'} AS pvpcom"
        )

        cur.execute(
            """
            SELECT codbon, desbon, obsbon, importe, servicios, productos, obsoleto
            FROM legacy.bonos
            WHERE COALESCE(codbon, '') <> ''
            """
        )
        bonus_rows = cur.fetchall()

        defs_upserted = 0
        items_upserted = 0
        total_bonos = len(bonus_rows)
        for idx, (codbon, desbon, obsbon, importe, servicios, productos, obsoleto) in enumerate(
            bonus_rows, start=1
        ):
            if idx == 1 or idx % 10 == 0 or idx == total_bonos:
                print(f"  bonos {idx}/{total_bonos} …", flush=True)
            code = str(codbon).strip()
            if not code:
                continue

            name = (str(desbon).strip() or f"Bono {code}")[:255]
            description = (str(obsbon).strip() or None)
            default_price = parse_decimal(importe)
            is_obsolete = str(obsoleto).strip().lower() in ("1", "true", "t", "si", "s")

            if skip_obsolete and is_obsolete:
                continue

            cur.execute(
                f"""
                SELECT {bonoart_select}
                FROM legacy.bonosart
                WHERE TRIM(COALESCE(codbon, '')) = %s
                  AND TRIM(COALESCE(codart, '')) <> ''
                """,
                (code,),
            )
            bonoart_rows: list[tuple] = list(cur.fetchall())
            line_sum = 0.0
            for rline in bonoart_rows:
                qv = rline[1] if len(rline) > 1 else None
                if qv is not None and str(qv).strip() != "":
                    line_sum += float(parse_decimal(qv, Decimal("0")))
            default_total_sessions = max(1, parse_int(servicios, default=1))
            if line_sum >= 0.5:
                default_total_sessions = max(default_total_sessions, int(round(line_sum)))

            if not dry_run:
                cur.execute(
                    """
                    INSERT INTO public.bonus_definitions (
                      company_id, code, name, description, default_price, default_total_sessions, source
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, 'legacy')
                    ON CONFLICT (company_id, code)
                    DO UPDATE SET
                      name = EXCLUDED.name,
                      description = EXCLUDED.description,
                      default_price = EXCLUDED.default_price,
                      default_total_sessions = EXCLUDED.default_total_sessions,
                      updated_at = now()
                    RETURNING id
                    """,
                    (company_id, code, name, description, float(default_price), default_total_sessions),
                )
                definition_id = str(cur.fetchone()[0])

                cur.execute("DELETE FROM public.bonus_definition_items WHERE definition_id = %s", (definition_id,))

                by_codart: dict[str, list[tuple]] = {}
                for row in bonoart_rows:
                    c = str(row[0]).strip() if row[0] is not None else ""
                    if not c:
                        continue
                    by_codart.setdefault(c, []).append(row)

                for legacy_article_code, art_rows in by_codart.items():
                    article_id = article_by_legacy_code.get(legacy_article_code)
                    if not article_id:
                        continue
                    # Si hay varias filas con el mismo codart, se suman cantidades
                    qty = Decimal("0")
                    max_un: Decimal | None = None
                    com: Decimal | None = None
                    for r in art_rows:
                        qv = r[1] if len(r) > 1 else None
                        mx = r[2] if len(r) > 2 else None
                        pv = r[3] if len(r) > 3 else None
                        if qv is not None and str(qv).strip() != "":
                            qty += parse_decimal(qv, Decimal("0"))
                        if mx is not None and str(mx).strip() != "":
                            mxd = parse_decimal(mx, Decimal("0"))
                            if mxd > 0:
                                max_un = mxd
                        if pv is not None and str(pv).strip() != "":
                            pvd = parse_decimal(pv, Decimal("0"))
                            com = pvd
                    if qty <= 0:
                        qty = Decimal("1")
                    qty_f = float(qty)
                    max_un_f = float(max_un) if max_un and max_un > 0 else None
                    com_f = float(com) if com and com > 0 else None

                    if has_max_unpaid and has_commission:
                        cur.execute(
                            """
                            INSERT INTO public.bonus_definition_items (
                              definition_id, coverage_type, article_id, covered_quantity,
                              max_covered_if_unpaid, commission_pvp, notes
                            )
                            VALUES (%s, 'service', %s, %s, %s, %s, 'legacy-bonosart')
                            """,
                            (definition_id, article_id, qty_f, max_un_f, com_f),
                        )
                    else:
                        cur.execute(
                            """
                            INSERT INTO public.bonus_definition_items (
                              definition_id, coverage_type, article_id, covered_quantity, notes
                            )
                            VALUES (%s, 'service', %s, %s, 'legacy-bonosart')
                            """,
                            (definition_id, article_id, qty_f),
                        )
                    items_upserted += 1

                cur.execute(
                    """
                    SELECT codfam1
                    FROM legacy.bonosfam
                    WHERE TRIM(COALESCE(codbon, '')) = %s
                      AND TRIM(COALESCE(codfam1, '')) <> ''
                    """,
                    (code,),
                )
                family_codes = [str(r[0]).strip() for r in cur.fetchall()]
                product_qty = max(0, parse_int(productos, default=0))
                for fam in family_codes:
                    cur.execute(
                        """
                        INSERT INTO public.bonus_definition_items (
                          definition_id, coverage_type, family_code, covered_quantity
                        )
                        VALUES (%s, 'family', %s, %s)
                        """,
                        (definition_id, fam, product_qty if product_qty > 0 else 1),
                    )
                    items_upserted += 1

                # Siempre incluimos línea representando el propio artículo bono, si existe.
                bonus_article_id = bono_article_map.get(code)
                if bonus_article_id:
                    cur.execute(
                        """
                        INSERT INTO public.bonus_definition_items (
                          definition_id, coverage_type, article_id, covered_quantity, notes
                        )
                        VALUES (%s, 'product', %s, 1, 'legacy-bonus-article')
                        """,
                        (definition_id, bonus_article_id),
                    )
                    items_upserted += 1

                cur.execute(
                    """
                    UPDATE public.articles
                    SET bonus_definition_id = %s
                    WHERE company_id = %s
                      AND legacy_codart = %s
                    """,
                    (definition_id, company_id, f"BONO:{code}"),
                )

            defs_upserted += 1

        if dry_run:
            conn.rollback()
            print("DRY RUN: sin cambios persistidos.")
        else:
            conn.commit()
        print(f"Definiciones procesadas: {defs_upserted}")
        print(f"Coberturas procesadas: {items_upserted}")
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
