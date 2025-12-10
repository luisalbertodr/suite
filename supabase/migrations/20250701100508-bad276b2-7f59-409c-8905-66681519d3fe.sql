
-- Update articles table to add tipo_producto column if not exists and remove individual talla/color
DO $$
BEGIN
    -- Add tipo_producto column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'tipo_producto') THEN
        ALTER TABLE public.articles ADD COLUMN tipo_producto TEXT NOT NULL DEFAULT 'standard' CHECK (tipo_producto IN ('textil', 'calzado', 'standard'));
    END IF;

    -- Add precio_compra column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'articles' AND column_name = 'precio_compra') THEN
        ALTER TABLE public.articles ADD COLUMN precio_compra NUMERIC NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Create index for better performance on article_variations
CREATE INDEX IF NOT EXISTS idx_article_variations_codigo_barras ON public.article_variations(codigo_barras);
CREATE INDEX IF NOT EXISTS idx_article_variations_estado ON public.article_variations(estado);

-- Add stock_minimo to article_variations if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'article_variations' AND column_name = 'stock_minimo') THEN
        ALTER TABLE public.article_variations ADD COLUMN stock_minimo INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;
