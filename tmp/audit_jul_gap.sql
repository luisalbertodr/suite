-- Facturas julio 2026 en faccab (serie A) no presentes en invoices por número canónico
WITH style AS (
  SELECT
    trim(serfac) AS ser,
    trim(numfac) AS num,
    totfac::numeric AS tot,
    fecfac
  FROM legacy.faccab
  WHERE ejefac = '2026'
    AND serfac = 'A'
    AND fecfac >= '2026-07-01'
    AND fecfac < '2026-08-01'
)
SELECT s.ser, s.num, s.tot, s.fecfac,
  i.id IS NOT NULL AS in_suite,
  i.number,
  i.status,
  i.total
FROM style s
LEFT JOIN public.invoices i
  ON i.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
 AND (
   i.number IN ('A-' || s.num, 'A-2026-' || s.num)
   OR i.number = s.ser || '-' || s.num
 )
ORDER BY s.num::int;

SELECT round(sum(s.tot)::numeric, 2) AS faccab_jul,
       round(sum(CASE WHEN i.id IS NOT NULL THEN s.tot ELSE 0 END)::numeric, 2) AS matched_tot,
       count(*) AS faccab_cnt,
       count(i.id) AS matched_cnt
FROM (
  SELECT trim(numfac) AS num, totfac::numeric AS tot
  FROM legacy.faccab
  WHERE ejefac = '2026' AND serfac = 'A'
    AND fecfac >= '2026-07-01' AND fecfac < '2026-08-01'
) s
LEFT JOIN public.invoices i
  ON i.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
 AND i.number IN ('A-' || s.num, 'A-2026-' || s.num);
