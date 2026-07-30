import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { useFamilies } from '@/hooks/useFamilies';
import { formatArticleUnitPrice } from '@/lib/agendaAppointmentPricing';
import { escapeIlikePattern } from '@/lib/appointmentArticleKind';
import {
  ARTICLE_SEARCH_MIN_CHARS,
  articleMatchesPickerKind,
  isArticleSearchQueryReady,
  type ArticlePickerKind,
} from '@/lib/articleSearch';
import { ABOVE_DOCK_DIALOG_MAX_H, ABOVE_DOCK_DIALOG_POSITION, ABOVE_DOCK_DIALOG_Z } from '@/lib/dialogLayers';
import { cn } from '@/lib/utils';
import { ArticleImageTile } from '@/components/forms/ArticleImageTile';
import type { AppointmentArticleOption } from '@/components/forms/AppointmentArticleFamilyPicker';

const SIN_FAMILIA_KEY = '__sin_familia__';

const ARTICLE_SELECT_FIELDS =
  'id,codigo,descripcion,descripcion_larga,precio,duration_minutes,article_kind,estado,familia,recurso_id,foto_url,legacy_photo_path';

type ArticleRow = AppointmentArticleOption & {
  foto_url?: string | null;
  legacy_photo_path?: string | null;
};

function familyKeyFromArticle(familia: string | null | undefined): string {
  const name = String(familia ?? '').trim();
  return name ? name : SIN_FAMILIA_KEY;
}

function familyLabel(key: string): string {
  return key === SIN_FAMILIA_KEY ? 'Sin familia' : key;
}

function kindTitle(itemKind: ArticlePickerKind): string {
  if (itemKind === 'service') return 'Seleccionar servicio';
  if (itemKind === 'product') return 'Seleccionar producto';
  if (itemKind === 'bonus') return 'Seleccionar bono';
  return 'Seleccionar artículo';
}

function articleFallback(itemKind: ArticlePickerKind): 'product' | 'service' | 'bonus' {
  if (itemKind === 'service') return 'service';
  if (itemKind === 'bonus') return 'bonus';
  return 'product';
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemKind: ArticlePickerKind;
  selectedId?: string | null;
  onSelect: (article: AppointmentArticleOption) => void;
};

export const ArticleGridPickerDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  itemKind,
  selectedId,
  onSelect,
}) => {
  const [selectedFamily, setSelectedFamily] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { companyId } = useCompanyFilter();
  const { catalogHostCompanyId } = useWorkCenter();
  const catalogCompanyId = catalogHostCompanyId ?? companyId;
  const { families, loading: familiesLoading } = useFamilies();

  const trimmedSearch = searchQuery.trim();
  const isSearching = isArticleSearchQueryReady(trimmedSearch);
  const searchTooShort = trimmedSearch.length > 0 && !isSearching;

  const { data: familyIndex = [], isLoading: indexLoading } = useQuery({
    queryKey: ['articles-family-index', catalogCompanyId, itemKind],
    enabled: Boolean(catalogCompanyId && open && !isSearching),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('familia, article_kind, foto_url, legacy_photo_path')
        .eq('company_id', catalogCompanyId!)
        .eq('estado', 'activo');
      if (error) throw error;
      return (data ?? []) as Array<{
        familia: string | null;
        article_kind: string | null;
        foto_url: string | null;
        legacy_photo_path: string | null;
      }>;
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

  const familyThumbnails = useMemo(() => {
    const map = new Map<string, { foto_url: string | null; legacy_photo_path: string | null }>();
    for (const row of familyIndex) {
      if (!articleMatchesPickerKind(itemKind, row)) continue;
      const key = familyKeyFromArticle(row.familia);
      if (map.has(key)) continue;
      if (row.foto_url || row.legacy_photo_path) {
        map.set(key, {
          foto_url: row.foto_url,
          legacy_photo_path: row.legacy_photo_path,
        });
      }
    }
    return map;
  }, [familyIndex, itemKind]);

  const { data: familyArticles = [], isLoading: articlesLoading } = useQuery({
    queryKey: ['articles-by-family-grid', catalogCompanyId, selectedFamily, itemKind],
    enabled: Boolean(catalogCompanyId && open && !isSearching && selectedFamily !== null),
    queryFn: async () => {
      let query = supabase
        .from('articles')
        .select(ARTICLE_SELECT_FIELDS)
        .eq('company_id', catalogCompanyId!)
        .eq('estado', 'activo');

      if (selectedFamily === SIN_FAMILIA_KEY) {
        query = query.or('familia.is.null,familia.eq.');
      } else if (selectedFamily) {
        query = query.eq('familia', selectedFamily);
      }

      const { data, error } = await query.order('descripcion');
      if (error) throw error;
      return (data ?? []) as ArticleRow[];
    },
    staleTime: 60_000,
  });

  const filteredFamilyArticles = useMemo(
    () => familyArticles.filter((a) => articleMatchesPickerKind(itemKind, a)),
    [familyArticles, itemKind],
  );

  const { data: searchResults = [], isLoading: searchLoading } = useQuery({
    queryKey: ['articles-search-grid', catalogCompanyId, itemKind, trimmedSearch],
    enabled: Boolean(catalogCompanyId && open && isSearching),
    queryFn: async () => {
      const pattern = `%${escapeIlikePattern(trimmedSearch)}%`;
      const { data, error } = await supabase
        .from('articles')
        .select(ARTICLE_SELECT_FIELDS)
        .eq('company_id', catalogCompanyId!)
        .eq('estado', 'activo')
        .or(
          `descripcion.ilike.${pattern},codigo.ilike.${pattern},descripcion_larga.ilike.${pattern}`,
        )
        .order('descripcion')
        .limit(120);
      if (error) throw error;
      return ((data ?? []) as ArticleRow[]).filter((a) => articleMatchesPickerKind(itemKind, a));
    },
    staleTime: 30_000,
  });

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      setSelectedFamily(null);
      setSearchQuery('');
    }
  };

  const handleSelectArticle = (article: ArticleRow) => {
    onSelect(article);
    handleOpenChange(false);
  };

  const fallback = articleFallback(itemKind);
  const showFamilies = !isSearching && selectedFamily === null;
  const showArticles = !isSearching && selectedFamily !== null;
  const loadingFamilies = familiesLoading || indexLoading;
  const loadingContent = isSearching ? searchLoading : showArticles ? articlesLoading : loadingFamilies;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className={cn(
          'flex w-[min(100vw-1rem,56rem)] max-w-[56rem] flex-col gap-3 p-4 sm:p-5',
          ABOVE_DOCK_DIALOG_Z,
          ABOVE_DOCK_DIALOG_POSITION,
          ABOVE_DOCK_DIALOG_MAX_H,
        )}
        overlayClassName={ABOVE_DOCK_DIALOG_Z}
      >
        <DialogHeader className="shrink-0 space-y-1 pr-8 text-left">
          <DialogTitle>{kindTitle(itemKind)}</DialogTitle>
          <DialogDescription>
            Toca una familia o busca por nombre. Las fotos se muestran desde Supabase.
          </DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 items-center gap-2">
          {showArticles ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 shrink-0 px-2"
              onClick={() => setSelectedFamily(null)}
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Familias
            </Button>
          ) : null}
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Buscar (mín. ${ARTICLE_SEARCH_MIN_CHARS} caracteres)…`}
              className="h-9 pl-8"
            />
          </div>
        </div>

        {showArticles ? (
          <p className="shrink-0 text-sm font-medium text-muted-foreground">
            {familyLabel(selectedFamily!)}
          </p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y pr-1">
          {searchTooShort ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Escribe al menos {ARTICLE_SEARCH_MIN_CHARS} caracteres para buscar, o elige una familia.
            </p>
          ) : loadingContent ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
          ) : isSearching ? (
            searchResults.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Sin resultados.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 sm:gap-3">
                {searchResults.map((article) => (
                  <ArticleImageTile
                    key={article.id}
                    label={article.descripcion}
                    subtitle={formatArticleUnitPrice(article.precio)}
                    image={article}
                    selected={selectedId === article.id}
                    fallback={fallback}
                    onClick={() => handleSelectArticle(article)}
                  />
                ))}
              </div>
            )
          ) : showFamilies ? (
            familyRows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No hay familias con artículos activos.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 sm:gap-3">
                {familyRows.map((famKey) => (
                  <ArticleImageTile
                    key={famKey}
                    label={familyLabel(famKey)}
                    image={familyThumbnails.get(famKey) ?? null}
                    fallback="family"
                    onClick={() => setSelectedFamily(famKey)}
                  />
                ))}
              </div>
            )
          ) : filteredFamilyArticles.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Sin artículos en esta familia.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 sm:gap-3">
              {filteredFamilyArticles.map((article) => (
                <ArticleImageTile
                  key={article.id}
                  label={article.descripcion}
                  subtitle={formatArticleUnitPrice(article.precio)}
                  image={article}
                  selected={selectedId === article.id}
                  fallback={fallback}
                  onClick={() => handleSelectArticle(article)}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
