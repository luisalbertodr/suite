-- Formulario Meta usado por defecto para leads entrantes por WhatsApp / CTWA
-- (campañas Click to WhatsApp que no generan Lead Ads).

ALTER TABLE public.meta_forms
  ADD COLUMN IF NOT EXISTS whatsapp_inbound_default boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.meta_forms.whatsapp_inbound_default IS
  'Si true, los chats WhatsApp/CTWA nuevos se vinculan a este formulario (audio, señal, automatización).';

-- Como mucho un default por empresa.
CREATE UNIQUE INDEX IF NOT EXISTS meta_forms_one_whatsapp_inbound_default_per_company
  ON public.meta_forms (company_id)
  WHERE whatsapp_inbound_default = true;
