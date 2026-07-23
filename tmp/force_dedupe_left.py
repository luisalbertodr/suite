#!/usr/bin/env python3
"""One-shot: force-dedupe leftover medicina pairs that are clearly v1/v2."""
from __future__ import annotations

import subprocess
from pathlib import Path

import psycopg2
import psycopg2.extras

ENV_PATH = Path("/root/supabase-project/.env")


def pw() -> str:
    for line in ENV_PATH.read_text(encoding="utf-8", errors="ignore").splitlines():
        if line.startswith("POSTGRES_PASSWORD="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("no pw")


def main() -> None:
    ip = subprocess.check_output(
        ["docker", "inspect", "-f", "{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}", "supabase-db"],
        text=True,
    ).strip()
    conn = psycopg2.connect(f"postgresql://postgres:{pw()}@{ip}:5432/postgres")
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # Pares seguros a borrar (quedarse con el segundo id = v2 / mejor)
    # Shyra: idénticos
    # Remedios / Maria Luisa / Maria Cambon: misma visita v1 vs v2 (tto casi igual)
    # Carmen: vacía v1 vs v2 con contenido → borrar v1 vacía
    # Marisa / Conchi: dos visitas distintas reales → NO tocar

    delete_keep = [
        # delete, keep
        ("5340d75f-5602-464e-a225-acbef22e1d30", "17b3f101-505e-4dfd-8d1e-9e10a5d6be6c"),  # Shyra
        ("87e7cba6-5a88-4973-992c-7116a08cb812", "8b3d8792-cecc-43cd-95d1-15d364687b69"),  # Remedios
        ("d846b2eb-86d7-430b-b253-d6a1ffbda28b", "8ab8ba88-37f8-4aae-8fa2-c8a9a7d99245"),  # Regueiro
        ("ae748b14-e58e-4cea-90e4-81f14c943d85", "485db71c-d90a-4ad2-b277-b0d0968b550c"),  # Cambon
        ("a78b9328-f238-465f-968b-a47166a8dba8", "8c289510-9dc7-49c5-b84a-ae00a893fb26"),  # Carmen empty v1
    ]
    to_delete = [d for d, _k in delete_keep]
    cur.execute(
        "DELETE FROM public.historial_clinico WHERE id = ANY(%s::uuid[])",
        (to_delete,),
    )
    print("deleted", cur.rowcount, to_delete)
    conn.commit()

    cur.execute(
        """
        SELECT count(*) AS left
        FROM (
          SELECT customer_id, fecha
          FROM historial_clinico
          WHERE observaciones LIKE %s
          GROUP BY customer_id, fecha
          HAVING count(*) > 1
        ) x
        """,
        ("%Fichas medicina.csv%",),
    )
    print("dup groups left", cur.fetchone()["left"])


if __name__ == "__main__":
    main()
