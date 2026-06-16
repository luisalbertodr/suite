-- Encolar leads en etapa Nuevo lead + activar automatización WA en formularios Meta
BEGIN;

UPDATE meta_forms
SET whatsapp_automation_enabled = true,
    updated_at = now()
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND form_name IN ('Body Sculpt', 'Método Skin Lipoout')
  AND whatsapp_automation_enabled = false;

UPDATE marketing_leads l
SET meta_form_id = '7118a7d4-c737-4c7e-a737-c993c3b81c7d',
    form_name = COALESCE(NULLIF(trim(l.form_name), ''), 'Body Sculpt'),
    updated_at = now()
WHERE l.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND l.meta_form_id IS NULL
  AND l.campaign ILIKE '%Body Sculpt%';

UPDATE marketing_leads l
SET meta_form_id = '0a4ef6cc-adb7-4949-a79d-eff404c994ab',
    form_name = COALESCE(NULLIF(trim(l.form_name), ''), 'Método Skin Lipoout'),
    updated_at = now()
WHERE l.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND l.meta_form_id IS NULL
  AND l.campaign ILIKE '%Método Skin%';

UPDATE marketing_leads l
SET meta_form_id = mf.id,
    updated_at = now()
FROM meta_forms mf
WHERE l.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND mf.company_id = l.company_id
  AND l.meta_form_id IS NULL
  AND trim(l.form_name) = mf.form_name;

INSERT INTO marketing_whatsapp_queue (company_id, marketing_lead_id, status)
SELECT l.company_id, l.id, 'pending'
FROM marketing_leads l
WHERE l.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND l.stage_id = 'd440e946-a9ee-46f2-9e38-7d4786cb9229'
  AND l.archived_at IS NULL
  AND l.wa_automation_initial_sent_at IS NULL
  AND l.phone IS NOT NULL
  AND trim(l.phone) <> ''
ON CONFLICT (company_id, marketing_lead_id) DO UPDATE
SET status = 'pending',
    error = NULL,
    queued_at = now(),
    updated_at = now()
WHERE marketing_whatsapp_queue.status IN ('failed', 'cancelled');

COMMIT;

SELECT status, COUNT(*) AS cnt
FROM marketing_whatsapp_queue
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
GROUP BY status
ORDER BY status;

SELECT COUNT(*) AS nuevo_lead_sin_wa_aun_sin_cola
FROM marketing_leads l
WHERE l.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND l.stage_id = 'd440e946-a9ee-46f2-9e38-7d4786cb9229'
  AND l.wa_automation_initial_sent_at IS NULL
  AND l.archived_at IS NULL
  AND l.phone IS NOT NULL AND trim(l.phone) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM marketing_whatsapp_queue q
    WHERE q.marketing_lead_id = l.id AND q.status = 'pending'
  );
