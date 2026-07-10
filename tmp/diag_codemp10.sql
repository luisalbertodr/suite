-- sales linked to july invoices
SELECT s.id, s.invoice_id, s.appointment_id, s.total_amount, aa.employee_id, ae.name, ae.dunasoft_codemp
FROM public.sales s
JOIN public.invoices i ON i.id = s.invoice_id
LEFT JOIN public.agenda_appointments aa ON aa.id = s.appointment_id
LEFT JOIN public.agenda_employees ae ON ae.id = aa.employee_id
WHERE i.issue_date BETWEEN '2026-07-01' AND '2026-07-10'
LIMIT 15;

SELECT count(*) FROM public.sales s
JOIN public.invoices i ON i.id = s.invoice_id
WHERE i.issue_date BETWEEN '2026-07-01' AND '2026-07-10';

-- plan2009 facturado jul - sales by codemp
SELECT p.codemp, coalesce(ae.name, 'Empleada '||p.codemp) AS name,
  count(*) AS citas,
  round(sum(coalesce(nullif(regexp_replace(btrim(p.importe::text),',','.','g'),'')::numeric,0))::numeric,2) AS importe
FROM dunasoft.plan2009 p
LEFT JOIN public.agenda_employees ae ON ae.company_id = dunasoft.style_sync_hub_company_id()
  AND coalesce(nullif(ltrim(btrim(coalesce(ae.dunasoft_codemp,'')),'0'),''),'0')
    = coalesce(nullif(ltrim(btrim(coalesce(p.codemp,'')),'0'),''),'0')
WHERE p.fecha BETWEEN '2026-07-01' AND '2026-07-10' AND p.facturado
GROUP BY 1,2 ORDER BY 4 DESC NULLS LAST;

-- plan2009 columns
SELECT column_name FROM information_schema.columns WHERE table_schema='dunasoft' AND table_name='plan2009'
  AND column_name ILIKE '%import%' OR (table_schema='dunasoft' AND table_name='plan2009' AND column_name IN ('codemp','facturado','importe','precio'));

-- style sync invoice payload?
SELECT column_name FROM information_schema.columns WHERE table_schema='dunasoft' AND table_name='style_sync_entity_map';

-- work_orders?
SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='work_orders'
  AND column_name ILIKE '%emp%';
