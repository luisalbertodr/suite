-- Corregir asignación de empresa del usuario para acceder a presupuestos_n
-- Cambiar el usuario actual a la empresa donde están los presupuestos_n
UPDATE public.user_profiles 
SET company_id = 'c7646244-f23d-41fc-848b-9b669c7adc97',
    updated_at = now()
WHERE user_id IS NOT NULL
AND company_id = '0096e745-3e1b-4c5c-b771-c3747a174911';