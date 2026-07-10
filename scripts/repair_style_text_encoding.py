"""
Repara texto de agenda/clientes mal codificado en Postgres usando DBFs de Style (cp1252).

Fuentes:
  - plan2009.dbf: estado maestro (TEXTO, NOMCLI)
  - planinc.dbf: última versión por IDPLAN (prioritaria si plan2009 perdió tildes)
  - clientes.dbf: nombres de cliente (NOMCLI, APE1CLI)

Uso:
  python scripts/repair_style_text_encoding.py --dry-run
  python scripts/repair_style_text_encoding.py
  python scripts/repair_style_text_encoding.py --style-dbf-dir "\\\\192.168.99.16\\c$\\Style-Dunasoft\\dbf"
"""
from __future__ import annotations

import argparse
import csv
import io
import os
import re
import struct
import subprocess
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"
DEFAULT_STYLE_DBF = r"\\192.168.99.16\c$\Style-Dunasoft\dbf"
SSH_HOST = os.environ.get("SUITE_SSH_HOST", "suite-supabase")
SSH_KEY = Path(os.environ.get("USERPROFILE", "")) / ".ssh" / "suite_deploy"


def load_dotenv() -> None:
    if not ENV_PATH.is_file():
        return
    for line in ENV_PATH.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"'))


def decode_cp1252(raw: bytes) -> str:
    return raw.decode("cp1252", errors="replace").replace("\0", "").strip()


def strip_accents(value: str) -> str:
    norm = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in norm if not unicodedata.combining(ch))


def has_spanish_accents(value: str) -> bool:
    return any(ch in value for ch in "áéíóúñÁÉÍÓÚÑüÜ")


def choose_texto(plan2009_text: str, planinc_text: str) -> str:
    p9 = plan2009_text.strip()
    pi = planinc_text.strip()
    if not pi:
        return p9
    if not p9:
        return pi
    if p9 == pi:
        return p9
    if has_spanish_accents(pi) and strip_accents(p9) == strip_accents(pi):
        return pi
    if has_spanish_accents(pi) and not has_spanish_accents(p9):
        # plan2009 perdió tildes (p. ej. pidis/valoraisn/zltima)
        if len(strip_accents(p9)) >= max(8, len(strip_accents(pi)) - 4):
            return pi
    return p9


CORRUPTION_RE = re.compile(r"\bzltima\b|\btenma\b|valoraisn|\bpidis\b|csdigo", re.IGNORECASE)


def is_corrupted(value: str) -> bool:
    if not value:
        return False
    if "\ufffd" in value:
        return True
    return bool(CORRUPTION_RE.search(value))


def should_update_text(current: str, fixed: str) -> bool:
    cur = (current or "").strip()
    new = (fixed or "").strip()
    if not new:
        return False
    if cur == new:
        return False
    if is_corrupted(cur):
        return True
    if has_spanish_accents(new) and strip_accents(new) == strip_accents(cur):
        return True
    return False


def choose_name(plan2009_name: str, planinc_name: str, clientes_name: str) -> str:
    for candidate in (clientes_name.strip(), planinc_name.strip(), plan2009_name.strip()):
        if candidate and "\ufffd" not in candidate:
            if has_spanish_accents(candidate) or candidate == plan2009_name.strip():
                return candidate
    return plan2009_name.strip() or planinc_name.strip() or clientes_name.strip()


class DbfTable:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.buf = path.read_bytes()
        self.header_len = int.from_bytes(self.buf[8:10], "little")
        self.record_len = int.from_bytes(self.buf[10:12], "little")
        self.n_records = int.from_bytes(self.buf[4:8], "little")
        self.fields: list[tuple[str, int, int]] = []
        off = 32
        pos = 1
        while self.buf[off] != 0x0D:
            name = self.buf[off : off + 11].decode("ascii").replace("\0", "").strip().upper()
            flen = self.buf[off + 16]
            self.fields.append((name, pos, flen))
            pos += flen
            off += 32

    def read_field(self, rec_off: int, field_name: str) -> bytes:
        for name, fpos, flen in self.fields:
            if name == field_name.upper():
                return self.buf[rec_off + fpos : rec_off + fpos + flen]
        return b""

    def iter_rows(self):
        for i in range(self.n_records):
            rec_off = self.header_len + i * self.record_len
            if self.buf[rec_off] == 0x2A:
                continue
            yield rec_off


def norm_idplan(raw: str) -> str:
    t = raw.strip()
    if t.isdigit():
        return t.lstrip("0") or "0"
    return t


def load_plan2009(path: Path) -> dict[str, tuple[str, str, str]]:
    table = DbfTable(path)
    out: dict[str, tuple[str, str, str]] = {}
    for rec_off in table.iter_rows():
        idplan = norm_idplan(decode_cp1252(table.read_field(rec_off, "IDPLAN")))
        texto = decode_cp1252(table.read_field(rec_off, "TEXTO"))
        nomcli = decode_cp1252(table.read_field(rec_off, "NOMCLI"))
        codcli = decode_cp1252(table.read_field(rec_off, "CODCLI")).lstrip("0") or "0"
        out[idplan] = (texto, nomcli, codcli)
    return out


def load_latest_planinc(path: Path) -> dict[str, tuple[int, str, str, str]]:
    table = DbfTable(path)
    out: dict[str, tuple[int, str, str, str]] = {}
    for rec_off in table.iter_rows():
        idplan = norm_idplan(decode_cp1252(table.read_field(rec_off, "IDPLAN")))
        idplaninc_raw = decode_cp1252(table.read_field(rec_off, "IDPLANINC"))
        if not idplaninc_raw.isdigit():
            continue
        idplaninc = int(idplaninc_raw)
        tipinc = decode_cp1252(table.read_field(rec_off, "TIPINC")).upper()
        texto = decode_cp1252(table.read_field(rec_off, "TEXTO"))
        nomcli = decode_cp1252(table.read_field(rec_off, "NOMCLI"))
        prev = out.get(idplan)
        if prev is None or idplaninc > prev[0]:
            out[idplan] = (idplaninc, tipinc, texto, nomcli)
    return out


def load_clientes(path: Path) -> dict[str, str]:
    table = DbfTable(path)
    out: dict[str, str] = {}
    for rec_off in table.iter_rows():
        codcli = decode_cp1252(table.read_field(rec_off, "CODCLI")).lstrip("0") or "0"
        parts = [
            decode_cp1252(table.read_field(rec_off, "NOMCLI")),
            decode_cp1252(table.read_field(rec_off, "APE1CLI")),
        ]
        name = " ".join(p for p in parts if p).strip()
        if name:
            out[codcli] = name
    return out


def sql_literal(value: str) -> str:
    return "'" + value.replace("\\", "\\\\").replace("'", "''") + "'"


def run_remote_sql(sql: str) -> str:
    return run_remote_psql_copy(sql)


def run_remote_psql_copy(sql: str) -> str:
    cmd = [
        "ssh",
        "-i",
        str(SSH_KEY),
        "-o",
        "BatchMode=yes",
        SSH_HOST,
        "docker exec -i supabase-db psql -U postgres -d postgres -v ON_ERROR_STOP=1",
    ]
    proc = subprocess.run(cmd, input=sql.encode("utf-8"), capture_output=True)
    out = proc.stdout.decode("utf-8", errors="replace")
    err = proc.stderr.decode("utf-8", errors="replace")
    if proc.returncode != 0:
        raise RuntimeError(err or out)
    return out


def parse_copy_tsv(raw: str) -> list[list[str]]:
    if not raw.strip():
        return []
    return list(csv.reader(io.StringIO(raw), delimiter="\t", quotechar='"', doublequote=True))


def fetch_current_texts() -> tuple[dict[str, tuple[str, str]], dict[str, str]]:
    appt_sql = """
COPY (
  SELECT coalesce(legacy_idplan, ''), coalesce(description, ''), coalesce(client_name, '')
  FROM public.agenda_appointments
  WHERE legacy_idplan IS NOT NULL AND btrim(legacy_idplan) <> ''
) TO STDOUT WITH (FORMAT csv, DELIMITER E'\\t', QUOTE '"', ESCAPE '"');
"""
    raw = run_remote_psql_copy(appt_sql)
    appts: dict[str, tuple[str, str]] = {}
    for parts in parse_copy_tsv(raw):
        if len(parts) < 3:
            continue
        appts[parts[0].lstrip("0") or "0"] = (parts[1], parts[2])

    customer_sql = """
COPY (
  SELECT coalesce(legacy_codcli, ''), coalesce(name, '')
  FROM public.customers
  WHERE legacy_codcli IS NOT NULL AND btrim(legacy_codcli) <> ''
) TO STDOUT WITH (FORMAT csv, DELIMITER E'\\t', QUOTE '"', ESCAPE '"');
"""
    raw2 = run_remote_psql_copy(customer_sql)
    customers: dict[str, str] = {}
    for parts in parse_copy_tsv(raw2):
        if len(parts) < 2:
            continue
        customers[parts[0].lstrip("0") or "0"] = parts[1]
    return appts, customers


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
    for p in (plan2009_path, planinc_path, clientes_path):
        if not p.is_file():
            raise SystemExit(f"No se encuentra DBF: {p}")

    print(f"Leyendo DBFs desde {dbf_dir} ...")
    plan2009 = load_plan2009(plan2009_path)
    planinc = load_latest_planinc(planinc_path)
    clientes = load_clientes(clientes_path)
    print(f"plan2009={len(plan2009)} planinc={len(planinc)} clientes={len(clientes)}")

    resolved: dict[str, tuple[str, str, str]] = {}
    planinc_wins = 0
    for idplan, (p9_text, p9_name, codcli) in plan2009.items():
        inc = planinc.get(idplan)
        inc_text = inc[2] if inc and inc[1] != "BORRAR" else ""
        inc_name = inc[3] if inc and inc[1] != "BORRAR" else ""
        texto = choose_texto(p9_text, inc_text)
        if inc_text and texto == inc_text and p9_text != inc_text:
            planinc_wins += 1
        nomcli = choose_name(p9_name, inc_name, clientes.get(codcli, ""))
        resolved[idplan] = (texto, nomcli, codcli)

    print(f"Texto tomado de planinc (plan2009 corrupto): {planinc_wins}")

    print("Leyendo estado actual en Postgres ...")
    appts, customers = fetch_current_texts()

    appt_updates: list[tuple[str, str, str]] = []
    for idplan, (texto, nomcli, _codcli) in resolved.items():
        current = appts.get(idplan)
        if not current:
            continue
        cur_desc, cur_name = current
        new_desc = texto if should_update_text(cur_desc, texto) else cur_desc
        new_name = nomcli if should_update_text(cur_name, nomcli) else cur_name
        if new_desc != cur_desc or new_name != cur_name:
            appt_updates.append((idplan, new_desc, new_name))

    customer_updates: list[tuple[str, str]] = []
    for codcli, good_name in clientes.items():
        current = customers.get(codcli, "")
        if not good_name or not current:
            continue
        if should_update_text(current, good_name):
            customer_updates.append((codcli, good_name))

    print(f"Citas a actualizar: {len(appt_updates)}")
    print(f"Clientes a actualizar: {len(customer_updates)}")

    if appt_updates[:5]:
        print("Ejemplos citas:")
        for idplan, texto, nomcli in appt_updates[:5]:
            old = appts.get(idplan, ("", ""))
            print(f"  idplan={idplan}")
            print(f"    antes: {old[0][:90].encode('ascii', errors='backslashreplace').decode()}")
            print(f"    después: {texto[:90].encode('ascii', errors='backslashreplace').decode()}")

    if args.dry_run:
        return

    chunk = 200
    updated_appts = 0
    for i in range(0, len(appt_updates), chunk):
        batch = appt_updates[i : i + chunk]
        values_sql = ",\n".join(
            f"({sql_literal(idplan)}::text, {sql_literal(texto)}, {sql_literal(nomcli)})"
            for idplan, texto, nomcli in batch
        )
        sql = f"""
BEGIN;
SELECT set_config('app.style_sync_inbound', '1', true);
CREATE TEMP TABLE tmp_agenda_text_fix (legacy_idplan text, description text, client_name text) ON COMMIT DROP;
INSERT INTO tmp_agenda_text_fix (legacy_idplan, description, client_name) VALUES
{values_sql};
UPDATE public.agenda_appointments aa
SET description = f.description,
    client_name = f.client_name,
    updated_at = now()
FROM tmp_agenda_text_fix f
WHERE aa.legacy_idplan IS NOT NULL
  AND ltrim(aa.legacy_idplan, '0') = ltrim(f.legacy_idplan, '0')
  AND (aa.description IS DISTINCT FROM f.description OR aa.client_name IS DISTINCT FROM f.client_name);
UPDATE dunasoft.plan2009 p
SET texto = left(f.description, 250),
    nomcli = left(f.client_name, 80),
    _dbf_synced_at = now()
FROM tmp_agenda_text_fix f
WHERE ltrim(p.idplan::text, '0') = ltrim(f.legacy_idplan, '0')
  AND (p.texto IS DISTINCT FROM left(f.description, 250) OR p.nomcli IS DISTINCT FROM left(f.client_name, 80));
COMMIT;
"""
        run_remote_sql(sql)
        updated_appts += len(batch)
        print(f"  agenda batch {i // chunk + 1}: {len(batch)} filas")

    for i in range(0, len(customer_updates), chunk):
        batch = customer_updates[i : i + chunk]
        values_sql = ",\n".join(
            f"({sql_literal(codcli)}::text, {sql_literal(name)})" for codcli, name in batch
        )
        sql = f"""
BEGIN;
CREATE TEMP TABLE tmp_customer_name_fix (legacy_codcli text, name text) ON COMMIT DROP;
INSERT INTO tmp_customer_name_fix (legacy_codcli, name) VALUES
{values_sql};
UPDATE public.customers c
SET name = f.name,
    updated_at = now()
FROM tmp_customer_name_fix f
WHERE c.legacy_codcli IS NOT NULL
  AND ltrim(c.legacy_codcli, '0') = ltrim(f.legacy_codcli, '0')
  AND c.name IS DISTINCT FROM f.name;
COMMIT;
"""
        run_remote_sql(sql)
        print(f"  customers batch {i // chunk + 1}: {len(batch)} filas")

    print("Reparación completada.")


if __name__ == "__main__":
    main()
