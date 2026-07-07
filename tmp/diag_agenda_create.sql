-- Diagnóstico agenda_dual_create / empleados
SELECT ae.company_id, c.name, count(*) AS empleados_activos
FROM public.agenda_employees ae
JOIN public.companies c ON c.id = ae.company_id
WHERE coalesce(ae.is_active, true)
GROUP BY ae.company_id, c.name
ORDER BY count DESC;

SELECT ae.id, ae.name, ae.dunasoft_codemp, ae.company_id
FROM public.agenda_employees ae
WHERE coalesce(ae.is_active, true)
ORDER BY ae.company_id, ae.name
LIMIT 30;

SELECT codemp, nomemp, ape1emp FROM dunasoft.empleados ORDER BY codemp LIMIT 20;

SELECT company_id, sync_enabled FROM public.style_reservas_sync_config;

-- Probar resolve para codemp típicos
SELECT public.resolve_agenda_employee_for_dunasoft_codemp('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid, '09') AS hub_09;
SELECT public.resolve_agenda_employee_for_dunasoft_codemp('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid, '10') AS hub_10;
SELECT public.resolve_agenda_employee_for_dunasoft_codemp('0096e745-3e1b-4c5c-b771-c3747a174911'::uuid, '09') AS other_09;
