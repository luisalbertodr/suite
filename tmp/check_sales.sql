SELECT count(*) AS total FROM sales WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND status = 'completed' AND appointment_id IS NOT NULL AND invoice_id IS NOT NULL;
SELECT count(*) AS sin_customer FROM sales WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND status = 'completed' AND appointment_id IS NOT NULL AND invoice_id IS NOT NULL AND customer_id IS NULL;
