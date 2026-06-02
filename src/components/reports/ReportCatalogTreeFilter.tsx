import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ChevronDown, ChevronRight, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  fetchReportFamilyArticles,
  type ReportCatalogArticle,
} from '@/lib/reportCatalogScope';

export type CatalogTreeSelection = {
  familias: string[];
  articulos: string[];
};

type ArticleRow = ReportCatalogArticle;

function articleLabel(a: ArticleRow): string {
  return a.codigo ? `${a.codigo} - ${a.descripcion}` : a.descripcion;
}

/** Evita que la rueda haga scroll del modal/dialog padre (p. ej. filtros del reporte). */
function handlePopoverListWheel(e: React.WheelEvent<HTMLDivElement>) {
  e.stopPropagation();
  const el = e.currentTarget;
  if (el.scrollHeight <= el.clientHeight) return;
  el.scrollTop += e.deltaY;
  e.preventDefault();
}

interface FamilyArticlesProps {
  companyId: string;
  billingCompanyIds: string[];
  familia: string;
  expanded: boolean;
  familySelected: boolean;
  selectedArticleIds: Set<string>;
  onToggleArticle: (articleId: string) => void;
}

const FamilyArticles: React.FC<FamilyArticlesProps> = ({
  companyId,
  billingCompanyIds,
  familia,
  expanded,
  familySelected,
  selectedArticleIds,
  onToggleArticle,
}) => {
  const { data: articles = [], isLoading, isError } = useQuery({
    queryKey: ['report-catalog-tree-articles', companyId, billingCompanyIds.join(','), familia],
    queryFn: () => fetchReportFamilyArticles(companyId, familia, billingCompanyIds),
    enabled: expanded && !familySelected,
    staleTime: 5 * 60 * 1000,
  });

  if (!expanded) return null;

  if (familySelected) {
    return (
      <p className="text-xs text-muted-foreground pl-8 py-1">
        Familia completa seleccionada
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 pl-8 py-2 text-sm text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Cargando artículos…
      </div>
    );
  }

  if (isError) {
    return <p className="text-xs text-destructive pl-8 py-1">Error al cargar artículos</p>;
  }

  if (articles.length === 0) {
    return <p className="text-xs text-muted-foreground pl-8 py-1">Sin artículos activos</p>;
  }

  return (
    <div className="pl-6 pr-1 pb-1 space-y-0.5 border-l border-muted ml-3">
      {articles.map((art) => (
        <label
          key={art.id}
          className="flex items-center gap-2 rounded-md px-2 py-1 text-sm cursor-pointer hover:bg-muted"
        >
          <Checkbox
            checked={selectedArticleIds.has(art.id)}
            onCheckedChange={() => onToggleArticle(art.id)}
          />
          <span className="truncate" title={articleLabel(art)}>
            {articleLabel(art)}
          </span>
        </label>
      ))}
    </div>
  );
};

interface ReportCatalogTreeFilterProps {
  companyId: string | null;
  billingCompanyIds: string[];
  families: string[];
  value: CatalogTreeSelection;
  onChange: (value: CatalogTreeSelection) => void;
  label?: string;
  className?: string;
}

export const ReportCatalogTreeFilter: React.FC<ReportCatalogTreeFilterProps> = ({
  companyId,
  billingCompanyIds,
  families,
  value,
  onChange,
  label = 'Familias y artículos',
  className,
}) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const selectedFamilies = useMemo(() => new Set(value.familias), [value.familias]);
  const selectedArticles = useMemo(() => new Set(value.articulos), [value.articulos]);

  const filteredFamilies = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return families;
    return families.filter((f) => f.toLowerCase().includes(q));
  }, [families, search]);

  const summary = useMemo(() => {
    const nFam = value.familias.length;
    const nArt = value.articulos.length;
    if (nFam === 0 && nArt === 0) return 'Todas las familias y artículos';
    const parts: string[] = [];
    if (nFam) parts.push(`${nFam} familia${nFam > 1 ? 's' : ''}`);
    if (nArt) parts.push(`${nArt} artículo${nArt > 1 ? 's' : ''}`);
    return parts.join(' · ');
  }, [value]);

  const toggleExpanded = (familia: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(familia)) next.delete(familia);
      else next.add(familia);
      return next;
    });
  };

  const toggleFamily = (familia: string) => {
    if (selectedFamilies.has(familia)) {
      onChange({
        familias: value.familias.filter((f) => f !== familia),
        articulos: value.articulos,
      });
      return;
    }
    onChange({
      familias: [...value.familias, familia],
      articulos: value.articulos,
    });
  };

  const toggleArticle = (familia: string, articleId: string) => {
    const familias = value.familias.filter((f) => f !== familia);
    const has = selectedArticles.has(articleId);
    const articulos = has
      ? value.articulos.filter((id) => id !== articleId)
      : [...value.articulos, articleId];
    onChange({ familias, articulos });
  };

  const clear = () => {
    onChange({ familias: [], articulos: [] });
    setExpanded(new Set());
  };

  return (
    <div className={cn('space-y-2', className)}>
      <Label>{label}</Label>
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className={cn(
              'w-full justify-between font-normal h-auto min-h-10',
              value.familias.length === 0 && value.articulos.length === 0 && 'text-muted-foreground',
            )}
          >
            <span className="truncate text-left flex-1">{summary}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[min(100vw-2rem,28rem)] p-0 z-[250] flex flex-col max-h-[min(20rem,55vh)] overflow-hidden"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="shrink-0 p-2 border-b space-y-2">
            <Input
              placeholder="Buscar familia…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8"
            />
            <p className="text-xs text-muted-foreground px-0.5">
              Solo familias y artículos vinculados a la empresa emisora del informe.
              Marca la familia entera o despliégala para elegir artículos.
            </p>
          </div>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 space-y-1"
            onWheel={handlePopoverListWheel}
          >
            {!companyId ? (
              <p className="text-sm text-muted-foreground px-2 py-3">Empresa no disponible</p>
            ) : billingCompanyIds.length === 0 ? (
              <p className="text-sm text-muted-foreground px-2 py-3">Seleccione empresa emisora</p>
            ) : filteredFamilies.length === 0 ? (
              <p className="text-sm text-muted-foreground px-2 py-3">Sin familias para esta empresa</p>
            ) : (
              filteredFamilies.map((familia) => {
                const isExpanded = expanded.has(familia);
                const familySelected = selectedFamilies.has(familia);

                return (
                  <div key={familia} className="rounded-md border border-transparent hover:border-muted">
                    <div className="flex items-center gap-1 pr-1">
                      <button
                        type="button"
                        className="p-1.5 rounded hover:bg-muted shrink-0"
                        aria-label={isExpanded ? 'Contraer' : 'Desplegar'}
                        onClick={() => toggleExpanded(familia)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                      <label className="flex flex-1 items-center gap-2 py-1.5 cursor-pointer min-w-0">
                        <Checkbox
                          checked={familySelected}
                          onCheckedChange={() => toggleFamily(familia)}
                        />
                        <span className="text-sm font-medium truncate" title={familia}>
                          {familia}
                        </span>
                      </label>
                    </div>
                    {companyId && (
                      <FamilyArticles
                        companyId={companyId}
                        billingCompanyIds={billingCompanyIds}
                        familia={familia}
                        expanded={isExpanded}
                        familySelected={familySelected}
                        selectedArticleIds={selectedArticles}
                        onToggleArticle={(id) => toggleArticle(familia, id)}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
          {(value.familias.length > 0 || value.articulos.length > 0) && (
            <div className="shrink-0 p-2 border-t">
              <Button type="button" variant="ghost" size="sm" className="w-full" onClick={clear}>
                <X className="h-3 w-3 mr-1" />
                Limpiar selección
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  );
};

export const emptyCatalogSelection = (): CatalogTreeSelection => ({
  familias: [],
  articulos: [],
});
