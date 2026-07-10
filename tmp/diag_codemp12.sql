SELECT count(*) FROM legacy.faccab WHERE ejefac='2026';
SELECT count(*) FROM legacy.faclin WHERE ejefac='2026';

SELECT max(public.legacy_text_to_date(fecfac)) FROM legacy.faccab WHERE ejefac='2026';

-- Maybe ejefac stored differently
SELECT DISTINCT ejefac FROM legacy.faccab ORDER BY 1 DESC LIMIT 10;

-- Check style sync - invoice items from suite with employee on appointment linked by customer+date
SELECT
  i.id,
  i.number,
  i.total_amount,
  i.customer_id,
  i.issue_date,
  aa.legacy_codemp,
  ae.name
FROM public.invoices i
LEFT JOIN LATERAL (
  SELECT aa2.legacy_codemp, aa2.employee_id
  FROM public.agenda_appointments aa2
  WHERE aa2.customer_id = i.customer_id
    AND aa2.appointment_date = i.issue_date
    AND aa2.status IN ('completed', 'confirmed', 'in_progress')
  ORDER BY aa2.start_time
  LIMIT 1
) aa ON true
LEFT JOIN public.agenda_employees ae ON ae.id::text = aa.employee_id
WHERE i.issue_date BETWEEN '2026-07-01' AND '2026-07-10'
LIMIT 10;
