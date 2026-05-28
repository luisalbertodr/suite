-- Detalle por sesiones de cada bono de cliente (BONOSART2.DBF en Dunasoft).
-- BONOSART1.DBF → legacy.bonosart (plantilla por codbon, ya existente + columnas cant/pvpcom).

CREATE TABLE IF NOT EXISTS legacy.bonosart2 (
  codboncli text,
  codart text,
  cant text,
  cantgas text,
  pvp text,
  cantmax text,
  import_batch text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_legacy_bonosart2_imported_at ON legacy.bonosart2 (imported_at);
CREATE INDEX IF NOT EXISTS idx_legacy_bonosart2_codboncli ON legacy.bonosart2 (codboncli);

COMMENT ON TABLE legacy.bonosart2 IS 'Líneas por instancia de bono (BONOSART2.DBF): codboncli + servicios incluidos y consumidos.';
