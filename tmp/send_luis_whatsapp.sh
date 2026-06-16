#!/bin/bash
set -e
API_KEY=$(docker exec supabase-db psql -U postgres -d postgres -t -A -c "SELECT api_key FROM whatsapp_config WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' LIMIT 1")
curl -s -w "
HTTP:%{http_code}
" -X POST "http://192.168.99.110:3333/api/sendText" -H "Content-Type: application/json" -H "X-Api-Key: ${API_KEY}" -d '{"session":"default","chatId":"34667435503@c.us","text":"Gracias Luis A. Hemos recibido tu senal de 10 euros. Tu cita en Lipoout queda confirmada."}'
