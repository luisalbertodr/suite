SELECT p.idplan, p.fecha::text, p.horini, p.horfin, p.codemp, p.nomcli, p.texto
FROM dunasoft.plan2009 p
WHERE p.idplan IN ('112220','112221','112222','112228','112229','112231','1000000000','1000000001','1000000002','1000000003','1000000004','1000000005')
ORDER BY p.idplan;

SELECT f.style_key, left(f.fingerprint,12) AS fp, f.updated_at
FROM dunasoft.style_sync_dbf_fingerprint f
WHERE f.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND f.tabla = 'plan2009'
  AND f.style_key IN ('112220','112221','112222','112228','112229','112231','1000000000','1000000001','1000000002','1000000003','1000000004','1000000005')
ORDER BY f.style_key;
