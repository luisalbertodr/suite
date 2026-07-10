\pset format aligned

\echo '=== Duplicados: A-N sin año + A-2026-N mismo numfac (activos) ==='
WITH maps AS (
  SELECT m.suite_id,
         split_part(m.style_key, '/', 3) AS numfac,
         split_part(m.style_key, '/', 4) AS codcli,
         i.number,
         i.company_id,
         i.total_amount,
         i.issue_date
  FROM dunasoft.style_sync_entity_map m
  JOIN public.invoices i ON i.id = m.suite_id
  WHERE m.entity_type = 'invoice'
    AND m.style_key LIKE '2026/A/%'
    AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
),
short_fmt AS (
  SELECT * FROM maps WHERE number ~ '^A-[0-9]+$'
),
long_fmt AS (
  SELECT * FROM maps WHERE number ~ '^A-2026-[0-9]+'
)
SELECT s.numfac,
       s.number AS short_number,
       round(s.total_amount::numeric, 2) AS short_amt,
       l.number AS long_number,
       round(l.total_amount::numeric, 2) AS long_amt,
       round((s.total_amount + l.total_amount)::numeric, 2) AS doubled
FROM short_fmt s
JOIN long_fmt l ON l.numfac = s.numfac AND l.codcli = s.codcli
ORDER BY doubled DESC
LIMIT 25;

\echo '=== Total inflado por duplicados A-N + A-2026-N ==='
WITH pairs AS (
  SELECT s.total_amount + l.total_amount AS doubled, s.numfac
  FROM (
    SELECT split_part(m.style_key, '/', 3) numfac, split_part(m.style_key, '/', 4) codcli,
           i.total_amount, i.number
    FROM dunasoft.style_sync_entity_map m JOIN invoices i ON i.id=m.suite_id
    WHERE m.style_key LIKE '2026/A/%' AND i.number ~ '^A-[0-9]+$'
      AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada')
  ) s
  JOIN (
    SELECT split_part(m.style_key, '/', 3) numfac, split_part(m.style_key, '/', 4) codcli,
           i.total_amount, i.number
    FROM dunasoft.style_sync_entity_map m JOIN invoices i ON i.id=m.suite_id
    WHERE m.style_key LIKE '2026/A/%' AND i.number ~ '^A-2026-[0-9]+$'
      AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada')
  ) l ON l.numfac=s.numfac AND l.codcli=s.codcli
)
SELECT count(*) AS pairs, round(sum(doubled)::numeric, 2) AS sum_both,
       round(sum(doubled / 2)::numeric, 2) AS excess_vs_one
FROM pairs;
