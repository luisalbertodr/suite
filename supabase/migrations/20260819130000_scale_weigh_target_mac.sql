-- MAC objetivo de la báscula MorphoScan elegida con «Pesar» / «Pesar+».
-- Pesar   → 6030F27426E2 (Morpho, base)
-- Pesar+  → 6030F27422B6 (Morpho+3, ~+0,3 kg)

ALTER TABLE public.scale_weigh_requests
  ADD COLUMN IF NOT EXISTS target_scale_mac text;

COMMENT ON COLUMN public.scale_weigh_requests.target_scale_mac IS
  'MAC normalizada (12 hex) de la báscula elegida: 6030F27426E2 = Pesar, 6030F27422B6 = Pesar+.';

CREATE INDEX IF NOT EXISTS idx_scale_weigh_requests_target_mac
  ON public.scale_weigh_requests (company_id, target_scale_mac)
  WHERE status = 'open';
