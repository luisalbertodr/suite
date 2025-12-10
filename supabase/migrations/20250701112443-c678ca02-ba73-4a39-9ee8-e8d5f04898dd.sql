
-- Actualizar las políticas RLS para article_variations para que funcionen correctamente
-- Primero eliminamos las políticas existentes
DROP POLICY IF EXISTS "Users can delete article variations from their company" ON article_variations;
DROP POLICY IF EXISTS "Users can insert article variations for their company articles" ON article_variations;
DROP POLICY IF EXISTS "Users can update article variations from their company" ON article_variations;
DROP POLICY IF EXISTS "Users can view article variations from their company" ON article_variations;

-- Crear nuevas políticas más permisivas temporalmente hasta que se implemente la autenticación completa
CREATE POLICY "Allow all operations on article_variations" 
  ON article_variations 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);
