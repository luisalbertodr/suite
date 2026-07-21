#!/bin/bash
# Prueba MySQL desde el contenedor edge con las env SMARTPSS_*
set -e
docker exec supabase-edge-functions sh -c 'deno eval "
import mysql from \"npm:mysql2@3.11.5/promise\";
const conn = await mysql.createConnection({
  host: Deno.env.get(\"SMARTPSS_MYSQL_HOST\"),
  port: Number(Deno.env.get(\"SMARTPSS_MYSQL_PORT\") || 3306),
  user: Deno.env.get(\"SMARTPSS_MYSQL_USER\"),
  password: Deno.env.get(\"SMARTPSS_MYSQL_PASSWORD\"),
  database: Deno.env.get(\"SMARTPSS_MYSQL_DATABASE\"),
  connectTimeout: 8000,
});
const [rows] = await conn.query(\"SELECT COUNT(*) AS total FROM AttendanceRecordInfo\");
console.log(JSON.stringify({ ok: true, rows }));
await conn.end();
"'
