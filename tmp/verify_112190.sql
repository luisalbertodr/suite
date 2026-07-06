SELECT idplan, fecha, horini, horfin, codemp, nomcli
FROM dunasoft.plan2009
WHERE idplan = 112190;

SELECT appointment_date, start_time, end_time, legacy_codemp, client_name
FROM public.agenda_appointments
WHERE legacy_idplan = '112190'
LIMIT 1;
