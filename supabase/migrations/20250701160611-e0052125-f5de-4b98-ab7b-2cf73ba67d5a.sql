
-- First, let's see what users exist in the auth.users table to get the correct user_id
-- We'll create a temporary function to help us insert the profile
DO $$
DECLARE
    current_user_id uuid;
    company_id_var uuid;
BEGIN
    -- Get the first user from auth.users (assuming this is you)
    SELECT id INTO current_user_id FROM auth.users LIMIT 1;
    
    -- If no user found, we can't proceed
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'No authenticated users found. Please make sure you are logged in.';
    END IF;
    
    -- First, create a company if it doesn't exist
    INSERT INTO companies (name, tax_id, email) 
    VALUES ('Mi Empresa', '12345678A', 'admin@miempresa.com')
    ON CONFLICT (tax_id) DO NOTHING;
    
    -- Get the company ID
    SELECT id INTO company_id_var FROM companies WHERE tax_id = '12345678A';
    
    -- Then, create the user profile with the actual user ID
    INSERT INTO user_profiles (user_id, company_id)
    VALUES (current_user_id, company_id_var)
    ON CONFLICT (user_id) DO NOTHING;
    
    RAISE NOTICE 'User profile created successfully for user_id: %', current_user_id;
END $$;
