-- Elimina ambigüedad: dos overloads de style_map_upsert (6 y 7 args) rompen las llamadas con 6 parámetros.
DROP FUNCTION IF EXISTS dunasoft.style_map_upsert(uuid, text, text, uuid, bigint, text);

-- La versión con p_field_snapshot (7 args) queda como única definición (migración 161000).
