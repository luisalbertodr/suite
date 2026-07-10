"""
Sincroniza agenda Suite con plan2009.dbf de Style (fuente de verdad).

Corrige:
  - Fechas/horas desalineadas (citas fantasma en días incorrectos)
  - Texto y nombres con tildes corruptas (mitodo → método, valoracisn → valoración)
  - dunasoft.plan2009 desactualizado

Uso:
  python scripts/resync_agenda_from_plan2009_dbf.py --dry-run
  python scripts/resync_agenda_from_plan2009_dbf.py
"""
from __future__ import annotations

import argparse
import csv
import io
import os
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from repair_style_text_encoding import (  # noqa: E402
    DEFAULT_STYLE_DBF,
    DbfTable,
    SSH_HOST,
    SSH_KEY,
    choose_name,
    choose_texto,
    decode_cp1252,
    load_clientes,
    load_dotenv,
    load_latest_planinc,
    norm_idplan,
    run_remote_psql_copy,
    sql_literal,
)


@dataclass(frozen=True)
class PlanRow:
    idplan: str
    fecha: str
    horini: str
    horfin: str
    texto: str
    nomcli: str
    codemp: str
    codcli: str


def norm_lines(value: str) -> str:
    return value.replace("\r\n", "\n").replace("\r", "\n")


def norm_time(value: str, fallback: str = "09:00") -> str:
    t = value.strip()
    if not t:
        return fallback
    if ":" in t:
        parts = t.split(":", 1)
        return f"{parts[0].zfill(2)}:{parts[1][:2]}"
    if t.isdigit() and len(t) >= 3:
        t = t.zfill(4)
        return f"{t[:2]}:{t[2:4]}"
    return fallback


def fecha_iso(raw: bytes) -> str | None:
    s = decode_cp1252(raw)
    if len(s) == 8 and s.isdigit():
        return f"{s[:4]}-{s[4:6]}-{s[6:8]}"
    if len(s) >= 10 and s[4] == "-":
        return s[:10]
    return None


def load_plan2009_full(path: Path) -> dict[str, PlanRow]:
    table = DbfTable(path)
    out: dict[str, PlanRow] = {}
    for rec_off in table.iter_rows():
        idplan = norm_idplan(decode_cp1252(table.read_field(rec_off, "IDPLAN")))
        fecha = fecha_iso(table.read_field(rec_off, "FECHA"))
        if not fecha:
            continue
        horini = norm_time(decode_cp1252(table.read_field(rec_off, "HORINI")))
        horfin = norm_time(decode_cp1252(table.read_field(rec_off, "HORFIN")), horini)
        out[idplan] = PlanRow(
            idplan=idplan,
            fecha=fecha,
            horini=horini,
            horfin=horfin,
            texto=decode_cp1252(table.read_field(rec_off, "TEXTO")),
            nomcli=decode_cp1252(table.read_field(rec_off, "NOMCLI")),
            codemp=decode_cp1252(table.read_field(rec_off, "CODEMP")),
            codcli=decode_cp1252(table.read_field(rec_off, "CODCLI")).lstrip("0") or "0",
        )
    return out


def resolve_rows(
    plan2009: dict[str, PlanRow],
    planinc: dict[str, tuple[int, str, str, str]],
    clientes: dict[str, str],
) -> dict[str, PlanRow]:
    out: dict[str, PlanRow] = {}
    for idplan, row in plan2009.items():
        inc = planinc.get(idplan)
        inc_text = inc[2] if inc and inc[1] != "BORRAR" else ""
        inc_name = inc[3] if inc and inc[1] != "BORRAR" else ""
        texto = choose_texto(row.texto, inc_text)
        nomcli = choose_name(row.nomcli, inc_name, clientes.get(row.codcli, ""))
        out[idplan] = PlanRow(
            idplan=idplan,
            fecha=row.fecha,
            horini=row.horini,
            horfin=row.horfin,
            texto=texto,
            nomcli=nomcli,
            codemp=row.codemp,
            codcli=row.codcli,
        )
    return out


def fetch_suite_rows() -> dict[str, tuple[str, str, str, str, str]]:
    sql = """
COPY (
  SELECT coalesce(legacy_idplan, ''),
         appointment_date::text,
         left(start_time, 5),
         left(end_time, 5),
         coalesce(client_name, ''),
         coalesce(description, '')
  FROM public.agenda_appointments
  WHERE legacy_idplan IS NOT NULL AND btrim(legacy_idplan) <> ''
) TO STDOUT WITH (FORMAT csv, DELIMITER E'\\t', QUOTE '"', ESCAPE '"');
"""
    raw = run_remote_psql_copy(sql)
    out: dict[str, tuple[str, str, str, str, str]] = {}
    for parts in list(csv.reader(io.StringIO(raw), delimiter="\t", quotechar='"')):
        if len(parts) < 6:
            continue
        out[parts[0].lstrip("0") or "0"] = (
            parts[1],
            parts[2],
            parts[3],
            parts[4],
            parts[5],
        )
    return out


def row_differs(
    current: tuple[str, str, str, str, str],
    fixed: PlanRow,
) -> bool:
    cur_date, cur_hi, cur_hf, cur_name, cur_desc = current
    if cur_date != fixed.fecha:
        return True
    if cur_hi != fixed.horini:
        return True
    if cur_hf != fixed.horfin:
        return True
    if cur_name != fixed.nomcli:
        return True
    if norm_lines(cur_desc) != norm_lines(fixed.texto):
        return True
    return False


def apply_batches(updates: list[PlanRow], chunk: int = 150) -> None:
    for i in range(0, len(updates), chunk):
        batch = updates[i : i + chunk]
        values_sql = ",\n".join(
            "("
            f"{sql_literal(r.idplan)}::text, "
            f"{sql_literal(r.fecha)}::date, "
            f"{sql_literal(r.horini)}::text, "
            f"{sql_literal(r.horfin)}::text, "
            f"{sql_literal(r.nomcli)}::text, "
            f"{sql_literal(r.texto)}::text, "
            f"{sql_literal(r.codemp)}::text, "
            f"{sql_literal(r.codcli)}::text"
            ")"
            for r in batch
        )
        sql = f"""
BEGIN;
SELECT set_config('app.style_sync_inbound', '1', true);
CREATE TEMP TABLE tmp_agenda_plan_sync (
  legacy_idplan text,
  fecha date,
  horini text,
  horfin text,
  nomcli text,
  texto text,
  codemp text,
  codcli text
) ON COMMIT DROP;
INSERT INTO tmp_agenda_plan_sync (
  legacy_idplan, fecha, horini, horfin, nomcli, texto, codemp, codcli
) VALUES
{values_sql};
UPDATE public.agenda_appointments aa
SET appointment_date = f.fecha,
    start_time = f.horini,
    end_time = f.horfin,
    client_name = f.nomcli,
    description = f.texto,
    legacy_codemp = nullif(f.codemp, ''),
    legacy_codcli = nullif(f.codcli, ''),
    updated_at = now()
FROM tmp_agenda_plan_sync f
WHERE aa.legacy_idplan IS NOT NULL
  AND ltrim(aa.legacy_idplan, '0') = ltrim(f.legacy_idplan, '0')
  AND (
    aa.appointment_date IS DISTINCT FROM f.fecha OR
    left(aa.start_time, 5) IS DISTINCT FROM f.horini OR
    left(aa.end_time, 5) IS DISTINCT FROM f.horfin OR
    aa.client_name IS DISTINCT FROM f.nomcli OR
    aa.description IS DISTINCT FROM f.texto OR
    coalesce(aa.legacy_codemp, '') IS DISTINCT FROM coalesce(nullif(f.codemp, ''), '') OR
    coalesce(aa.legacy_codcli, '') IS DISTINCT FROM coalesce(nullif(f.codcli, ''), '')
  );
UPDATE dunasoft.plan2009 p
SET fecha = f.fecha,
    horini = f.horini,
    horfin = f.horfin,
    nomcli = left(f.nomcli, 80),
    texto = left(f.texto, 250),
    codemp = nullif(f.codemp, ''),
    codcli = nullif(f.codcli, ''),
    _dbf_synced_at = now()
FROM tmp_agenda_plan_sync f
WHERE ltrim(p.idplan::text, '0') = ltrim(f.legacy_idplan, '0')
  AND (
    p.fecha IS DISTINCT FROM f.fecha OR
    p.horini IS DISTINCT FROM f.horini OR
    p.horfin IS DISTINCT FROM f.horfin OR
    p.nomcli IS DISTINCT FROM left(f.nomcli, 80) OR
    p.texto IS DISTINCT FROM left(f.texto, 250)
  );
COMMIT;
"""
        run_remote_psql_copy(sql)
        print(f"  batch {i // chunk + 1}: {len(batch)} filas")


def remove_orphans(orphan_ids: list[str]) -> None:
    if not orphan_ids:
        return
    values_sql = ",\n".join(f"({sql_literal(x)}::text)" for x in orphan_ids)
    sql = f"""
BEGIN;
SELECT set_config('app.style_sync_inbound', '1', true);
CREATE TEMP TABLE tmp_orphan_idplans (legacy_idplan text) ON COMMIT DROP;
INSERT INTO tmp_orphan_idplans (legacy_idplan) VALUES
{values_sql};
UPDATE public.agenda_appointments aa
SET status = 'cancelled', updated_at = now()
FROM tmp_orphan_idplans o
WHERE ltrim(aa.legacy_idplan, '0') = ltrim(o.legacy_idplan, '0')
  AND public.appointment_has_completed_sale(aa.id);
DELETE FROM public.agenda_appointments aa
USING tmp_orphan_idplans o
WHERE ltrim(aa.legacy_idplan, '0') = ltrim(o.legacy_idplan, '0')
  AND NOT public.appointment_has_completed_sale(aa.id);
COMMIT;
"""
    run_remote_psql_copy(sql)
    print(f"  huérfanas eliminadas/canceladas: {len(orphan_ids)}")


def main() -> None:
    load_dotenv()
    parser = argparse.ArgumentParser()
    parser.add_argument("--style-dbf-dir", default=os.environ.get("STYLE_DBF_DIR", DEFAULT_STYLE_DBF))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    dbf_dir = Path(args.style_dbf_dir)
    plan2009_path = dbf_dir / "PLAN2009.DBF"
    planinc_path = dbf_dir / "PLANINC.DBF"
    clientes_path = dbf_dir / "CLIENTES.DBF"

    print(f"Leyendo DBFs desde {dbf_dir} ...")
    plan2009 = load_plan2009_full(plan2009_path)
    planinc = load_latest_planinc(planinc_path)
    clientes = load_clientes(clientes_path)
    resolved = resolve_rows(plan2009, planinc, clientes)
    print(f"plan2009={len(plan2009)} resueltos={len(resolved)}")

    print("Leyendo agenda actual ...")
    suite = fetch_suite_rows()
    updates: list[PlanRow] = []
    for idplan, fixed in resolved.items():
        current = suite.get(idplan)
        if not current:
            continue
        if row_differs(current, fixed):
            updates.append(fixed)

    orphan_ids = sorted(set(suite) - set(resolved))
    date_fixes = sum(1 for u in updates if suite.get(u.idplan, ("", "", "", "", ""))[0] != u.fecha)
    name_fixes = sum(1 for u in updates if suite.get(u.idplan, ("", "", "", "", ""))[3] != u.nomcli)
    text_fixes = sum(
        1
        for u in updates
        if norm_lines(suite.get(u.idplan, ("", "", "", "", ""))[4]) != norm_lines(u.texto)
    )

    print(f"Citas a sincronizar: {len(updates)} (fechas: {date_fixes}, nombres: {name_fixes}, texto: {text_fixes})")
    print(f"Huérfanas (no en DBF): {len(orphan_ids)}")

    for sample in ("112351", "110914", "112190"):
        if sample in resolved and sample in suite:
            cur = suite[sample]
            fix = resolved[sample]
            print(f"  {sample} suite fecha={cur[0]} nombre={cur[3][:40]!r}")
            print(f"  {sample} dbf   fecha={fix.fecha} nombre={fix.nomcli[:40]!r}")

    if args.dry_run:
        return

    apply_batches(updates)
    remove_orphans(orphan_ids)
    print("Resync completado.")


if __name__ == "__main__":
    main()
