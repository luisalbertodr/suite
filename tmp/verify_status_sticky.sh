#!/bin/bash
# Esperar un engine.event y comprobar que last_status sigue WORKING
sleep 8
docker exec -i supabase-db psql -U postgres -c "SELECT last_status, last_status_at FROM whatsapp_config;"
docker logs --since 2m waha-worker-1 2>&1 | grep -c 'engine.event' || true
docker logs --since 2m waha-worker-1 2>&1 | grep 'event\":\"engine.event\"' | tail -3
