
-- Drop existing policies
DROP POLICY IF EXISTS "Allow users to view customers" ON public.customers;
DROP POLICY IF EXISTS "Allow users to insert customers" ON public.customers;
DROP POLICY IF EXISTS "Allow users to update customers" ON public.customers;
DROP POLICY IF EXISTS "Allow users to delete customers" ON public.customers;

-- Create new policies that allow both authenticated and anonymous users
CREATE POLICY "Allow all users to view customers" 
ON public.customers 
FOR SELECT 
USING (true);

CREATE POLICY "Allow all users to insert customers" 
ON public.customers 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow all users to update customers" 
ON public.customers 
FOR UPDATE 
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow all users to delete customers" 
ON public.customers 
FOR DELETE 
USING (true);
