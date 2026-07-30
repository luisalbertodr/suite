import React, { useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import { articleMatchesPickerKind, type ArticlePickerKind } from '@/lib/articleSearch';
import { useNonEmptyArticleFamilies } from '@/hooks/useNonEmptyArticleFamilies';
import { ABOVE_DOCK_DIALOG_MAX_H, ABOVE_DOCK_DIALOG_POSITION, ABOVE_DOCK_DIALOG_Z } from '@/lib/dialogLayers';
import { cn } from '@/lib/utils';
import { ArticleImageTile } from '@/components/forms/ArticleImageTile';

const SIN_FAMILIA_KEY = '__sin_familia__';

function familyLabel(key: string): string {
  return key === SIN_FAMILIA_KEY ? 'Sin familia' : key;
}

function familyKeyFromArticle(familia: string | null | undefined): string {
  const name = String(familia ?? '').trim();
  return name ? name : SIN_FAMILIA_KEY;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  itemKind?: ArticlePickerKind;
  selectedFamily?: string | null;
  onSelect: (familyKey: string) => void;
};

export const FamilyGridPickerDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  itemKind = 'all',
  selectedFamily,
  onSelect,
}) => {
  const { companyId } = useCompanyFilter();
  const { catalogHostCompanyId } = useWorkCenter();
  const catalogCompanyId = catalogHostCompanyId ?? companyId;
  const { familyRows, loading } = useNonEmptyArticleFamilies(itemKind, open);

  const { data: familyIndex = [] } = useQuery({
    queryKey: ['articles-family-index', catalogCompanyId, itemKind],
    enabled: Boolean(catalogCompanyId && open),
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

  const handleSelect = (familyKey: string) => {
    onSelect(familyKey);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          <DialogTitle>Seleccionar familia</DialogTitle>
          <DialogDescription>Toca la familia que quieras incluir en el bono.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain touch-pan-y pr-1">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando familias…</p>
          ) : familyRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No hay familias disponibles.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 sm:gap-3">
              {familyRows.map((famKey) => (
                <ArticleImageTile
                  key={famKey}
                  label={familyLabel(famKey)}
                  image={familyThumbnails.get(famKey) ?? null}
                  selected={selectedFamily === famKey}
                  fallback="family"
                  onClick={() => handleSelect(famKey)}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
