-- Movimientos bancarios importados (gastos Medicina / Estética) para beneficio real en dashboard.

CREATE TABLE IF NOT EXISTS public.bank_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  movement_date date NOT NULL,
  concept text NOT NULL DEFAULT '',
  amount numeric(14, 2) NOT NULL,
  is_expense boolean NOT NULL DEFAULT false,
  is_contribution_return boolean NOT NULL DEFAULT false,
  fingerprint text NOT NULL,
  source_filename text,
  import_batch_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bank_movements_company_fingerprint_uq UNIQUE (company_id, fingerprint)
);

CREATE INDEX IF NOT EXISTS bank_movements_company_date_idx
  ON public.bank_movements (company_id, movement_date);

CREATE INDEX IF NOT EXISTS bank_movements_expense_date_idx
  ON public.bank_movements (movement_date)
  WHERE is_expense;

COMMENT ON TABLE public.bank_movements IS
  'Extractos bancarios importados. Gastos = importes negativos excepto devoluciones de aportaciones.';

COMMENT ON COLUMN public.bank_movements.is_expense IS
  'True si amount < 0 y no es devolución de fondos aportados (resta de beneficios).';

COMMENT ON COLUMN public.bank_movements.is_contribution_return IS
  'Transferencia inmediata a favor de Diaz Rodriguez Luis Alberto (no es gasto).';

ALTER TABLE public.bank_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view bank_movements in work center" ON public.bank_movements;
DROP POLICY IF EXISTS "Users can insert bank_movements in work center" ON public.bank_movements;
DROP POLICY IF EXISTS "Users can update bank_movements in work center" ON public.bank_movements;
DROP POLICY IF EXISTS "Users can delete bank_movements in work center" ON public.bank_movements;

CREATE POLICY "Users can view bank_movements in work center"
  ON public.bank_movements FOR SELECT TO authenticated
  USING (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  );

CREATE POLICY "Users can insert bank_movements in work center"
  ON public.bank_movements FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  );

CREATE POLICY "Users can update bank_movements in work center"
  ON public.bank_movements FOR UPDATE TO authenticated
  USING (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  );

CREATE POLICY "Users can delete bank_movements in work center"
  ON public.bank_movements FOR DELETE TO authenticated
  USING (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_movements TO authenticated;
GRANT ALL ON public.bank_movements TO service_role;

-- Totales mensuales de gastos (importe absoluto) por empresa emisora.
CREATE OR REPLACE FUNCTION public.dashboard_bank_expenses_monthly(p_year integer)
RETURNS TABLE (
  month_num integer,
  month_key text,
  company_id uuid,
  total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    extract(month FROM bm.movement_date)::integer AS month_num,
    to_char(bm.movement_date, 'YYYY-MM') AS month_key,
    bm.company_id,
    round(sum(abs(bm.amount))::numeric, 2) AS total
  FROM public.bank_movements bm
  WHERE bm.is_expense
    AND extract(year FROM bm.movement_date)::integer = p_year
    AND (
      bm.company_id = public.get_user_company_id()
      OR public.company_in_user_work_center(bm.company_id)
    )
  GROUP BY 1, 2, 3
  ORDER BY 1, 3;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_bank_expenses_monthly(integer) TO authenticated, service_role;

-- Totales diarios de gastos por empresa emisora.
CREATE OR REPLACE FUNCTION public.dashboard_bank_expenses_daily(
  p_from_date date,
  p_to_date date
)
RETURNS TABLE (
  day_date date,
  day_key text,
  company_id uuid,
  total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    bm.movement_date::date AS day_date,
    to_char(bm.movement_date, 'YYYY-MM-DD') AS day_key,
    bm.company_id,
    round(sum(abs(bm.amount))::numeric, 2) AS total
  FROM public.bank_movements bm
  WHERE bm.is_expense
    AND bm.movement_date >= p_from_date
    AND bm.movement_date <= p_to_date
    AND (
      bm.company_id = public.get_user_company_id()
      OR public.company_in_user_work_center(bm.company_id)
    )
  GROUP BY 1, 2, 3
  ORDER BY 1, 3;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_bank_expenses_daily(date, date) TO authenticated, service_role;
