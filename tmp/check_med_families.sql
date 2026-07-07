SELECT name, billing_company_id::text
FROM article_families
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
ORDER BY name;

SELECT codigo, left(descripcion, 50), familia, billing_company_id::text
FROM articles
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND upper(familia) LIKE '%09%FACIAL%'
  AND (
    upper(descripcion) LIKE '%FOTREJ%'
    OR upper(descripcion) LIKE '%MANCHA%'
    OR upper(descripcion) LIKE '%FOTORREJ%'
  )
ORDER BY codigo;
