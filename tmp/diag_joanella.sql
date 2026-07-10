\pset format aligned
\pset null '(null)'

\echo '=== LEAD ==='
SELECT id, first_name, last_name, phone, email, customer_id, stage_id, value,
       external_created_at::date AS lead_date, company_id
FROM marketing_leads
WHERE phone ILIKE '%642757330%' OR first_name ILIKE '%Joanella%'
ORDER BY created_at DESC LIMIT 3;

\echo '=== STAGE ==='
SELECT s.id, s.name
FROM marketing_leads ml
JOIN marketing_lead_stages s ON s.id = ml.stage_id
WHERE ml.phone ILIKE '%642757330%' OR ml.first_name ILIKE '%Joanella%'
LIMIT 1;

\echo '=== PRESENTADA STAGE ==='
SELECT id, name FROM marketing_lead_stages
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND lower(name) LIKE '%presentada%';

\echo '=== CUSTOMERS ==='
SELECT id, company_id, name, phone, phone_mobile, email
FROM customers
WHERE regexp_replace(COALESCE(phone,'') || COALESCE(phone_mobile,'') || COALESCE(phone_home,''), '[^0-9]', '', 'g') LIKE '%642757330%';

\echo '=== INVOICES (matched customers) ==='
SELECT i.id, i.company_id, i.issue_date, i.total_amount, i.status, i.number, i.customer_id
FROM invoices i
JOIN customers c ON c.id = i.customer_id
WHERE regexp_replace(COALESCE(c.phone,'') || COALESCE(c.phone_mobile,'') || COALESCE(c.phone_home,''), '[^0-9]', '', 'g') LIKE '%642757330%'
  AND i.status IS DISTINCT FROM 'cancelled'
ORDER BY i.issue_date;

\echo '=== APPOINTMENT SALES ==='
SELECT s.id, s.company_id, s.created_at::date AS charged_on, s.total_amount, s.appointment_id, s.invoice_id, s.customer_id
FROM sales s
WHERE s.status = 'completed' AND s.appointment_id IS NOT NULL
  AND (
    s.customer_id IN (
      SELECT id FROM customers
      WHERE regexp_replace(COALESCE(phone,'') || COALESCE(phone_mobile,'') || COALESCE(phone_home,''), '[^0-9]', '', 'g') LIKE '%642757330%'
    )
    OR s.appointment_id IN (
      SELECT a.id FROM agenda_appointments a
      JOIN customers c ON c.id = a.customer_id
      WHERE regexp_replace(COALESCE(c.phone,'') || COALESCE(c.phone_mobile,'') || COALESCE(c.phone_home,''), '[^0-9]', '', 'g') LIKE '%642757330%'
    )
  )
ORDER BY s.created_at;

\echo '=== APPOINTMENTS ==='
SELECT a.id, a.company_id, a.start_time::date, a.title, a.client_name, a.customer_id, a.status
FROM agenda_appointments a
LEFT JOIN customers c ON c.id = a.customer_id
WHERE a.client_name ILIKE '%Joanella%' OR a.title ILIKE '%Joanella%'
   OR regexp_replace(COALESCE(c.phone,'') || COALESCE(c.phone_mobile,'') || COALESCE(c.phone_home,''), '[^0-9]', '', 'g') LIKE '%642757330%'
ORDER BY a.start_time DESC LIMIT 15;
