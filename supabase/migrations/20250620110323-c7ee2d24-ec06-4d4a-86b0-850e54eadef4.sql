
-- Enable RLS on customers table if not already enabled
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to view all customers (since this appears to be a business management app)
CREATE POLICY "Allow users to view customers" 
ON public.customers 
FOR SELECT 
TO authenticated
USING (true);

-- Create policy to allow users to insert customers
CREATE POLICY "Allow users to insert customers" 
ON public.customers 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Create policy to allow users to update customers
CREATE POLICY "Allow users to update customers" 
ON public.customers 
FOR UPDATE 
TO authenticated
USING (true)
WITH CHECK (true);

-- Create policy to allow users to delete customers
CREATE POLICY "Allow users to delete customers" 
ON public.customers 
FOR DELETE 
TO authenticated
USING (true);
