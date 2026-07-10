-- Corregir Joanella: Presentada con éxito, valor 99 EUR (10+89 desde 2026-07-02)
UPDATE marketing_leads
SET
  stage_id = '8b558be2-b4c1-4198-9871-3ac169267da3',
  value = 99.00,
  updated_at = NOW()
WHERE id = 'e21ccd97-c947-4060-88a2-8d5f66694303'
  AND stage_id IS DISTINCT FROM '8b558be2-b4c1-4198-9871-3ac169267da3';

SELECT first_name, phone, stage_id, value FROM marketing_leads WHERE id = 'e21ccd97-c947-4060-88a2-8d5f66694303';
