-- Saldo de cuenta tras el movimiento (columna SALDO del extracto Santander).
ALTER TABLE public.bank_movements
  ADD COLUMN IF NOT EXISTS balance numeric(14, 2);

COMMENT ON COLUMN public.bank_movements.balance IS
  'Saldo de la cuenta tras este movimiento (importado del CSV). Null si el extracto no lo traía.';
