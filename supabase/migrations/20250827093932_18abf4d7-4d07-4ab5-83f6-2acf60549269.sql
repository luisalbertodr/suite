-- Make company_id required in presupuestos_n table
ALTER TABLE presupuestos_n ALTER COLUMN company_id SET NOT NULL;

-- Set company_id for any existing records without it
UPDATE presupuestos_n 
SET company_id = (SELECT id FROM companies LIMIT 1) 
WHERE company_id IS NULL;