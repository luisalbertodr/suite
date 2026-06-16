-- field order: which comes first with cuerpo match
SELECT 
  (field_data::jsonb->0->>'name') AS first_field,
  (field_data::jsonb->1->>'name') AS second_field
FROM marketing_leads l
JOIN meta_forms mf ON mf.id = l.meta_form_id
WHERE l.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND mf.form_name = 'Body Sculpt'
  AND l.field_data::text ILIKE '%abdomen%'
LIMIT 10;
