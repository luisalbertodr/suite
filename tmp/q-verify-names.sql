SELECT * FROM public.split_customer_display_name('María del Mar Lamas Pernas');
SELECT * FROM public.split_customer_display_name('Ana Lago');
SELECT * FROM public.split_customer_display_name('Pedro');
SELECT * FROM public.split_customer_display_name('CRECE DESARROLLOS E INVERSIONES S.L.');

SELECT legacy_codcli, name, address_country
FROM public.customers WHERE legacy_codcli = '000330';

SELECT codcli, nomcli, ape1cli, pais
FROM dunasoft.clientes WHERE codcli IN ('000330','002950','004428')
ORDER BY codcli;

SELECT count(*) AS outbox_pending_customers
FROM dunasoft.style_sync_outbox
WHERE entity_type = 'customer' AND delivered_at IS NULL;
