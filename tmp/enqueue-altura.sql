-- Encolar push Style solo para clientes con altura conocida
INSERT INTO dunasoft.style_sync_outbox (
  company_id, entity_type, operation, style_key, suite_id, payload
)
SELECT
  c.company_id,
  'customer',
  'update',
  c.legacy_codcli,
  c.id,
  jsonb_build_object(
    'codcli', c.legacy_codcli,
    'nomcli', coalesce(sp.nomcli, ''),
    'ape1cli', coalesce(sp.ape1cli, ''),
    'tel1cli', coalesce(c.phone_home, c.phone, ''),
    'tel2cli', coalesce(c.phone_mobile, ''),
    'email', coalesce(c.email, ''),
    'dnicli', coalesce(c.tax_id, ''),
    'dircli', coalesce(public.repair_customer_text(c.address_street), ''),
    'codposcli', coalesce(c.address_postal_code, ''),
    'pobcli', coalesce(public.repair_customer_text(c.address_city), ''),
    'procli', coalesce(public.repair_customer_text(c.address_state), ''),
    'pais', coalesce(public.repair_customer_text(c.address_country), ''),
    'percon', coalesce(public.repair_customer_text(c.contact_person), ''),
    'obscli', coalesce(public.repair_customer_text(c.notes), ''),
    'fecnac', coalesce(to_char(c.birth_date, 'YYYY-MM-DD'), ''),
    'altura', round(c.height_cm)::int
  )
FROM public.customers c
CROSS JOIN LATERAL public.split_customer_display_name(c.name) sp
WHERE c.company_id IS NOT NULL
  AND c.height_cm IS NOT NULL
  AND c.height_cm BETWEEN 100 AND 230
  AND nullif(btrim(c.legacy_codcli), '') IS NOT NULL
  AND btrim(c.legacy_codcli) <> '0'
  AND dunasoft.suite_to_style_enabled('clientes');

SELECT c.legacy_codcli, c.name, c.height_cm, d.altura
FROM public.customers c
JOIN dunasoft.clientes d ON btrim(d.codcli) = btrim(c.legacy_codcli)
WHERE c.height_cm IS NOT NULL OR d.altura IS NOT NULL
ORDER BY c.height_cm DESC NULLS LAST
LIMIT 15;
