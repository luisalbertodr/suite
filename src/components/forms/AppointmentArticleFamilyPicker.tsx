import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AGENDA_APPOINTMENT_SELECT_Z } from '@/lib/agendaResourceColors';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, ChevronsUpDown, Search } from 'lucide-react';
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

export type AppointmentArticleOption = {
  id: string;
  codigo: string | null;
  descripcion: string;
  descripcion_larga?: string | null;
  precio: number | null;
  duration_minutes: number | null;
  article_kind: string | null;
  familia?: string | null;
  recurso_id?: string | null;
};

type Props = {
  value: string | null;
  itemKind: ArticlePickerKind;
  onSelect: (article: AppointmentArticleOption) => void;
  onClear?: () => void;
  disabled?: boolean;
  triggerClassName?: string;
  selectedLabel?: string;
  /** Precio del artículo ya elegido (se muestra en el botón junto al nombre). */
  selectedUnitPrice?: number | null;
  placeholder?: string;
};

export const articleLabel = (a: AppointmentArticleOption) =>
  `${a.codigo ? `${a.codigo} - ` : ''}${a.descripcion}`.trim();

export const articleLabelWithPrice = (a: AppointmentArticleOption) => {
  const name = articleLabel(a);
  const price = formatArticleUnitPrice(a.precio);
  return price ? `${name} · ${price}` : name;
};

const SIN_FAMILIA_KEY = '__sin_familia__';

const ARTICLE_SELECT_FIELDS =
  'id,codigo,descripcion,descripcion_larga,precio,duration_minutes,article_kind,estado,familia,recurso_id';

function familyKeyFromArticle(familia: string | null | undefined): string {
  const name = String(familia ?? '').trim();
  return name ? name : SIN_FAMILIA_KEY;
}

function kindLabel(itemKind: ArticlePickerKind): string {
  if (itemKind === 'service') return 'servicios';
  if (itemKind === 'product') return 'productos';
  if (itemKind === 'bonus') return 'bonos';
  return 'artículos';
}

export const AppointmentArticleFamilyPicker: React.FC<Props> = ({
  value,
  itemKind,
  onSelect,
  onClear,
  disabled,
  triggerClassName,
  selectedLabel,
  selectedUnitPrice,
  placeholder,
}) => {
  const [open, setOpen] = useState(false);
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null);
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
        .select('familia, article_kind')
        .eq('company_id', catalogCompanyId!)
        .eq('estado', 'activo');
      if (error) throw error;
      return (data ?? []) as Array<{ familia: string | null; article_kind: string | null }>;
    },
    staleTime: 60_000,
  });

  const familiesWithMatchingArticles = useMemo(() => {
    const keys = new Set<string>();
    for (const row of familyIndex) {
      if (articleMatchesPickerKind(itemKind, row)) {
        keys.add(familyKeyFromArticle(row.familia));
      }
    }
    return keys;
  }, [familyIndex, itemKind]);

  const familyRows = useMemo(() => {
    const rows: string[] = [];
    for (const f of families) {
      const name = f.name?.trim();
      if (name && familiesWithMatchingArticles.has(name)) {
        rows.push(name);
      }
    }
    if (familiesWithMatchingArticles.has(SIN_FAMILIA_KEY)) {
      rows.push(SIN_FAMILIA_KEY);
    }
    return rows.sort((a, b) => {
      if (a === SIN_FAMILIA_KEY) return 1;
      if (b === SIN_FAMILIA_KEY) return -1;
      return a.localeCompare(b, 'es');
    });
  }, [families, familiesWithMatchingArticles]);

  const { data: familyArticles = [], isLoading: articlesLoading } = useQuery({
    queryKey: ['articles-by-family', catalogCompanyId, expandedFamily, itemKind],
    enabled: Boolean(catalogCompanyId && open && !isSearching && expandedFamily !== null),
    queryFn: async () => {
      let query = supabase
        .from('articles')
        .select(ARTICLE_SELECT_FIELDS)
        .eq('company_id', catalogCompanyId!)
        .eq('estado', 'activo');

      if (expandedFamily === SIN_FAMILIA_KEY) {
        query = query.or('familia.is.null,familia.eq.');
      } else if (expandedFamily) {
        query = query.eq('familia', expandedFamily);
      }

      const { data, error } = await query.order('descripcion');
      if (error) throw error;
      return (data ?? []) as AppointmentArticleOption[];
    },
    staleTime: 60_000,
  });

  const filteredArticles = useMemo(
    () => familyArticles.filter((a) => articleMatchesPickerKind(itemKind, a)),
    [familyArticles, itemKind],
  );

  const { data: searchResults = [], isLoading: searchLoading } = useQuery({
    queryKey: ['articles-search', catalogCompanyId, itemKind, trimmedSearch],
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
        .limit(80);
      if (error) throw error;
      return ((data ?? []) as AppointmentArticleOption[]).filter((a) =>
        articleMatchesPickerKind(itemKind, a),
      );
    },
    staleTime: 30_000,
  });

  const defaultPlaceholder =
    itemKind === 'service'
      ? 'Elegir servicio…'
      : itemKind === 'bonus'
        ? 'Elegir bono…'
        : itemKind === 'product'
          ? 'Elegir producto…'
          : 'Elegir artículo…';

  const triggerText = (() => {
    const base = selectedLabel?.trim() || (value ? 'Artículo seleccionado' : placeholder || defaultPlaceholder);
    const price = formatArticleUnitPrice(selectedUnitPrice);
    return price && selectedLabel?.trim() ? `${base} · ${price}` : base;
  })();

  const toggleFamily = (key: string) => {
    setExpandedFamily((prev) => (prev === key ? null : key));
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setExpandedFamily(null);
      setSearchQuery('');
    }
  };

  const renderArticleButton = (a: AppointmentArticleOption, showLong = false) => {
    const price = formatArticleUnitPrice(a.precio);
    return (
      <button
        key={a.id}
        type="button"
        className={cn(
          showLong
            ? 'flex w-full flex-col items-start gap-0.5 rounded-sm px-2 py-1.5 text-[11px] hover:bg-accent min-w-0'
            : 'flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1 text-[11px] hover:bg-accent min-w-0',
          value === a.id && 'bg-accent font-medium',
        )}
        onClick={() => {
          onSelect(a);
          handleOpenChange(false);
        }}
      >
        <span className={cn('flex w-full items-center justify-between gap-2 min-w-0', showLong && 'font-medium')}>
          <span className="truncate text-left">{articleLabel(a)}</span>
          {price ? <span className="shrink-0 tabular-nums text-muted-foreground">{price}</span> : null}
        </span>
        {showLong && a.descripcion_larga?.trim() ? (
          <span className="text-[10px] text-muted-foreground line-clamp-2 text-left w-full">
            {a.descripcion_larga.trim()}
          </span>
        ) : null}
      </button>
    );
  };

  const label = kindLabel(itemKind);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'h-7 min-w-0 flex-1 justify-between font-normal text-[11px] px-1.5',
            !value && 'text-muted-foreground',
            triggerClassName,
          )}
        >
          <span className="truncate text-left">{triggerText}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className={cn('p-0 w-[min(100vw-2rem,22rem)] overflow-hidden', AGENDA_APPOINTMENT_SELECT_Z)}
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="border-b border-border/60 p-1.5">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Buscar (mín. ${ARTICLE_SEARCH_MIN_CHARS} caracteres)…`}
              className="h-7 pl-7 text-[11px]"
              autoFocus
            />
          </div>
        </div>
        <div
          className="max-h-[min(50vh,280px)] overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y"
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="p-1">
            {value && onClear && (
              <button
                type="button"
                className="w-full text-left rounded-sm px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-accent"
                onClick={() => {
                  onClear();
                  handleOpenChange(false);
                }}
              >
                Sin artículo
              </button>
            )}

            {searchTooShort ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                Escribe al menos {ARTICLE_SEARCH_MIN_CHARS} caracteres para buscar, o abre una familia del árbol.
              </p>
            ) : isSearching ? (
              searchLoading ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">Buscando…</p>
              ) : searchResults.length === 0 ? (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  Sin {label} que coincidan con la búsqueda.
                </p>
              ) : (
                searchResults.map((a) => renderArticleButton(a, true))
              )
            ) : familiesLoading || indexLoading ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">Cargando familias…</p>
            ) : familyRows.length === 0 ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">No hay familias con {label} activos.</p>
            ) : (
              familyRows.map((famKey) => {
                const isExpanded = expandedFamily === famKey;
                const familyLabel = famKey === SIN_FAMILIA_KEY ? 'Sin familia' : famKey;
                return (
                  <div key={famKey} className="rounded-sm">
                    <button
                      type="button"
                      className="flex w-full items-center gap-1 rounded-sm px-2 py-1.5 text-left text-xs font-medium hover:bg-accent"
                      onClick={() => toggleFamily(famKey)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                      )}
                      <span className="truncate">{familyLabel}</span>
                    </button>
                    {isExpanded && (
                      <div className="ml-4 border-l border-border/60 pl-1 pb-1">
                        {articlesLoading ? (
                          <p className="px-2 py-1 text-[10px] text-muted-foreground">Cargando artículos…</p>
                        ) : filteredArticles.length === 0 ? (
                          <p className="px-2 py-1 text-[10px] text-muted-foreground">Sin artículos en esta familia</p>
                        ) : (
                          filteredArticles.map((a) => renderArticleButton(a))
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

/** Alias genérico para selectores de artículo fuera de la agenda. */
export const ArticleFamilyPicker = AppointmentArticleFamilyPicker;
