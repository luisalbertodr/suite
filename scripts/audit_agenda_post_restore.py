#!/usr/bin/env python3
"""Comprobación citas 6–8 jun 2026 tras restore Supabase."""
import subprocess
import sys

SQL = r"""
\echo '=== CITAS POR DIA (agenda_appointments) ==='
SELECT appointment_date::text AS dia, count(*) AS citas,
       count(*) FILTER (WHERE NOT EXISTS (
         SELECT 1 FROM public.agenda_dunasoft_bridge b
         WHERE b.agenda_appointment_id = a.id
       )) AS sin_puente
FROM public.agenda_appointments a
WHERE appointment_date BETWEEN '2026-06-06' AND '2026-06-08'
GROUP BY 1 ORDER BY 1;

\echo '=== PLAN2009 POR DIA (dunasoft) ==='
SELECT fecha::text AS dia, count(*) AS filas
FROM dunasoft.plan2009
WHERE fecha BETWEEN '2026-06-06' AND '2026-06-08'
GROUP BY 1 ORDER BY 1;

\echo '=== PUENTES POR FECHA CITA ==='
SELECT a.appointment_date::text AS dia,
       count(b.id) AS puentes,
       count(*) FILTER (WHERE b.dbf_status = 'applied') AS applied,
       count(*) FILTER (WHERE b.dbf_status = 'pending') AS pending
FROM public.agenda_appointments a
LEFT JOIN public.agenda_dunasoft_bridge b ON b.agenda_appointment_id = a.id
WHERE a.appointment_date BETWEEN '2026-06-06' AND '2026-06-08'
GROUP BY 1 ORDER BY 1;

\echo '=== WHATSAPP (mensajes por dia) ==='
SELECT (created_at AT TIME ZONE 'Europe/Madrid')::date::text AS dia, count(*) AS msgs
FROM public.whatsapp_messages
WHERE (created_at AT TIME ZONE 'Europe/Madrid')::date BETWEEN '2026-06-06' AND '2026-06-08'
GROUP BY 1 ORDER BY 1;

\echo '=== COLA STYLE (pendientes) ==='
SELECT count(*) FILTER (WHERE delivered_at IS NULL) AS pending,
       count(*) FILTER (WHERE delivered_at IS NOT NULL) AS delivered,
       max(created_at) AS last_queue
FROM dunasoft.style_reservas_queue;

\echo '=== RESUMEN GLOBAL ==='
SELECT
  (SELECT max(appointment_date) FROM public.agenda_appointments) AS max_cita,
  (SELECT max(fecha) FROM dunasoft.plan2009) AS max_plan2009,
  (SELECT max(created_at) FROM public.whatsapp_messages) AS max_wa;
"""

cmd = [
    "ssh", "suite-supabase",
    "docker", "exec", "-i", "supabase-db",
    "psql", "-U", "supabase_admin", "-d", "postgres",
]
proc = subprocess.run(cmd, input=SQL, capture_output=True, text=True)
sys.stdout.write(proc.stdout)
if proc.stderr:
    sys.stderr.write(proc.stderr)
sys.exit(proc.returncode)
