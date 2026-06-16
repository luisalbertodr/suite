SELECT DISTINCT jsonb_array_elements(field_data::jsonb)->>'name' AS field_name
FROM marketing_leads l
JOIN meta_forms mf ON mf.id = l.meta_form_id
WHERE l.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND mf.form_name = 'Método Skin Lipoout'
ORDER BY field_name;
