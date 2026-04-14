// Cliente Supabase personalizado apuntando a supabase.lipoout.com
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

const SUPABASE_URL = "https://supabase.lipoout.com";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjc4ODg2NDAwLCJleHAiOjE3OTk1MzU2MDB9.fHmgj0NPdMpBwNnHUeHElnXo08u6j9tUy8rGlDq6XzA";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
