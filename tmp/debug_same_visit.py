#!/usr/bin/env python3
import importlib.util
import os
import subprocess
from pathlib import Path

spec = importlib.util.spec_from_file_location("d", "/tmp/dedupe_medical_historial.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

env = Path("/root/supabase-project/.env")
pw = None
for line in env.read_text(encoding="utf-8", errors="ignore").splitlines():
    if line.startswith("POSTGRES_PASSWORD="):
        pw = line.split("=", 1)[1].strip().strip('"').strip("'")
ip = subprocess.check_output(
    ["docker", "inspect", "-f", "{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}", "supabase-db"],
    text=True,
).strip()
import psycopg2
import psycopg2.extras

conn = psycopg2.connect(f"postgresql://postgres:{pw}@{ip}:5432/postgres")
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

pairs = [
    ("5340d75f-5602-464e-a225-acbef22e1d30", "17b3f101-505e-4dfd-8d1e-9e10a5d6be6c"),
    ("87e7cba6-5a88-4973-992c-7116a08cb812", "8b3d8792-cecc-43cd-95d1-15d364687b69"),
    ("019d549f-6ddc-4326-b5bd-85f58235aead", "0ac97e12-bc79-43bb-af59-009396198d6d"),
    ("a78b9328-f238-465f-968b-a47166a8dba8", "8c289510-9dc7-49c5-b84a-ae00a893fb26"),
]
for a_id, b_id in pairs:
    cur.execute(
        "SELECT id::text, motivo_consulta, left(tratamiento,120) AS tto FROM historial_clinico WHERE id IN (%s::uuid,%s::uuid)",
        (a_id, b_id),
    )
    rows = {r["id"]: dict(r) for r in cur.fetchall()}
    a, b = rows[a_id], rows[b_id]
    a_full = {
        "id": a["id"],
        "motivo_consulta": a["motivo_consulta"],
        "tratamiento": a["tto"],
        "titulo": a["motivo_consulta"],
    }
    b_full = {
        "id": b["id"],
        "motivo_consulta": b["motivo_consulta"],
        "tratamiento": b["tto"],
        "titulo": b["motivo_consulta"],
    }
    print("---")
    print(a["motivo_consulta"], "|", (a["tto"] or "")[:60])
    print(b["motivo_consulta"], "|", (b["tto"] or "")[:60])
    print("same", m.same_visit(a_full, b_full))
    print("fp", m.fingerprint(a_full), "||", m.fingerprint(b_full))
