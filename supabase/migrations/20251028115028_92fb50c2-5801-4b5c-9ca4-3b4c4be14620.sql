-- Permitir estado 'queued' en invoices
ALTER TABLE public.invoices 
DROP CONSTRAINT IF EXISTS invoices_verifactu_status_check;

ALTER TABLE public.invoices 
ADD CONSTRAINT invoices_verifactu_status_check 
CHECK (verifactu_status IN ('pending', 'sent', 'accepted', 'rejected', 'error', 'queued'));

-- Asegurar que la tabla verifactu_company_config tiene los campos necesarios
ALTER TABLE public.verifactu_company_config 
ADD COLUMN IF NOT EXISTS is_production boolean DEFAULT false;

ALTER TABLE public.verifactu_company_config 
ADD COLUMN IF NOT EXISTS endpoint_url text;

-- Actualizar el endpoint por defecto para pruebas (PRE-PRODUCCIÓN de Verifactu)
UPDATE public.verifactu_company_config 
SET endpoint_url = 'https://prewww2.aeat.es/wlpl/TIKE-CONT-WS/services/VeriFactuSistemaFacturacion'
WHERE endpoint_url IS NULL OR endpoint_url = '';

-- Asegurar que is_production está en false para usar entorno de pruebas
UPDATE public.verifactu_company_config 
SET is_production = false
WHERE is_production IS NULL;