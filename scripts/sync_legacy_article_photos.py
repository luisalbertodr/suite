"""
Actualiza solo articles.legacy_photo_path desde legacy.articulos (campo foto).

No modifica precios, familia, billing_company_id ni descripciones.
Requiere DBF ya importados en legacy.*.

Variables:
  LEGACY_PHOTOS_DIR  directorio de imágenes (opcional; valida que exista el fichero)
  LEGACY_COMPANY_ID / PROMOTE_COMPANY_ID

Uso:
  python scripts/sync_legacy_article_photos.py --dry-run
  python scripts/sync_legacy_article_photos.py
"""
from __future__ import annotations

import argparse
import os
import sys
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
        k, v = k.strip(), v.strip().strip('"')
        if k and k not in os.environ:
            os.environ[k] = v


def resolve_photo_file(photos_dir: Path | None, raw: str) -> str | None:
    name = raw.strip()
    if not name:
        return None
    if photos_dir is None:
        return name
    direct = photos_dir / name
    if direct.is_file():
        return name
    stem = Path(name).stem
    for ext in (".jpg", ".jpeg", ".png", ".bmp", ".gif", ".JPG", ".PNG"):
        candidate = photos_dir / f"{stem}{ext}"
        if candidate.is_file():
            return candidate.name
        candidate = photos_dir / stem / f"{stem}{ext}"
        if candidate.is_file():
            return str(candidate.relative_to(photos_dir)).replace("\\", "/")
    return name


def main() -> None:
    load_dotenv()
    ap = argparse.ArgumentParser()
    ap.add_argument("--company-id", default=get_company_id())
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    dsn = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not dsn:
        sys.exit("Falta SUPABASE_DB_URL")

    photos_raw = os.environ.get("LEGACY_PHOTOS_DIR", "").strip()
    photos_dir = Path(photos_raw) if photos_raw else None
    if photos_dir and not photos_dir.is_dir():
        print(f"Aviso: LEGACY_PHOTOS_DIR no existe: {photos_dir}", file=sys.stderr)

    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    cur = conn.cursor()
    cur.execute(
        """
        SELECT btrim(l.codart::text), NULLIF(btrim(l.foto::text), '')
        FROM legacy.articulos l
        WHERE NULLIF(btrim(l.codart::text), '') IS NOT NULL
          AND NULLIF(btrim(l.foto::text), '') IS NOT NULL
        """
    )
    legacy_rows = cur.fetchall()
    updated = skipped = 0
    for codart, foto in legacy_rows:
        path_value = resolve_photo_file(photos_dir, str(foto))
        if not path_value:
            skipped += 1
            continue
        cur.execute(
            """
            UPDATE public.articles a
            SET legacy_photo_path = %s, updated_at = now()
            WHERE a.company_id = %s
              AND a.legacy_codart = %s
              AND (a.legacy_photo_path IS DISTINCT FROM %s)
            """,
            (path_value, args.company_id, codart, path_value),
        )
        if cur.rowcount:
            updated += cur.rowcount

    print(f"Filas legacy con foto: {len(legacy_rows)}")
    print(f"Artículos actualizados: {updated} (omitidos sin cambio/vacío: {skipped})")
    if args.dry_run:
        conn.rollback()
        print("[dry-run] Sin cambios.")
    else:
        conn.commit()
        print("Hecho.")
    conn.close()


if __name__ == "__main__":
    main()
