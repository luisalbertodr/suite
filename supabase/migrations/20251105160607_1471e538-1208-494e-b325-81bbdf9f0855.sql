-- Drop the insecure policy that allows public access to superusers table
DROP POLICY IF EXISTS "Allow superuser operations from service role only" ON public.superusers;

-- No need to create new policies - with RLS enabled and no policies,
-- only the service role (used by edge functions) can access the table.
-- This prevents any public access while allowing edge functions to work.

-- Verify RLS is still enabled (it should already be enabled)
ALTER TABLE public.superusers ENABLE ROW LEVEL SECURITY;