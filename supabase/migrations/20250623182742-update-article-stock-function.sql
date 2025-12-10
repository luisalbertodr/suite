
-- Function to update article stock and purchase price when receiving goods
CREATE OR REPLACE FUNCTION public.update_article_stock_and_price(
  article_id uuid,
  quantity_received numeric,
  new_purchase_price numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update article stock and purchase price
  UPDATE public.articles 
  SET 
    stock_actual = stock_actual + quantity_received,
    precio_compra = new_purchase_price,
    updated_at = NOW()
  WHERE id = article_id;
END;
$$;
