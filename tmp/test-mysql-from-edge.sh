#!/bin/bash
set -e
echo "=== networks edge ==="
docker inspect supabase-edge-functions --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{$v.IPAddress}}{{"\n"}}{{end}}'
echo "=== tcp 192.168.99.110:3306 from edge ==="
docker exec supabase-edge-functions sh -c 'command -v nc >/dev/null && nc -zv -w 2 192.168.99.110 3306 || (timeout 2 bash -c "echo >/dev/tcp/192.168.99.110/3306" && echo tcp_ok) || echo tcp_fail'
echo "=== tcp host gateway ==="
GW=$(docker inspect supabase-edge-functions --format '{{range .NetworkSettings.Networks}}{{.Gateway}}{{end}}' | awk '{print $1}')
echo "gateway=$GW"
docker exec supabase-edge-functions sh -c "timeout 2 bash -c 'echo >/dev/tcp/$GW/3306' && echo tcp_ok || echo tcp_fail"
echo "=== mysql query via host ==="
docker run --rm --network host mysql:8.0 mysql -h127.0.0.1 -uroot -pLip0cer0 -N -e 'SELECT COUNT(*) FROM smartpss_events.AttendanceRecordInfo' 2>/dev/null | tail -1
