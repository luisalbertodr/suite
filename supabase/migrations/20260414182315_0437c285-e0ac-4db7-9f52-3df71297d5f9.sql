
-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT NOT NULL DEFAULT 'info',
  read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view notifications in their company
CREATE POLICY "Users can view notifications in their company"
ON public.notifications
FOR SELECT
TO authenticated
USING (company_id = get_user_company_id());

-- Users can update (mark as read) notifications in their company
CREATE POLICY "Users can update notifications in their company"
ON public.notifications
FOR UPDATE
TO authenticated
USING (company_id = get_user_company_id());

-- System can insert notifications
CREATE POLICY "Users can insert notifications in their company"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (company_id = get_user_company_id());

-- Index for fast lookups
CREATE INDEX idx_notifications_company_read ON public.notifications(company_id, read, created_at DESC);
