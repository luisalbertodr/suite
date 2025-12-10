
-- Crear tabla para las preferencias de apariencia del usuario
CREATE TABLE public.user_appearance_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sidebar_color VARCHAR(50) NOT NULL DEFAULT 'blue',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Habilitar RLS
ALTER TABLE public.user_appearance_preferences ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para que los usuarios solo puedan ver y modificar sus propias preferencias
CREATE POLICY "Users can view their own appearance preferences" 
  ON public.user_appearance_preferences 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own appearance preferences" 
  ON public.user_appearance_preferences 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own appearance preferences" 
  ON public.user_appearance_preferences 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Trigger para actualizar updated_at automáticamente
CREATE TRIGGER update_user_appearance_preferences_updated_at
  BEFORE UPDATE ON public.user_appearance_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
