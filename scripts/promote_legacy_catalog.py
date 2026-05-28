"""
Promociona catálogo legacy (ARTICULOS/ BONOS) a public.articles.

Detecta automáticamente la escala de importes B (1, 0.1, 0.01, 10, 100)
usando anclas conocidas de legacy.articulos.

Variables (o .env):
  SUPABASE_DB_URL=postgresql://...
  LEGACY_COMPANY_ID=<uuid empresa destino>  (default: scripts/legacy_company.py)
  LEGACY_PRICE_ANCHORS=10600:43.71:85.90,5013:25.83:54.40
  LEGACY_PRICE_SCALE=1               # opcional: fuerza escala y salta autodetección
  LEGACY_INCLUDE_BONOS=1             # 1 por defecto
  LEGACY_DRY_RUN=0                   # 1 = no escribe

Uso:
  python scripts/promote_legacy_catalog.py
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Iterable

import psycopg2

from legacy_company import get_company_id

ROOT = Path(__file__).resolve().parents[1]


@dataclass(frozen=True)
class Anchor:
    codart: str
    coste: Decimal
    pvpa: Decimal


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


def parse_decimal(value: object) -> Decimal | None:
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    s = s.replace(",", ".")
    try:
        return Decimal(s)
    except InvalidOperation:
        return None


def parse_int(value: object) -> int:
    d = parse_decimal(value)
    if d is None:
        return 0
    return max(0, int(d))


def parse_bool(value: object) -> bool:
    if value is None:
        return False
    s = str(value).strip().lower()
    return s in ("1", "t", "true", "y", "yes", "s", "si")


def parse_anchors() -> list[Anchor]:
    raw = os.environ.get(
        "LEGACY_PRICE_ANCHORS",
        "10600:43.71:85.90,5013:25.83:54.40",
    ).strip()
    out: list[Anchor] = []
    for item in raw.split(","):
        item = item.strip()
        if not item:
            continue
        cod, coste, pvpa = item.split(":")
        out.append(Anchor(codart=cod.strip(), coste=Decimal(coste), pvpa=Decimal(pvpa)))
    if not out:
        raise SystemExit("No hay anclas LEGACY_PRICE_ANCHORS")
    return out


def detect_scale(cur, anchors: Iterable[Anchor]) -> Decimal:
    forced = os.environ.get("LEGACY_PRICE_SCALE", "").strip()
    if forced:
        return Decimal(forced)

    anchors = list(anchors)
    codes = [a.codart for a in anchors]
    cur.execute(
        """
        SELECT codart, coste, pvpa
        FROM legacy.articulos
        WHERE codart = ANY(%s)
        """,
        (codes,),
    )
    by_code = {str(r[0]).strip(): r for r in cur.fetchall()}
    candidates = [Decimal("1"), Decimal("0.1"), Decimal("0.01"), Decimal("10"), Decimal("100")]
    best_scale = Decimal("1")
    best_err: Decimal | None = None

    for scale in candidates:
        err = Decimal("0")
        used = 0
        for a in anchors:
            row = by_code.get(a.codart)
            if not row:
                continue
            c = parse_decimal(row[1])
            p = parse_decimal(row[2])
            if c is None or p is None:
                continue
            err += abs((c * scale) - a.coste) + abs((p * scale) - a.pvpa)
            used += 2
        if used == 0:
            continue
        if best_err is None or err < best_err:
            best_err = err
            best_scale = scale
    return best_scale


def infer_kind(tipart: str, tiempo: str) -> str:
    t = (tipart or "").strip().lower()
    if "serv" in t:
        return "servicio"
    if parse_int(tiempo) > 0:
        return "servicio"
    return "producto"


def normalized_code(prefix: str, raw: str) -> str:
    base = "".join(ch for ch in (raw or "").strip() if ch.isalnum() or ch in ("-", "_"))
    if not base:
        base = "SINCOD"
    return f"{prefix}{base}"[:60]


def resolve_unique_codigo(cur, company_id: str, legacy_codart: str, preferred: str) -> str:
    """Evita choques con UNIQUE global en articles.codigo."""
    cur.execute(
        """
        SELECT company_id, legacy_codart
        FROM public.articles
        WHERE codigo = %s
        LIMIT 1
        """,
        (preferred,),
    )
    row = cur.fetchone()
    if not row:
        return preferred
    if str(row[0]) == company_id and (row[1] or "") == legacy_codart:
        return preferred

    suffix = company_id.replace("-", "")[:8] or "cmp"
    candidate = f"{preferred}-{suffix}"[:60]
    i = 1
    while True:
        cur.execute(
            """
            SELECT company_id, legacy_codart
            FROM public.articles
            WHERE codigo = %s
            LIMIT 1
            """,
            (candidate,),
        )
        row = cur.fetchone()
        if not row:
            return candidate
        if str(row[0]) == company_id and (row[1] or "") == legacy_codart:
            return candidate
        i += 1
        tail = f"-{suffix}-{i}"
        candidate = f"{preferred[: max(1, 60 - len(tail))]}{tail}"


def normalize_iva(value: object) -> Decimal:
    d = parse_decimal(value)
    if d is None:
        return Decimal("21")
    if d in (Decimal("0"), Decimal("4"), Decimal("10"), Decimal("21")):
        return d
    # Algunos legacy guardan códigos cortos (1..4). Fallback seguro.
    return Decimal("21")


def normalize_family_code(code: str) -> str:
    c = (code or "").strip()
    if not c:
        return ""
    if c.isdigit():
        return str(int(c))
    return c


def build_family_map(cur) -> dict[str, str]:
    """Mapa código familia Dunasoft -> nombre legible (desfam1)."""
    cur.execute("SELECT codfam1, desfam1, obsoleto FROM legacy.familia1")
    fam_map: dict[str, str] = {}
    for cod, des, obsoleto in cur.fetchall():
        if parse_bool(obsoleto):
            continue
        code = str(cod or "").strip()
        name = (str(des).strip() if des is not None else "") or code
        if not code:
            continue
        fam_map[code] = name
        norm = normalize_family_code(code)
        if norm and norm not in fam_map:
            fam_map[norm] = name
    return fam_map


def resolve_familia(fam_code: str, fam_map: dict[str, str]) -> str:
    code = str(fam_code or "").strip()
    if not code:
        return "Varios"
    if code in fam_map:
        return fam_map[code]
    norm = normalize_family_code(code)
    if norm and norm in fam_map:
        return fam_map[norm]
    # Si no hay tabla familia1 cargada, conservar el código como nombre provisional.
    return code


def sync_article_families(cur, company_id: str, names: Iterable[str], dry_run: bool) -> int:
    unique = sorted({str(n).strip() for n in names if str(n).strip()})
    if dry_run:
        return len(unique)
    for name in unique:
        cur.execute(
            """
            INSERT INTO public.article_families (company_id, name)
            VALUES (%s, %s)
            ON CONFLICT (company_id, name) DO NOTHING
            """,
            (company_id, name),
        )
    return len(unique)


def main() -> None:
    load_dotenv()
    db_url = os.environ.get("SUPABASE_DB_URL", "").strip()
    company_id = get_company_id()
    include_bonos = os.environ.get("LEGACY_INCLUDE_BONOS", "1").strip() not in ("0", "false", "no")
    dry_run = os.environ.get("LEGACY_DRY_RUN", "0").strip() in ("1", "true", "yes", "si")
    if not db_url:
        raise SystemExit("Falta SUPABASE_DB_URL")

    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cur = conn.cursor()
    try:
        scale = detect_scale(cur, parse_anchors())
        print(f"Escala monetaria detectada: {scale}")
        print(f"Company ID: {company_id}")

        fam_map = build_family_map(cur)
        print(f"Familias Dunasoft cargadas: {len(fam_map)}")

        cur.execute(
            """
            SELECT codart, desart, familia1, tipart, coste, pvpa, stock, ivaart, obsoleto, tiempo, foto
            FROM legacy.articulos
            WHERE COALESCE(codart, '') <> ''
            """
        )
        rows = cur.fetchall()
        used_families: set[str] = {"Varios", "Bonos"}
        n_articles = 0
        for row in rows:
            codart = str(row[0]).strip()
            legacy_codart = codart
            codigo_public = resolve_unique_codigo(
                cur,
                company_id,
                legacy_codart,
                normalized_code("LEG-", codart),
            )
            desart = (str(row[1]).strip() or codart)[:255]
            fam_code = str(row[2]).strip()
            tipart = str(row[3]).strip()
            coste = parse_decimal(row[4]) or Decimal("0")
            pvpa = parse_decimal(row[5]) or Decimal("0")
            stock = parse_decimal(row[6]) or Decimal("0")
            iva = normalize_iva(row[7])
            obsolete = parse_bool(row[8])
            tiempo = str(row[9]).strip() if row[9] is not None else ""
            photo = str(row[10]).strip() if row[10] is not None else ""
            familia = resolve_familia(fam_code, fam_map)
            used_families.add(familia)
            article_kind = infer_kind(tipart, tiempo)
            tipo_producto = "servicio" if article_kind == "servicio" else "producto"
            duration = parse_int(tiempo)

            if not dry_run:
                cur.execute(
                    """
                    INSERT INTO public.articles (
                      company_id, codigo, descripcion, descripcion_larga, familia, precio, precio_compra,
                      stock_actual, stock_minimo, estado, tipo_producto, iva_percentage,
                      article_kind, duration_minutes, legacy_codart, legacy_tipart, legacy_familia_code, legacy_photo_path
                    )
                    VALUES (
                      %s, %s, %s, NULL, %s, %s, %s,
                      %s, 0, %s, %s, %s,
                      %s, %s, %s, %s, %s, %s
                    )
                    ON CONFLICT (company_id, legacy_codart)
                    DO UPDATE SET
                      codigo = EXCLUDED.codigo,
                      descripcion = EXCLUDED.descripcion,
                      familia = EXCLUDED.familia,
                      precio = EXCLUDED.precio,
                      precio_compra = EXCLUDED.precio_compra,
                      stock_actual = EXCLUDED.stock_actual,
                      estado = EXCLUDED.estado,
                      iva_percentage = EXCLUDED.iva_percentage,
                      article_kind = EXCLUDED.article_kind,
                      duration_minutes = EXCLUDED.duration_minutes,
                      legacy_tipart = EXCLUDED.legacy_tipart,
                      legacy_familia_code = EXCLUDED.legacy_familia_code,
                      legacy_photo_path = EXCLUDED.legacy_photo_path,
                      updated_at = now()
                    """,
                    (
                        company_id,
                        codigo_public,
                        desart,
                        familia,
                        float(pvpa * scale),
                        float(coste * scale),
                        float(stock),
                        "inactivo" if obsolete else "activo",
                        tipo_producto,
                        float(iva),
                        article_kind,
                        duration,
                        legacy_codart,
                        tipart[:120] or None,
                        fam_code or None,
                        photo or None,
                    ),
                )
            n_articles += 1

        n_bonos = 0
        if include_bonos:
            cur.execute(
                """
                SELECT codbon, desbon, importe, obsoleto, foto
                FROM legacy.bonos
                WHERE COALESCE(codbon, '') <> ''
                """
            )
            for codbon, desbon, importe, obsoleto, foto in cur.fetchall():
                code = str(codbon).strip()
                if not code:
                    continue
                legacy_codart = f"BONO:{code}"
                codigo_public = resolve_unique_codigo(
                    cur,
                    company_id,
                    legacy_codart,
                    normalized_code("BON-", code),
                )
                desc = (str(desbon).strip() or f"Bono {code}")[:255]
                imp = parse_decimal(importe) or Decimal("0")
                if not dry_run:
                    cur.execute(
                        """
                        INSERT INTO public.articles (
                          company_id, codigo, descripcion, descripcion_larga, familia, precio, precio_compra,
                          stock_actual, stock_minimo, estado, tipo_producto, iva_percentage,
                          article_kind, duration_minutes, legacy_codart, legacy_tipart, legacy_familia_code, legacy_photo_path
                        )
                        VALUES (
                          %s, %s, %s, NULL, 'Bonos', %s, 0,
                          0, 0, %s, 'producto', 21,
                          'bono', 0, %s, 'BONO', 'BONOS', %s
                        )
                        ON CONFLICT (company_id, legacy_codart)
                        DO UPDATE SET
                          codigo = EXCLUDED.codigo,
                          descripcion = EXCLUDED.descripcion,
                          familia = EXCLUDED.familia,
                          precio = EXCLUDED.precio,
                          estado = EXCLUDED.estado,
                          article_kind = EXCLUDED.article_kind,
                          legacy_tipart = EXCLUDED.legacy_tipart,
                          legacy_familia_code = EXCLUDED.legacy_familia_code,
                          legacy_photo_path = EXCLUDED.legacy_photo_path,
                          updated_at = now()
                        """,
                        (
                            company_id,
                            codigo_public,
                            desc,
                            float(imp * scale),
                            "inactivo" if parse_bool(obsoleto) else "activo",
                            legacy_codart,
                            str(foto).strip() if foto is not None else None,
                        ),
                    )
                n_bonos += 1

        n_families = sync_article_families(
            cur,
            company_id,
            set(fam_map.values()) | used_families,
            dry_run,
        )

        if dry_run:
            conn.rollback()
            print("DRY RUN: sin cambios persistidos.")
        else:
            conn.commit()
        print(f"Artículos procesados: {n_articles}")
        print(f"Bonos procesados: {n_bonos}")
        print(f"Familias sincronizadas en article_families: {n_families}")
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
