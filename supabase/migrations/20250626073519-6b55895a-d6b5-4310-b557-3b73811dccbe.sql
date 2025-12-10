
-- Agregar los campos faltantes a la tabla companies
ALTER TABLE public.companies 
ADD COLUMN website text,
ADD COLUMN additional_info text;

-- Agregar comentarios para documentar los nuevos campos
COMMENT ON COLUMN public.companies.website IS 'Website de la empresa';
COMMENT ON COLUMN public.companies.additional_info IS 'Campo libre de hasta 50 caracteres para información adicional';

-- Agregar constraint para limitar el campo adicional a 50 caracteres
ALTER TABLE public.companies 
ADD CONSTRAINT companies_additional_info_length 
CHECK (char_length(additional_info) <= 50);
