#!/bin/bash
docker exec supabase-db psql -U postgres -d postgres -tAc "select id || ' | ' || name from companies order by name;"
