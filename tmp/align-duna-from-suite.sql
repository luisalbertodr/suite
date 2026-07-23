-- Alinear dunasoft.clientes con el split de Suite (mejor encoding/acentos)
UPDATE dunasoft.clientes d
SET
  nomcli = sp.nomcli,
  ape1cli = sp.ape1cli,
  pais = CASE
    WHEN public.repair_customer_text(coalesce(c.address_country, d.pais)) ~* '^espa' THEN 'España'
    ELSE coalesce(nullif(public.repair_customer_text(c.address_country), ''), d.pais)
  END
FROM public.customers c
CROSS JOIN LATERAL public.split_customer_display_name(c.name) sp
WHERE c.company_id IS NOT NULL
  AND (
    btrim(c.legacy_codcli) = btrim(d.codcli)
    OR ltrim(btrim(c.legacy_codcli), '0') = ltrim(btrim(d.codcli), '0')
  )
  AND nullif(btrim(c.name), '') IS NOT NULL
  AND sp.nomcli IS NOT NULL
  AND (
    d.nomcli IS DISTINCT FROM sp.nomcli
    OR coalesce(d.ape1cli, '') IS DISTINCT FROM coalesce(sp.ape1cli, '')
    OR coalesce(d.pais, '') ILIKE '%C1%'
  );

SELECT codcli, nomcli, ape1cli, pais
FROM dunasoft.clientes
WHERE codcli = '000330';

SELECT count(*) AS still_pending
FROM dunasoft.style_sync_outbox
WHERE entity_type = 'customer' AND delivered_at IS NULL;
