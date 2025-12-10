-- Remove overly permissive customer policies and keep only company-specific ones
DROP POLICY IF EXISTS "Allow all users to delete customers" ON customers;
DROP POLICY IF EXISTS "Allow all users to insert customers" ON customers;
DROP POLICY IF EXISTS "Allow all users to update customers" ON customers;
DROP POLICY IF EXISTS "Allow all users to view customers" ON customers;

-- Ensure the company-specific policy covers all operations
DROP POLICY IF EXISTS "Users can access their company's customers" ON customers;

CREATE POLICY "Users can access their company's customers" ON customers
FOR ALL
USING (company_id = get_user_company_id())
WITH CHECK (company_id = get_user_company_id());