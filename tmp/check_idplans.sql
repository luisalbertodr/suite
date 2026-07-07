SELECT legacy_idplan, client_name, appointment_date, start_time, status, company_id
FROM public.agenda_appointments
WHERE legacy_idplan IN ('112223', '112225', '112222')
ORDER BY legacy_idplan;

SELECT last_cola_id, last_outbound_ok_at, last_error, agent_version
FROM dunasoft.style_sync_agent_state
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';

-- Simular creación Style→Suite (idplan ficticio de prueba si hace falta)
SELECT public.resolve_agenda_employee_for_dunasoft_codemp(
  '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid, '10'
) IS NOT NULL AS resolve_ok;
