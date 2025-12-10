-- Update incorrect test endpoints in verifactu_company_config
-- Replace prewww7 with prewww10 and /ws/VeriFactu with /services/VeriFactuSistemaFacturacion

UPDATE verifactu_company_config
SET 
  endpoint_url = 'https://prewww10.aeat.es/wlpl/TIKE-CONT-WS/services/VeriFactuSistemaFacturacion',
  updated_at = NOW()
WHERE 
  (environment = 'test' OR is_production = false)
  AND (
    endpoint_url LIKE '%prewww7%' 
    OR endpoint_url LIKE '%/ws/VeriFactu%'
    OR endpoint_url IS NULL
    OR endpoint_url = ''
  );