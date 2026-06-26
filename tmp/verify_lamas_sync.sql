SELECT c.name, sc.tabla, sc.enabled
FROM dunasoft.style_sync_cursor sc
JOIN public.companies c ON c.id = sc.company_id
WHERE sc.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
ORDER BY sc.tabla;
