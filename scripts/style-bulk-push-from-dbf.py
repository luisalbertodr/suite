#!/usr/bin/env python3
"""Carga inicial plan2009 (Style DBF) → Suite producción vía style-reservas-sync.

Uso:
  python scripts/style-bulk-push-from-dbf.py --dbf-dir C:\\Duna\\Style-Suite-Test\\dbf
  python scripts/style-bulk-push-from-dbf.py --dbf-dir Z:\\Style-Dunasoft\\dbf --cfg Z:\\Style-Dunasoft\\SuiteSync.cfg

Lee SuiteSync.cfg (SYNC_URL, SYNC_TOKEN, SYNC_MAC). Reanudable con --resume.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime
from pathlib import Path

from dbfread import DBF


def load_cfg(path: Path) -> dict[str, str]:
    cfg: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        cfg[k.strip()] = v.strip()
    return cfg


def sfield(rec: dict, name: str) -> str:
    v = rec.get(name)
    if v is None:
        return ""
    if isinstance(v, (bytes, bytearray)):
        return v.decode("latin-1", errors="replace").strip()
    if isinstance(v, date) and not isinstance(v, datetime):
        return v.isoformat()
    return str(v).strip()


def parse_idplan(rec: dict) -> int:
    try:
        return int(float(sfield(rec, "IDPLAN") or "0"))
    except ValueError:
        return 0


def parse_fecha(rec: dict) -> str | None:
    v = rec.get("FECHA")
    if isinstance(v, date):
        return v.isoformat()
    raw = sfield(rec, "FECHA")
    if re.fullmatch(r"\d{8}", raw):
        return f"{raw[0:4]}-{raw[4:6]}-{raw[6:8]}"
    return None


def truthy(rec: dict, name: str) -> bool:
    return sfield(rec, name).upper() in ("T", "Y", "1", "TRUE")


def build_servicios(planart_path: Path, idplan: int) -> str:
    if not planart_path.is_file():
        return ""
    lines: list[str] = []
    table = DBF(str(planart_path), encoding="latin-1", ignore_missing_memofile=True, raw=True)
    for rec in table:
        if parse_idplan(rec) != idplan:
            continue
        lines.append(sfield(rec, "CODART") + sfield(rec, "HORA"))
    return "\r".join(lines)


def push_one(
    url: str,
    token: str,
    mac: str,
    rec: dict,
    servicios: str,
    timeout: int,
) -> tuple[bool, str]:
    idplan = parse_idplan(rec)
    fecha = parse_fecha(rec)
    if idplan <= 0:
        return False, "idplan invalido"
    if not fecha:
        return False, "fecha invalida"

    idand = sfield(rec, "IDAND")
    accion = "MODIFICAR" if idand not in ("", "0") else "ALTA"
    params = {
        "id": token,
        "tag": "stylereservas",
        "accion": accion,
        "idplan": str(idplan),
        "codemp": sfield(rec, "CODEMP"),
        "codcli": sfield(rec, "CODCLI"),
        "fecha": fecha,
        "horini": sfield(rec, "HORINI") or "09:00",
        "horfin": sfield(rec, "HORFIN") or "10:00",
        "texto": sfield(rec, "TEXTO"),
        "codrec": sfield(rec, "CODREC"),
        "nomcli": sfield(rec, "NOMCLI") or "Cliente",
        "tel1cli": sfield(rec, "TEL1CLI"),
        "facturado": "SI" if truthy(rec, "FACTURADO") else "NO",
        "servicios": servicios,
        "collet": sfield(rec, "COLLET") or "0",
        "colfon": sfield(rec, "COLFON") or "0",
        "idand": idand or "0",
        "macand": mac,
        "modificado": "0",
    }
    body = urllib.parse.urlencode(params, quote_via=urllib.parse.quote).encode("latin-1", errors="replace")
    req = urllib.request.Request(
        url,
        data=body,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            text = resp.read().decode("utf-8", errors="replace").strip()
            if resp.status == 200 and text.upper() == "OK":
                return True, "OK"
            return False, text[:200] or f"HTTP {resp.status}"
    except urllib.error.HTTPError as e:
        msg = e.read().decode("utf-8", errors="replace")[:200]
        return False, msg or str(e)
    except Exception as e:
        return False, str(e)


def main() -> int:
    ap = argparse.ArgumentParser(description="Bulk push plan2009 DBF → Suite")
    ap.add_argument("--dbf-dir", required=True, help="Carpeta con plan2009.dbf y planart.dbf")
    ap.add_argument("--cfg", help="Ruta SuiteSync.cfg (default: dbf-dir/../SuiteSync.cfg)")
    ap.add_argument("--only-enviar", action="store_true", help="Solo registros con ENVIAR=.T.")
    ap.add_argument("--include-facturado", action="store_true", help="Incluir citas facturado=.T. (default: omitir)")
    ap.add_argument("--from-date", help="YYYY-MM-DD minimo (opcional)")
    ap.add_argument("--limit", type=int, default=0, help="Max registros (0=todos)")
    ap.add_argument("--sleep", type=float, default=0.05, help="Pausa entre POSTs (s)")
    ap.add_argument("--timeout", type=int, default=60, help="Timeout HTTP (s)")
    ap.add_argument("--resume", action="store_true", help="Saltar idplan ya en .bulk-push-state.json")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    dbf_dir = Path(args.dbf_dir)
    plan_path = dbf_dir / "plan2009.dbf"
    planart_path = dbf_dir / "planart.dbf"
    if not plan_path.is_file():
        print(f"ERROR: no existe {plan_path}", file=sys.stderr)
        return 1

    cfg_path = Path(args.cfg) if args.cfg else dbf_dir.parent / "SuiteSync.cfg"
    cfg = load_cfg(cfg_path)
    url = cfg.get("SYNC_URL", "")
    token = cfg.get("SYNC_TOKEN", "")
    mac = cfg.get("SYNC_MAC", "")
    if not url or not token:
        print("ERROR: SYNC_URL o SYNC_TOKEN vacios en cfg", file=sys.stderr)
        return 1

    state_path = dbf_dir.parent / ".bulk-push-state.json"
    done: set[int] = set()
    if args.resume and state_path.is_file():
        done = set(json.loads(state_path.read_text(encoding="utf-8")).get("ok_idplans", []))

    min_date = None
    if args.from_date:
        min_date = date.fromisoformat(args.from_date)

    table = DBF(str(plan_path), encoding="latin-1", ignore_missing_memofile=True, raw=True)
    ok = fail = skip = 0
    t0 = time.time()

    for rec in table:
        idplan = parse_idplan(rec)
        if idplan <= 0:
            skip += 1
            continue
        if args.only_enviar and not truthy(rec, "ENVIAR"):
            skip += 1
            continue
        if truthy(rec, "FACTURADO") and not args.include_facturado:
            skip += 1
            continue
        fecha = parse_fecha(rec)
        if not fecha:
            skip += 1
            continue
        if min_date and date.fromisoformat(fecha) < min_date:
            skip += 1
            continue
        if idplan in done:
            skip += 1
            continue
        if args.limit and ok + fail >= args.limit:
            break

        servicios = build_servicios(planart_path, idplan)
        if args.dry_run:
            print(f"DRY idplan={idplan} fecha={fecha} codemp={sfield(rec,'CODEMP')}")
            ok += 1
            continue

        success, msg = push_one(url, token, mac, rec, servicios, args.timeout)
        if success:
            ok += 1
            done.add(idplan)
            if ok % 100 == 0:
                state_path.write_text(
                    json.dumps({"ok_idplans": sorted(done)}, indent=0),
                    encoding="utf-8",
                )
                elapsed = time.time() - t0
                print(f"  ... {ok} ok, {fail} fallo, {skip} skip ({ok/elapsed:.1f}/s)")
        else:
            fail += 1
            print(f"FALLO idplan={idplan}: {msg}")

        if args.sleep > 0:
            time.sleep(args.sleep)

    state_path.write_text(json.dumps({"ok_idplans": sorted(done)}, indent=0), encoding="utf-8")
    elapsed = time.time() - t0
    print(f"\nListo: {ok} ok, {fail} fallo, {skip} omitidos en {elapsed:.0f}s")
    print(f"Estado: {state_path}")
    return 0 if fail == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
