\pset format aligned

\echo '=== ALL SALES FOR CUSTOMER ==='
SELECT s.id, s.company_id, s.created_at::date, s.status, s.total_amount, s.appointment_id, s.invoice_id, s.customer_id, left(s.notes, 80) AS notes
FROM sales s
WHERE s.customer_id = 'fdefad63-3062-4085-9c15-9effc3e4c3ff'
ORDER BY s.created_at;

\echo '=== SALES BY INVOICE ==='
SELECT s.id, s.appointment_id, s.invoice_id, s.status, s.total_amount, s.created_at::date
FROM sales s
WHERE s.invoice_id IN (
  '114255a4-f1d4-4eac-ba1d-d4705ee3a128',
  'a81759bf-de9d-4667-b92b-908e3472446f'
);

\echo '=== APPOINTMENTS (no title col) ==='
SELECT a.id, a.company_id, a.start_time::date, a.client_name, a.customer_id, a.status, a.description
FROM agenda_appointments a
WHERE a.customer_id = 'fdefad63-3062-4085-9c15-9effc3e4c3ff'
ORDER BY a.start_time DESC LIMIT 10;

\echo '=== APPOINTMENTS BY CLIENT NAME ==='
SELECT a.id, a.company_id, a.start_time::date, a.client_name, a.customer_id, a.status
FROM agenda_appointments a
WHERE a.client_name ILIKE '%Joanella%'
ORDER BY a.start_time DESC LIMIT 10;

\echo '=== INVOICE NOTES ==='
SELECT id, issue_date, total_amount, number, notes
FROM invoices
WHERE customer_id = 'fdefad63-3062-4085-9c15-9effc3e4c3ff';
