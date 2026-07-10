-- Muestra de style_key y codemp en facturas jul 2026
SELECT
  i.number,
  m.style_key,
  split_part(m.style_key, '/', 1) AS p1,
  split_part(m.style_key, '/', 2) AS p2,
  split_part(m.style_key, '/', 3) AS p3,
  split_part(m.style_key, '/', 4) AS p4,
  split_part(m.style_key, '/', 5) AS p5,
  split_part(m.style_key, '/', 6) AS p6,
  i.total_amount
FROM public.invoices i
JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id AND m.entity_type = 'invoice'
WHERE i.issue_date BETWEEN '2026-07-01' AND '2026-07-10'
  AND m.company_id = dunasoft.style_sync_hub_company_id()
LIMIT 15;

SELECT dunasoft_codemp, name FROM public.agenda_employees
WHERE company_id = dunasoft.style_sync_hub_company_id()
ORDER BY name LIMIT 20;
