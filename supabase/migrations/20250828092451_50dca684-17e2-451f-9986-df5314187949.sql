-- Add logo_url column to user_appearance_preferences table
ALTER TABLE public.user_appearance_preferences 
ADD COLUMN logo_url TEXT;