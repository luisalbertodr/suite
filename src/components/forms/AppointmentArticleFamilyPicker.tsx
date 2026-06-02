import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AGENDA_APPOINTMENT_SELECT_Z } from '@/lib/agendaResourceColors';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { useFamilies } from '@/hooks/useFamilies';
import type { AppointmentItemKind } from '@/types/agenda';

export type AppointmentArticleOption = {
  id: string;
  codigo: string | null;
  descripcion: string;
  precio: number | null;
  duration_minutes: number | null;
  article_kind: string | null;
  familia?: string | null;
  recurso_id?: string | null;
};

type Props = {
  value: string | null;
  itemKind: AppointmentItemKind;
  onSelect: (article: AppointmentArticleOption) => void;
  onClear?: () => void;
  disabled?: boolean;
  triggerClassName?: string;
  selectedLabel?: string;
};

const normalizeKind = (value: string | null | undefined): string =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

function articleMatchesItemKind(itemKind: AppointmentItemKind, article: { article_kind: string | null }): boolean {
  const k = normalizeKind(article.article_kind);
  if (itemKind === 'service') return k.includes('service') || k.includes('servicio');
  if (itemKind === 'product') {
    return (
      k.includes('product') ||
      k.includes('producto') ||
      k.includes('standard') ||
      k.includes('textil') ||
      k.includes('calzado')
    );
  }
  if (itemKind === 'bonus') return k.includes('bonus') || k.includes('bono');
  return true;
}

const articleLabel = (a: AppointmentArticleOption) =>
  `${a.codigo ? `${a.codigo} - ` : ''}${a.descripcion}`.trim();

const SIN_FAMILIA_KEY = '__sin_familia__';

export const AppointmentArticleFamilyPicker: React.FC<Props> = ({
  value,
  itemKind,
  onSelect,
  onClear,
  disabled,
  triggerClassName,
  selectedLabel,
}) => {
  const [open, setOpen] = useState(false);
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null);
  const { companyId } = useCompanyFilter();
  const { catalogHostCompanyId } = useWorkCenter();
  const catalogCompanyId = catalogHostCompanyId ?? companyId;

  const { families, loading: familiesLoading } = useFamilies();

  const { data: familyArticles = [], isLoading: articlesLoading } = useQuery({
    queryKey: ['appointment-articles-by-family', catalogCompanyId, expandedFamily],
    enabled: Boolean(catalogCompanyId && open && expandedFamily !== null),
    queryFn: async () => {
      let query = supabase
        .from('articles')
        .select('id,codigo,descripcion,precio,duration_minutes,article_kind,estado,familia,recurso_id')
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
    () => familyArticles.filter((a) => articleMatchesItemKind(itemKind, a)),
    [familyArticles, itemKind],
  );

  const familyRows = useMemo(() => {
    const names = families.map((f) => f.name).filter(Boolean);
    return [...names, SIN_FAMILIA_KEY];
  }, [families]);

  const triggerText =
    selectedLabel?.trim() ||
    (value ? 'Artículo seleccionado' : itemKind === 'service' ? 'Elegir servicio…' : 'Elegir artículo…');

  const toggleFamily = (key: string) => {
    setExpandedFamily((prev) => (prev === key ? null : key));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
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
                  setOpen(false);
                  setExpandedFamily(null);
                }}
              >
                Sin artículo
              </button>
            )}
            {familiesLoading ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">Cargando familias…</p>
            ) : (
              familyRows.map((famKey) => {
                const isExpanded = expandedFamily === famKey;
                const label = famKey === SIN_FAMILIA_KEY ? 'Sin familia' : famKey;
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
                      <span className="truncate">{label}</span>
                    </button>
                    {isExpanded && (
                      <div className="ml-4 border-l border-border/60 pl-1 pb-1">
                        {articlesLoading ? (
                          <p className="px-2 py-1 text-[10px] text-muted-foreground">Cargando artículos…</p>
                        ) : filteredArticles.length === 0 ? (
                          <p className="px-2 py-1 text-[10px] text-muted-foreground">Sin artículos en esta familia</p>
                        ) : (
                          filteredArticles.map((a) => (
                            <button
                              key={a.id}
                              type="button"
                              className={cn(
                                'w-full text-left rounded-sm px-2 py-1 text-[11px] hover:bg-accent truncate',
                                value === a.id && 'bg-accent font-medium',
                              )}
                              onClick={() => {
                                onSelect(a);
                                setOpen(false);
                                setExpandedFamily(null);
                              }}
                            >
                              {articleLabel(a)}
                              {a.precio != null && (
                                <span className="text-muted-foreground tabular-nums">
                                  {' '}
                                  · {Number(a.precio).toFixed(2)} €
                                </span>
                              )}
                            </button>
                          ))
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
