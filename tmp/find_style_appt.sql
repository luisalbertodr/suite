SELECT idplan, fecha, horini, horfin, texto, nomcli, codemp
FROM dunasoft.plan2009
WHERE fecha = '2026-07-06' AND horini LIKE '10:4%'
ORDER BY idplan DESC
LIMIT 10;

SELECT idplan, fecha, horini, texto
FROM dunasoft.plan2009
WHERE lower(texto) LIKE '%style%'
ORDER BY idplan DESC
LIMIT 10;

SELECT legacy_idplan, client_name, appointment_date, start_time, description
FROM public.agenda_appointments
WHERE appointment_date = '2026-07-06' AND start_time LIKE '10:4%'
ORDER BY legacy_idplan DESC
LIMIT 10;
