\pset format aligned

\echo '=== issue_date vs fecfac (legacy faccab ene-may 2026) ==='
SELECT to_char(i.issue_date, 'YYYY-MM') AS issue_ym,
       to_char(f.fecfac::date, 'YYYY-MM') AS fecfac_ym,
       count(*) AS n,
       round(sum(i.total_amount)::numeric, 2) AS suite_total
FROM public.invoices i
JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id AND m.entity_type = 'invoice'
JOIN legacy.faccab f ON btrim(f.serfac::text) = 'A'
  AND btrim(f.numfac::text) = split_part(m.style_key, '/', 3)
  AND btrim(f.ejefac::text) = '2026'
WHERE m.style_key LIKE '2026/A/%'
  AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada')
  AND f.fecfac >= '2026-01-01' AND f.fecfac < '2026-06-01'
GROUP BY 1, 2
ORDER BY 1, 2;

\echo '=== Facturación por fecfac (legacy) vs issue_date (Suite) mensual ==='
WITH fac AS (
  SELECT to_char(fecfac::date,'YYYY-MM') ym, round(sum(coalesce(nullif(regexp_replace(btrim(totfac::text),',','.','g'),'')::numeric,0))::numeric,2) t
  FROM legacy.faccab WHERE serfac='A' AND fecfac>='2026-01-01' AND fecfac<'2026-07-01'
    AND upper(btrim(coalesce(anulada,''))) NOT IN ('S','SI','1','T','TRUE','Y','YES','X')
  GROUP BY 1
),
inv_issue AS (
  SELECT to_char(i.issue_date,'YYYY-MM') ym, round(sum(i.total_amount)::numeric,2) t
  FROM public.invoices i
  JOIN dunasoft.style_sync_entity_map m ON m.suite_id=i.id AND m.entity_type='invoice'
  WHERE m.style_key LIKE '2026/%' AND i.issue_date>='2026-01-01' AND i.issue_date<'2026-07-01'
    AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada')
  GROUP BY 1
),
inv_fecfac AS (
  SELECT to_char(f.fecfac::date,'YYYY-MM') ym, round(sum(i.total_amount)::numeric,2) t
  FROM public.invoices i
  JOIN dunasoft.style_sync_entity_map m ON m.suite_id=i.id AND m.entity_type='invoice'
  JOIN legacy.faccab f ON btrim(f.numfac::text)=split_part(m.style_key,'/',3) AND btrim(f.serfac::text)='A' AND btrim(f.ejefac::text)='2026'
  WHERE m.style_key LIKE '2026/A/%'
    AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada')
  GROUP BY 1
)
SELECT coalesce(f.ym, ii.ym, ifc.ym) AS ym,
       f.t AS faccab_fecfac,
       ii.t AS suite_issue_date,
       ifc.t AS suite_on_faccab_month,
       round(coalesce(ii.t,0)-coalesce(f.t,0),2) AS diff_issue_vs_faccab
FROM fac f
FULL JOIN inv_issue ii ON ii.ym=f.ym
FULL JOIN inv_fecfac ifc ON ifc.ym=coalesce(f.ym,ii.ym)
ORDER BY 1;

\echo '=== RPC mensual vs faccab fecfac ==='
SELECT r.month_num, round(r.total::numeric,2) rpc,
       f.t faccab,
       round(r.total::numeric - coalesce(f.t,0),2) diff
FROM dashboard_billing_monthly('816af484-92a0-4f65-a5a7-1c907aa4bb3d', 2026) r
LEFT JOIN (
  SELECT extract(month from fecfac::date)::int m,
         round(sum(coalesce(nullif(regexp_replace(btrim(totfac::text),',','.','g'),'')::numeric,0))::numeric,2) t
  FROM legacy.faccab WHERE serfac='A' AND fecfac>='2026-01-01' AND fecfac<'2026-08-01'
    AND upper(btrim(coalesce(anulada,''))) NOT IN ('S','SI','1','T','TRUE','Y','YES','X')
  GROUP BY 1
) f ON f.m = r.month_num
ORDER BY 1;
