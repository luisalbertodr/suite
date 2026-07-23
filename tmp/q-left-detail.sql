SELECT c.name, h.id,
       motivo_consulta,
       left(tratamiento, 100) AS tto,
       length(coalesce(tratamiento,'')) AS tlen
FROM historial_clinico h
JOIN customers c ON c.id = h.customer_id
WHERE h.id IN (
  '5340d75f-5602-464e-a225-acbef22e1d30','17b3f101-505e-4dfd-8d1e-9e10a5d6be6c',
  '87e7cba6-5a88-4973-992c-7116a08cb812','8b3d8792-cecc-43cd-95d1-15d364687b69',
  '019d549f-6ddc-4326-b5bd-85f58235aead','0ac97e12-bc79-43bb-af59-009396198d6d',
  'a78b9328-f238-465f-968b-a47166a8dba8','8c289510-9dc7-49c5-b84a-ae00a893fb26'
)
ORDER BY c.name, h.created_at;
