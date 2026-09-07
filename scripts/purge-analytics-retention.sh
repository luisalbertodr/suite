#!/usr/bin/env bash
# Retención de logs Analytics (Logflare/_analytics) + audit_events.
# Evita que el volumen Postgres se llene (caso 2026-08: 97 GB de log_events).
#
# Uso:
#   RETENTION_DAYS=7 ./purge-analytics-retention.sh
#   DRY_RUN=1 ./purge-analytics-retention.sh
set -euo pipefail

RETENTION_DAYS="${RETENTION_DAYS:-7}"
AUDIT_RETENTION_DAYS="${AUDIT_RETENTION_DAYS:-30}"
MAX_TABLE_GB="${MAX_TABLE_GB:-5}"
DRY_RUN="${DRY_RUN:-0}"
CONTAINER="${SUPABASE_DB_CONTAINER:-supabase-analytics}"
DB_CONTAINER="${SUPABASE_DB_NAME:-supabase-db}"
LOG_TAG="[purge-analytics]"

log() { echo "$(date -u +'%Y-%m-%dT%H:%M:%SZ') $LOG_TAG $*"; }

psql_analytics() {
  docker exec -i "$DB_CONTAINER" psql -U supabase_admin -d _supabase -v ON_ERROR_STOP=1 "$@"
}

psql_app() {
  docker exec -i "$DB_CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"
}

if ! docker ps --format '{{.Names}}' | grep -qx "$DB_CONTAINER"; then
  log "ERROR: container $DB_CONTAINER no está en ejecución"
  exit 1
fi

log "Inicio. retention_days=$RETENTION_DAYS audit_days=$AUDIT_RETENTION_DAYS max_table_gb=$MAX_TABLE_GB dry_run=$DRY_RUN"

# 1) Borrar eventos antiguos por timestamp (cuando hay índice BRIN suele ir bien).
# 2) Si alguna tabla sigue por encima de MAX_TABLE_GB, TRUNCATE de seguridad.
mapfile -t TABLES < <(psql_analytics -Atc "
  SELECT tablename
  FROM pg_tables
  WHERE schemaname='_analytics' AND tablename LIKE 'log_events_%'
  ORDER BY 1;
")

for t in "${TABLES[@]}"; do
  size_bytes="$(psql_analytics -Atc "SELECT pg_total_relation_size('_analytics.'||quote_ident('$t'));")"
  size_gb="$(awk -v b="$size_bytes" 'BEGIN{printf "%.2f", b/1024/1024/1024}')"
  log "Tabla $t size=${size_gb}G"

  if [[ "$DRY_RUN" == "1" ]]; then
    continue
  fi

  # Limpieza por antigüedad
  deleted="$(psql_analytics -Atc "
    WITH d AS (
      DELETE FROM _analytics.\"$t\"
      WHERE timestamp < (now() AT TIME ZONE 'utc') - interval '$RETENTION_DAYS days'
      RETURNING 1
    )
    SELECT count(*) FROM d;
  " 2>/dev/null || echo 0)"
  log "Deleted old rows from $t: $deleted"

  # Safety net: si crece demasiado, vaciar
  size_bytes="$(psql_analytics -Atc "SELECT pg_total_relation_size('_analytics.'||quote_ident('$t'));")"
  size_gb_num="$(awk -v b="$size_bytes" 'BEGIN{printf "%d", b/1024/1024/1024}')"
  if (( size_gb_num >= MAX_TABLE_GB )); then
    log "WARN: $t sigue en ${size_gb_num}G >= ${MAX_TABLE_GB}G → TRUNCATE"
    # Parar analytics un momento reduce errores de escritura concurrente
    docker stop "$CONTAINER" >/dev/null 2>&1 || true
    psql_analytics -c "TRUNCATE TABLE _analytics.\"$t\" RESTART IDENTITY CASCADE;"
    docker start "$CONTAINER" >/dev/null 2>&1 || true
  fi
done

# audit_events: retención
if [[ "$DRY_RUN" != "1" ]]; then
  deleted_audit="$(psql_app -Atc "
    WITH d AS (
      DELETE FROM public.audit_events
      WHERE created_at < now() - interval '$AUDIT_RETENTION_DAYS days'
      RETURNING 1
    )
    SELECT count(*) FROM d;
  ")"
  log "Deleted old audit_events: $deleted_audit"
fi

# Compactación ligera (no FULL, no bloquea tanto)
if [[ "$DRY_RUN" != "1" ]]; then
  psql_analytics -c "VACUUM (ANALYZE) _analytics.log_events_7e8bcedd_ae07_4b9c_af70_ee7dbaf8e690;" >/dev/null 2>&1 || true
  psql_app -c "VACUUM (ANALYZE) public.audit_events;" >/dev/null 2>&1 || true
fi

df -h / | awk 'NR==1 || /\/$/'
log "Fin OK"
