
-- Temporalmente permitir todas las operaciones en agenda_appointments sin restricciones de RLS
-- Esto es solo para desarrollo hasta que se implemente la autenticación
DROP POLICY IF EXISTS "Users can access their company's agenda appointments" ON public.agenda_appointments;

CREATE POLICY "Allow all operations during development" 
  ON public.agenda_appointments 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);
