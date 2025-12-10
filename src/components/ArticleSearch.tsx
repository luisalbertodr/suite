
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus } from 'lucide-react';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';

interface Article {
  id: string;
  codigo: string;
  descripcion: string;
  precio: number;
  stock_actual: number;
  codigo_barras?: string;
}

interface ArticleSearchProps {
  onAddArticle: (article: Article) => void;
}

export const ArticleSearch: React.FC<ArticleSearchProps> = ({ onAddArticle }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showResults, setShowResults] = useState(false);
  const { companyId } = useCompanyFilter();

  const { data: articles, isLoading } = useQuery({
    queryKey: ['articles-search', searchTerm, companyId],
    queryFn: async () => {
      if (!companyId || !searchTerm || searchTerm.length < 2) {
        return [];
      }

      const { data, error } = await supabase
        .from('articles')
        .select('id, codigo, descripcion, precio, stock_actual, codigo_barras')
        .eq('company_id', companyId)
        .eq('estado', 'activo')
        .or(`descripcion.ilike.%${searchTerm}%,codigo.ilike.%${searchTerm}%,codigo_barras.ilike.%${searchTerm}%`)
        .limit(10);

      if (error) throw error;
      return data as Article[];
    },
    enabled: !!companyId && searchTerm.length >= 2,
  });

  const handleAddArticle = (article: Article) => {
    onAddArticle(article);
    setSearchTerm('');
    setShowResults(false);
  };

  return (
    <div className="relative">
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Buscar artículos por descripción, código o código de barras..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setShowResults(e.target.value.length >= 2);
            }}
            onFocus={() => setShowResults(searchTerm.length >= 2)}
            className="pl-10"
          />
        </div>
      </div>

      {showResults && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              Buscando artículos...
            </div>
          ) : articles && articles.length > 0 ? (
            articles.map((article) => (
              <div
                key={article.id}
                className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                onClick={() => handleAddArticle(article)}
              >
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {article.descripcion}
                    </div>
                    <div className="text-sm text-gray-500">
                      Código: {article.codigo} • Stock: {article.stock_actual}
                      {article.codigo_barras && ` • CB: ${article.codigo_barras}`}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-blue-600">
                      €{article.precio.toFixed(2)}
                    </span>
                    <Button size="sm" variant="ghost">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : searchTerm.length >= 2 ? (
            <div className="p-4 text-center text-gray-500">
              No se encontraron artículos
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
