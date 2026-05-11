-- Detalle "por sesiones" de BONOSART (Dunasoft) + clave de instancia de bono en cliente.
-- Reimporta BONOSCLI.DBF / BONOSART.DBF tras esta migración para rellenar columnas.

ALTER TABLE legacy.bonosart
  ADD COLUMN IF NOT EXISTS cant text,
  ADD COLUMN IF NOT EXISTS cantmax text,
  ADD COLUMN IF NOT EXISTS pvpcom text;

COMMENT ON COLUMN legacy.bonosart.cant IS 'Cant. sesiones/und. del servicio o producto en el bono (pantalla Detalle por sesiones).';
COMMENT ON COLUMN legacy.bonosart.cantmax IS 'Cant. máxima consumible si el bono no está totalmente pagado (legacy).';
COMMENT ON COLUMN legacy.bonosart.pvpcom IS 'PVP comisión asociada a la línea (legacy).';

ALTER TABLE public.bonus_definition_items
  ADD COLUMN IF NOT EXISTS max_covered_if_unpaid NUMERIC(10,2) NULL;

ALTER TABLE public.bonus_definition_items
  ADD COLUMN IF NOT EXISTS commission_pvp NUMERIC(10,2) NULL;

COMMENT ON COLUMN public.bonus_definition_items.max_covered_if_unpaid IS
  'Legacy: cant. máx. consumible si el bono no está totalmente pagado.';

COMMENT ON COLUMN public.bonus_definition_items.commission_pvp IS
  'Legacy: PVP comisión de la línea.';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bonos'
  ) THEN
    ALTER TABLE public.bonos
      ADD COLUMN IF NOT EXISTS legacy_codboncli text NULL;
  END IF;
END $$;

COMMENT ON COLUMN public.bonos.legacy_codboncli IS
  'Clave BONOSCLI (instancia bono de cliente) para import idempotente.';

CREATE INDEX IF NOT EXISTS idx_bonos_company_legacy_codboncli
  ON public.bonos(company_id, legacy_codboncli)
  WHERE legacy_codboncli IS NOT NULL;
