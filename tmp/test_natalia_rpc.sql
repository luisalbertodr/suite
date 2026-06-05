WITH inv AS (
  SELECT i.id, i.total_amount, i.paid_status, i.status, i.notes, i.issue_date,
    (substring(i.notes FROM '"key":\s*"([^"]+)"')) AS fac_key_json
  FROM public.invoices i
  WHERE i.customer_id = '2b78dcce-19a2-45be-9b00-a05026178f2c'::uuid
    AND i.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
    AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada', 'paid')
    AND NOT (
      i.notes LIKE 'Factura legacy automática%'
      AND EXISTS (
        SELECT 1 FROM public.invoices i2
        WHERE i2.customer_id = i.customer_id
          AND i2.company_id = i.company_id
          AND i2.issue_date = i.issue_date
          AND i2.notes LIKE 'Legacy FACCAB rebuild%'
      )
    )
)
SELECT number, total_amount, notes, fac_key_json FROM inv i
JOIN public.invoices x ON x.id = i.id;
