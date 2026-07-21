SELECT id::text, name, legacy_codcli,
       (SELECT count(*) FROM historial_clinico h WHERE h.customer_id = c.id) AS historiales,
       (SELECT count(*) FROM agenda_appointments a WHERE a.customer_id = c.id) AS citas,
       length(coalesce(c.phone,'')||coalesce(c.email,'')||coalesce(c.tax_id,'')) AS datos_extra
FROM public.customers c
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND (
    ltrim(coalesce(legacy_codcli,''), '0') IN ('8142','330','8044','4674','8088','7331','10000071','10000068','10000072','10000069','10000070')
    OR legacy_codcli IN ('008142','000330','008044','004674','008088','007331','10000071','10000068','10000072','10000069','10000070')
  )
ORDER BY legacy_codcli;
