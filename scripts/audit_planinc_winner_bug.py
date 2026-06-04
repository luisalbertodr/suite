#!/usr/bin/env python3
"""
Detecta citas cuya versión vigente (IDPLAN) está en otra fecha que fechax histórica,
y citas del día con codempx != codemp (Dunasoft columna vs codemp).
"""
from __future__ import annotations

import os
import sys
from collections import defaultdict
from pathlib import Path

import psycopg2
from psycopg2.extras import RealDictCursor

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from promote_legacy_planinc_to_agenda import (
    effective_planinc_date,
    effective_planinc_time,
    planinc_row_sort_key,
    norm_idplan,
    exclude_tipinc_set,
)

ENV_PATH = ROOT / ".env"


def load_dotenv() -> None:
    if not ENV_PATH.is_file():
        return
    for line in ENV_PATH.read_text(encoding="utf-8", errors="replace").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k, v = k.strip(), v.strip().strip('"')
        if k and k not in os.environ:
            os.environ[k] = v


def norm_date(value) -> str | None:
    v = str(value or "").strip()
    if len(v) == 8 and v.isdigit():
        return f"{v[:4]}-{v[4:6]}-{v[6:8]}"
    if len(v) >= 10 and v[4] == "-":
        return v[:10]
    return None


def main() -> int:
    load_dotenv()
    target = os.environ.get("AUDIT_DATE", "2026-06-11").strip()
    url = os.environ.get("SUPABASE_DB_URL", "").strip()
    if not url:
        return 2

    conn = psycopg2.connect(url)
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM legacy.planinc")
    rows = cur.fetchall()

    # Ganador global por idplan (como promote)
    winners: dict[str, tuple] = {}
    for r in rows:
        ip = norm_idplan(r.get("idplan"))
        if not ip:
            continue
        sk = planinc_row_sort_key(r)
        if winners.get(ip) is None or sk > winners[ip][0]:
            winners[ip] = (sk, r)

    ex = exclude_tipinc_set()

    # Filas con fechax=target (lo que Dunasoft podría pintar ese día)
    fechax_day = []
    for r in rows:
        fx = norm_date(r.get("fechax"))
        if fx == target:
            fechax_day.append(r)

    print(f"Filas con fechax={target}: {len(fechax_day)}")
    print(f"IDPLAN distintos con fechax={target}: {len({norm_idplan(r.get('idplan')) for r in fechax_day if norm_idplan(r.get('idplan'))})}")

    missing_on_day = []
    wrong_emp = []
    dropped_borrar = []

    for r in fechax_day:
        ip = norm_idplan(r.get("idplan"))
        if not ip:
            continue
        w = winners.get(ip)
        if not w:
            continue
        _sk, win = w
        win_date = effective_planinc_date(win)
        tip = str(win.get("tipinc") or "").strip().upper()
        ce = str(r.get("codemp") or "").strip()
        cex = str(r.get("codempx") or "").strip()
        win_ce = str(win.get("codemp") or "").strip()
        win_cex = str(win.get("codempx") or "").strip()

        if tip in ex:
            dropped_borrar.append((ip, r, win))
        if win_date != target:
            missing_on_day.append(
                {
                    "idplan": ip,
                    "nomcli": str(r.get("nomcli") or "")[:40],
                    "fechax_row": effective_planinc_time(r, "horini"),
                    "winner_date": win_date,
                    "winner_hor": effective_planinc_time(win, "horini"),
                    "codemp_row": ce,
                    "codempx_row": cex,
                    "winner_codemp": win_ce,
                    "winner_tipinc": win.get("tipinc"),
                }
            )
        if cex and cex.lstrip("0") != ce.lstrip("0"):
            wrong_emp.append(
                {
                    "idplan": ip,
                    "nomcli": str(r.get("nomcli") or "")[:40],
                    "hor": effective_planinc_time(r, "horini"),
                    "codemp": ce,
                    "codempx": cex,
                    "winner_date": win_date,
                }
            )

    print(f"\nCitas con fechax={target} cuyo GANADOR global está en OTRA fecha: {len(missing_on_day)}")
    for x in sorted(missing_on_day, key=lambda z: z.get("fechax_row") or "")[:30]:
        print(f"  idplan={x['idplan']} {x['fechax_row']} {x['nomcli']!r} -> winner {x['winner_date']} {x['winner_hor']} tipinc={x['winner_tipinc']}")

    print(f"\nFilas fechax={target} con codempx != codemp: {len(wrong_emp)}")
    for x in sorted(wrong_emp, key=lambda z: z.get("hor") or ""):
        print(f"  {x['hor']} idplan={x['idplan']} codemp={x['codemp']} codempx={x['codempx']} {x['nomcli']!r}")

    print(f"\nFilas fechax={target} cuyo ganador es BORRAR: {len(dropped_borrar)}")

    # Buscar idplans captura tarde Betha en cualquier fechax jun 11
    needles = ["Maria Isabel Martinez", "Ana Fernandez", "Raquel Lema", "Raquel Casais", "Azlyn"]
    print(f"\nClientes captura con fechax={target}:")
    for r in fechax_day:
        nom = str(r.get("nomcli") or "")
        if any(n.lower() in nom.lower() for n in needles):
            ip = norm_idplan(r.get("idplan"))
            w = winners.get(ip)
            wd = effective_planinc_date(w[1]) if w else None
            print(
                f"  {effective_planinc_time(r,'horini')} {nom[:35]} idplan={ip} codemp={r.get('codemp')} "
                f"codempx={r.get('codempx')} winner_date={wd}"
            )

    # Impacto global: fechax en mes pero winner en otro día
    jun_fechax = [r for r in rows if norm_date(r.get("fechax")) and norm_date(r.get("fechax")).startswith("2026-06")]
    shifted = 0
    for r in jun_fechax:
        ip = norm_idplan(r.get("idplan"))
        if not ip:
            continue
        w = winners.get(ip)
        if not w:
            continue
        if effective_planinc_date(w[1]) != norm_date(r.get("fechax")):
            shifted += 1
    print(f"\nJunio 2026: filas con fechax en jun cuyo ganador idplan tiene otra fecha efectiva: {shifted} / {len(jun_fechax)}")

    # Simular promote: cuántas citas aparecerían el target vs cuántas fechax
    appear = sum(
        1
        for _ip, (_sk, win) in winners.items()
        if effective_planinc_date(win) == target
        and str(win.get("tipinc") or "").strip().upper() not in ex
    )
    print(f"\nCitas que promote pone en {target} (ganador global): {appear}")
    print(f"Filas fechax={target} (lo visible en Dunasoft por fecha vigente): {len(fechax_day)}")

    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
