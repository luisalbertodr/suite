-- Soporte de pago completo o fraccionado 60/40 para bonos.
-- Regla de negocio:
-- - full: 100% al alta.
-- - split_60_40: 60% al alta, 40% al llegar a mitad de sesiones usadas.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'bonos'
  ) THEN
    ALTER TABLE public.bonos
      ADD COLUMN IF NOT EXISTS payment_mode TEXT NOT NULL DEFAULT 'full'
      CHECK (payment_mode IN ('full', 'split_60_40'));
    ALTER TABLE public.bonos
      ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
    ALTER TABLE public.bonos
      ADD COLUMN IF NOT EXISTS second_payment_due_at_used_sessions INTEGER;
    ALTER TABLE public.bonos
      ADD COLUMN IF NOT EXISTS second_payment_paid BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'customer_vouchers'
  ) THEN
    ALTER TABLE public.customer_vouchers
      ADD COLUMN IF NOT EXISTS payment_mode TEXT NOT NULL DEFAULT 'full'
      CHECK (payment_mode IN ('full', 'split_60_40'));
    ALTER TABLE public.customer_vouchers
      ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10,2) NOT NULL DEFAULT 0;
    ALTER TABLE public.customer_vouchers
      ADD COLUMN IF NOT EXISTS second_payment_due_at_used_sessions INTEGER;
    ALTER TABLE public.customer_vouchers
      ADD COLUMN IF NOT EXISTS second_payment_paid BOOLEAN NOT NULL DEFAULT true;
  END IF;
END $$;
