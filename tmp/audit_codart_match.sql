SELECT COUNT(DISTINCT upper(btrim(fl.codart::text))) AS faclin_codes
FROM legacy.faclin fl
JOIN legacy.faccab fc ON fl.numfac=fc.numfac AND fl.serfac=fc.serfac
WHERE fc.serfac='A' AND fc.fecfac>='2026-05-01' AND fc.fecfac<'2026-06-01';

SELECT COUNT(*) FROM articles a
WHERE a.company_id='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND (a.billing_company_id='816af484-92a0-4f65-a5a7-1c907aa4bb3d'
    OR a.familia IN (SELECT name FROM article_families WHERE billing_company_id='816af484-92a0-4f65-a5a7-1c907aa4bb3d'));

SELECT upper(btrim(fl.codart::text)) cod, COUNT(*)
FROM legacy.faclin fl
JOIN legacy.faccab fc ON fl.numfac=fc.numfac AND fl.serfac=fc.serfac
WHERE fc.fecfac>='2026-05-01' AND fc.fecfac<'2026-06-01' AND fc.serfac='A'
GROUP BY 1 ORDER BY 2 DESC LIMIT 8;
