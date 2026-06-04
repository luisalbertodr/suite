import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { useFamilies } from '@/hooks/useFamilies';
import { articleMatchesPickerKind, type ArticlePickerKind } from '@/lib/articleSearch';

const SIN_FAMILIA_KEY = '__sin_familia__';

function familyKeyFromArticle(familia: string | null | undefined): string {
  const name = String(familia ?? '').trim();
  return name ? name : SIN_FAMILIA_KEY;
}

/** Familias del catálogo que tienen al menos un artículo activo del tipo indicado. */
export function useNonEmptyArticleFamilies(itemKind: ArticlePickerKind, enabled = true) {
  const { companyId } = useCompanyFilter();
  const { catalogHostCompanyId } = useWorkCenter();
  const catalogCompanyId = catalogHostCompanyId ?? companyId;
  const { families, loading: familiesLoading } = useFamilies();

  const { data: familyIndex = [], isLoading: indexLoading } = useQuery({
    queryKey: ['articles-family-index', catalogCompanyId, itemKind],
    enabled: Boolean(catalogCompanyId && enabled),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('familia, article_kind')
        .eq('company_id', catalogCompanyId!)
        .eq('estado', 'activo');
      if (error) throw error;
      return (data ?? []) as Array<{ familia: string | null; article_kind: string | null }>;
    },
    staleTime: 60_000,
  });

  const familyRows = useMemo(() => {
    const keys = new Set<string>();
    for (const row of familyIndex) {
      if (articleMatchesPickerKind(itemKind, row)) {
        keys.add(familyKeyFromArticle(row.familia));
      }
    }
    const rows: string[] = [];
    for (const f of families) {
      const name = f.name?.trim();
      if (name && keys.has(name)) rows.push(name);
    }
    if (keys.has(SIN_FAMILIA_KEY)) rows.push(SIN_FAMILIA_KEY);
    return rows.sort((a, b) => {
      if (a === SIN_FAMILIA_KEY) return 1;
      if (b === SIN_FAMILIA_KEY) return -1;
      return a.localeCompare(b, 'es');
    });
  }, [familyIndex, families, itemKind]);

  return {
    familyRows,
    familyLabels: familyRows.map((k) => (k === SIN_FAMILIA_KEY ? 'Sin familia' : k)),
    loading: familiesLoading || indexLoading,
  };
}
