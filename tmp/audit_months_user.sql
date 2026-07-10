\pset format aligned

\echo '=== 1. Dashboard medicina (Delgado Lamas) por mes ==='
WITH med AS (
  SELECT 2025 AS yr, month_num, round(total::numeric,2) AS medicina
  FROM dashboard_billing_monthly_split(2025)
  WHERE company_id='816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
  UNION ALL
  SELECT 2026, month_num, round(total::numeric,2)
  FROM dashboard_billing_monthly_split(2026)
  WHERE company_id='816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
),
est AS (
  SELECT 2025 AS yr, month_num, round(total::numeric,2) AS estetica
  FROM dashboard_billing_monthly_split(2025)
  WHERE company_id='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
  UNION ALL
  SELECT 2026, month_num, round(total::numeric,2)
  FROM dashboard_billing_monthly_split(2026)
  WHERE company_id='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
)
SELECT m.yr, m.month_num,
       m.medicina, e.estetica,
       round(m.medicina + e.estetica, 2) AS total_mes
FROM med m JOIN est e USING (yr, month_num)
ORDER BY 1, 2;

\echo '=== 2. Abr/Mar/Feb 2026: hoja usuario vs Suite (por numfac) ==='
WITH hub AS (SELECT dunasoft.style_sync_hub_company_id() AS id),
nums(ym, numfac) AS (
  VALUES
  ('2026-04',611),('2026-04',623),('2026-04',625),('2026-04',647),('2026-04',671),('2026-04',688),
  ('2026-04',717),('2026-04',718),('2026-04',707),('2026-04',714),('2026-04',702),('2026-04',708),
  ('2026-04',713),('2026-04',716),('2026-04',745),('2026-04',764),('2026-04',762),('2026-04',756),
  ('2026-04',759),('2026-04',755),('2026-04',758),('2026-04',765),('2026-04',775),('2026-04',769),
  ('2026-04',778),('2026-04',827),('2026-04',821),('2026-04',824),('2026-04',820),('2026-04',819),
  ('2026-04',856),('2026-04',862),('2026-04',859),('2026-04',861),('2026-04',870),('2026-04',867),
  ('2026-04',879),('2026-04',875),
  ('2026-03',384),('2026-03',385),('2026-03',386),('2026-03',387),('2026-03',390),('2026-03',404),
  ('2026-03',407),('2026-03',410),('2026-03',413),('2026-03',428),('2026-03',461),('2026-03',479),
  ('2026-03',485),('2026-03',488),('2026-03',489),('2026-03',491),('2026-03',492),('2026-03',493),
  ('2026-03',494),('2026-03',518),('2026-03',519),('2026-03',522),('2026-03',524),('2026-03',526),
  ('2026-03',538),('2026-03',541),('2026-03',542),('2026-03',544),('2026-03',545),('2026-03',580),
  ('2026-03',584),('2026-03',588),('2026-03',598),
  ('2026-02',212),('2026-02',213),('2026-02',215),('2026-02',217),('2026-02',219),('2026-02',224),
  ('2026-02',229),('2026-02',232),('2026-02',235),('2026-02',241),('2026-02',246),('2026-02',247),
  ('2026-02',248),('2026-02',251),('2026-02',301),('2026-02',302),('2026-02',304),('2026-02',306),
  ('2026-02',309),('2026-02',312),('2026-02',316),('2026-02',346),('2026-02',347),('2026-02',354),
  ('2026-02',360),('2026-02',363),('2026-02',367),('2026-02',372),('2026-02',375)
),
per_inv AS (
  SELECT n.ym, n.numfac,
         round(coalesce(nullif(regexp_replace(btrim(f.totfac::text), ',', '.', 'g'), '')::numeric,0)::numeric,2) AS totfac,
         round(sum(coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric,0)) FILTER (
           WHERE dashboard_resolve_line_billing_company_id(btrim(fl.desart::text), hub.id)='816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
         )::numeric,2) AS legacy_med,
         round(sum(coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric,0)) FILTER (
           WHERE dashboard_resolve_line_billing_company_id(btrim(fl.desart::text), hub.id)='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
         )::numeric,2) AS legacy_est
  FROM nums n
  JOIN legacy.faccab f ON f.serfac='A' AND f.numfac=n.numfac::text
    AND to_char(f.fecfac::date,'YYYY-MM')=n.ym
  JOIN legacy.faclin fl ON fl.numfac=f.numfac AND fl.serfac=f.serfac AND fl.ejefac=f.ejefac
  CROSS JOIN hub
  GROUP BY n.ym, n.numfac, f.totfac
),
suite_inv AS (
  SELECT to_char(i.issue_date,'YYYY-MM') AS ym,
         (regexp_match(m.style_key, '/A/([0-9]+)/'))[1]::int AS numfac,
         round(sum(ii.total_price) FILTER (
           WHERE dashboard_resolve_line_billing_company_id(ii.description, dunasoft.style_sync_hub_company_id())='816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
         )::numeric,2) AS suite_med,
         i.id IS NOT NULL AS synced
  FROM nums n
  LEFT JOIN dunasoft.style_sync_entity_map m ON m.entity_type='invoice' AND m.style_key LIKE '2026/A/'||n.numfac::text||'/%'
  LEFT JOIN invoices i ON i.id=m.suite_id AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada')
  LEFT JOIN invoice_items ii ON ii.invoice_id=i.id
  GROUP BY 1,2, i.id
)
SELECT p.ym,
       count(*) AS facturas_hoja,
       round(sum(p.totfac)::numeric,2) AS suma_totfac_hoja,
       round(sum(p.legacy_med)::numeric,2) AS suma_med_legacy,
       round(sum(coalesce(s.suite_med,0))::numeric,2) AS suma_med_suite,
       count(*) FILTER (WHERE s.synced IS NOT TRUE) AS sin_sync,
       count(*) FILTER (WHERE p.legacy_med > 0 AND coalesce(s.suite_med,0)=0) AS med_sin_suite,
       count(*) FILTER (WHERE p.legacy_med=0 AND p.totfac>0) AS totfac_clasif_estetica
FROM per_inv p
LEFT JOIN suite_inv s ON s.ym=p.ym AND s.numfac=p.numfac
GROUP BY p.ym ORDER BY p.ym;

\echo '=== 3. Detalle: facturas hoja con medicina NO en Suite ==='
WITH hub AS (SELECT dunasoft.style_sync_hub_company_id() AS id),
nums(ym, numfac) AS (
  VALUES ('2026-04',611),('2026-04',623),('2026-04',625),('2026-04',647),('2026-04',671),('2026-04',688),
  ('2026-04',718),('2026-04',707),('2026-04',702),('2026-04',716),('2026-04',764),('2026-04',762),
  ('2026-04',758),('2026-04',765),('2026-04',775),('2026-04',769),('2026-04',778),('2026-04',824),
  ('2026-04',820),('2026-04',819),('2026-04',856),('2026-04',861),('2026-04',870),('2026-04',867),
  ('2026-04',879),('2026-04',875),
  ('2026-03',384),('2026-03',385),('2026-03',386),('2026-03',390),('2026-03',428),('2026-03',461),
  ('2026-03',479),('2026-03',492),('2026-03',518),('2026-03',542),('2026-03',544),('2026-03',545),
  ('2026-02',212),('2026-02',235),('2026-02',363),('2026-02',367)
),
leg AS (
  SELECT n.ym, n.numfac, f.fecfac::date,
         round(sum(coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric,0)) FILTER (
           WHERE dashboard_resolve_line_billing_company_id(btrim(fl.desart::text), hub.id)='816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
         )::numeric,2) AS med,
         string_agg(DISTINCT left(btrim(fl.desart::text),28), ' | ') FILTER (
           WHERE dashboard_resolve_line_billing_company_id(btrim(fl.desart::text), hub.id)='816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
         ) AS servicios
  FROM nums n
  JOIN legacy.faccab f ON f.serfac='A' AND f.numfac=n.numfac::text
  JOIN legacy.faclin fl ON fl.numfac=f.numfac AND fl.serfac=f.serfac
  CROSS JOIN hub
  GROUP BY n.ym, n.numfac, f.fecfac
  HAVING sum(coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric,0)) FILTER (
    WHERE dashboard_resolve_line_billing_company_id(btrim(fl.desart::text), hub.id)='816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
  ) > 0
)
SELECT l.*, i.issue_date::date AS suite_date,
       CASE WHEN i.id IS NULL THEN 'NO SYNC' ELSE 'OK' END AS estado
FROM leg l
LEFT JOIN dunasoft.style_sync_entity_map m ON m.style_key LIKE '%/A/'||l.numfac||'/%' AND m.entity_type='invoice'
LEFT JOIN invoices i ON i.id=m.suite_id
WHERE i.id IS NULL
ORDER BY l.ym, l.numfac
LIMIT 30;

\echo '=== 4. Enero 2026: medicina legacy mes completo vs dashboard ==='
WITH hub AS (SELECT dunasoft.style_sync_hub_company_id() AS id)
SELECT
  round(sum(coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric,0)) FILTER (
    WHERE dashboard_resolve_line_billing_company_id(btrim(fl.desart::text), hub.id)='816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
  )::numeric,2) AS legacy_med_ene,
  (SELECT round(total::numeric,2) FROM dashboard_billing_monthly_split(2026)
   WHERE month_num=1 AND company_id='816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid) AS dashboard_med_ene
FROM legacy.faccab f
JOIN legacy.faclin fl ON fl.numfac=f.numfac AND fl.serfac=f.serfac
CROSS JOIN hub
WHERE f.serfac='A' AND f.fecfac>='2026-01-01' AND f.fecfac<'2026-02-01';

\echo '=== 5. Dic 2025 / Nov / Oct / Sep: legacy medicina mes completo ==='
WITH hub AS (SELECT dunasoft.style_sync_hub_company_id() AS id),
months AS (SELECT * FROM (VALUES ('2025-09'),('2025-10'),('2025-11'),('2025-12')) v(ym))
SELECT m.ym,
       round(sum(coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric,0)) FILTER (
         WHERE dashboard_resolve_line_billing_company_id(btrim(fl.desart::text), hub.id)='816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
       )::numeric,2) AS legacy_med,
       (SELECT round(s.total::numeric,2) FROM dashboard_billing_monthly_split(2025) s
        WHERE s.company_id='816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
          AND s.month_key=m.ym) AS dashboard_med,
       count(DISTINCT f.numfac) FILTER (
         WHERE EXISTS (
           SELECT 1 FROM legacy.faclin fl2
           WHERE fl2.numfac=f.numfac AND fl2.serfac=f.serfac
             AND dashboard_resolve_line_billing_company_id(btrim(fl2.desart::text), hub.id)='816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
         )
       ) AS facturas_con_med
FROM months m
JOIN legacy.faccab f ON f.serfac='A' AND to_char(f.fecfac::date,'YYYY-MM')=m.ym
JOIN legacy.faclin fl ON fl.numfac=f.numfac AND fl.serfac=f.serfac
CROSS JOIN hub
GROUP BY m.ym ORDER BY m.ym;

\echo '=== 6. Abr 2026: totfac hoja vs clasificación línea (muestra discrepancias) ==='
WITH hub AS (SELECT dunasoft.style_sync_hub_company_id() AS id),
nums AS (SELECT unnest(ARRAY[611,623,625,647,671,688,718,707,702,716,764,762,758,765,775,769,778,824,820,819,856,861,870,867,879,875]) AS numfac)
SELECT f.numfac, f.fecfac::date,
       round(coalesce(nullif(regexp_replace(btrim(f.totfac::text), ',', '.', 'g'), '')::numeric,0)::numeric,2) AS totfac,
       round(sum(coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric,0)) FILTER (
         WHERE dashboard_resolve_line_billing_company_id(btrim(fl.desart::text), hub.id)='816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
       )::numeric,2) AS med,
       round(sum(coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric,0)) FILTER (
         WHERE dashboard_resolve_line_billing_company_id(btrim(fl.desart::text), hub.id)='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
       )::numeric,2) AS est,
       left(min(fl.desart::text) FILTER (WHERE coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric,0) <> 0), 30) AS servicio
FROM legacy.faccab f
JOIN legacy.faclin fl ON fl.numfac=f.numfac AND fl.serfac=f.serfac
CROSS JOIN hub
WHERE f.serfac='A' AND f.numfac IN (SELECT numfac::text FROM nums)
  AND f.fecfac>='2026-04-01' AND f.fecfac<'2026-05-01'
GROUP BY f.numfac, f.fecfac, f.totfac
HAVING round(coalesce(nullif(regexp_replace(btrim(f.totfac::text), ',', '.', 'g'), '')::numeric,0)::numeric,2) > 0
ORDER BY f.numfac::int;
