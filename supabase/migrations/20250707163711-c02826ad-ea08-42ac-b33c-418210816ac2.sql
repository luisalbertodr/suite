
-- Tabla para configuraciones de PrestaShop por empresa
CREATE TABLE public.prestashop_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  webhook_secret TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sync_frequency INTEGER NOT NULL DEFAULT 300, -- segundos
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- Tabla para mapeo de productos entre el sistema y PrestaShop
CREATE TABLE public.prestashop_product_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  article_id UUID NOT NULL,
  variation_id UUID,
  prestashop_product_id TEXT NOT NULL,
  prestashop_combination_id TEXT,
  sync_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, article_id, variation_id),
  UNIQUE(company_id, prestashop_product_id, prestashop_combination_id)
);

-- Tabla para logs de sincronización
CREATE TABLE public.prestashop_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  sync_type TEXT NOT NULL, -- 'stock_sync', 'product_sync', 'webhook'
  direction TEXT NOT NULL, -- 'inbound', 'outbound', 'bidirectional'
  status TEXT NOT NULL, -- 'success', 'error', 'partial'
  message TEXT,
  details JSONB,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla para colas de sincronización
CREATE TABLE public.prestashop_sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  sync_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS en todas las tablas
ALTER TABLE public.prestashop_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestashop_product_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestashop_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prestashop_sync_queue ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para prestashop_configurations
CREATE POLICY "Users can access their company's PrestaShop config"
  ON public.prestashop_configurations
  FOR ALL
  USING (company_id = get_user_company_id());

-- Políticas RLS para prestashop_product_mappings
CREATE POLICY "Users can access their company's product mappings"
  ON public.prestashop_product_mappings
  FOR ALL
  USING (company_id = get_user_company_id());

-- Políticas RLS para prestashop_sync_logs
CREATE POLICY "Users can access their company's sync logs"
  ON public.prestashop_sync_logs
  FOR ALL
  USING (company_id = get_user_company_id());

-- Políticas RLS para prestashop_sync_queue
CREATE POLICY "Users can access their company's sync queue"
  ON public.prestashop_sync_queue
  FOR ALL
  USING (company_id = get_user_company_id());

-- Triggers para updated_at
CREATE TRIGGER update_prestashop_configurations_updated_at
  BEFORE UPDATE ON public.prestashop_configurations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_prestashop_product_mappings_updated_at
  BEFORE UPDATE ON public.prestashop_product_mappings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para mejorar performance
CREATE INDEX idx_prestashop_configurations_company_id ON public.prestashop_configurations(company_id);
CREATE INDEX idx_prestashop_product_mappings_company_id ON public.prestashop_product_mappings(company_id);
CREATE INDEX idx_prestashop_product_mappings_article_id ON public.prestashop_product_mappings(article_id);
CREATE INDEX idx_prestashop_sync_logs_company_id ON public.prestashop_sync_logs(company_id);
CREATE INDEX idx_prestashop_sync_queue_company_id ON public.prestashop_sync_queue(company_id);
CREATE INDEX idx_prestashop_sync_queue_status ON public.prestashop_sync_queue(status, scheduled_at);
