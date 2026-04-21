ALTER TABLE public.appointment_items
ADD COLUMN IF NOT EXISTS quantity numeric NOT NULL DEFAULT 1;

ALTER TABLE public.appointment_items
ADD COLUMN IF NOT EXISTS unit_price numeric NOT NULL DEFAULT 0;

ALTER TABLE public.appointment_items
ADD COLUMN IF NOT EXISTS bonus_payment_mode text NOT NULL DEFAULT 'none';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointment_items_quantity_check'
  ) THEN
    ALTER TABLE public.appointment_items
    ADD CONSTRAINT appointment_items_quantity_check CHECK (quantity >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointment_items_unit_price_check'
  ) THEN
    ALTER TABLE public.appointment_items
    ADD CONSTRAINT appointment_items_unit_price_check CHECK (unit_price >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appointment_items_bonus_payment_mode_check'
  ) THEN
    ALTER TABLE public.appointment_items
    ADD CONSTRAINT appointment_items_bonus_payment_mode_check
    CHECK (bonus_payment_mode IN ('none', 'full', '60', '40'));
  END IF;
END $$;
