SELECT id, number, issue_date, total_amount, status
FROM public.invoices
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND number IN ('A-1475','A-1476','A-1478','A-1479','A-1511')
ORDER BY issue_date;
