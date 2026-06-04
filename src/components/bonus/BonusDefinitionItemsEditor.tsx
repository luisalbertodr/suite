import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import {
  ArticleFamilyPicker,
  articleLabel,
  type AppointmentArticleOption,
} from '@/components/forms/AppointmentArticleFamilyPicker';
import { useNonEmptyArticleFamilies } from '@/hooks/useNonEmptyArticleFamilies';
import type { ArticlePickerKind } from '@/lib/articleSearch';

export type BonoCoverageItem = {
  id?: string;
  coverage_type: 'service' | 'product' | 'family';
  article_id: string | null;
  family_code: string | null;
  covered_quantity: number;
  label: string;
};

type ArticleRow = {
  id: string;
  codigo?: string | null;
  descripcion?: string | null;
  article_kind?: string | null;
  familia?: string | null;
};

interface Props {
  items: BonoCoverageItem[];
  onChange: (next: BonoCoverageItem[]) => void;
  articles: ArticleRow[];
  disabled?: boolean;
}

const coverageToPickerKind = (type: BonoCoverageItem['coverage_type']): ArticlePickerKind => {
  if (type === 'service') return 'service';
  if (type === 'product') return 'product';
  return 'all';
};

const rowArticleLabel = (it: BonoCoverageItem, articles: ArticleRow[]): string => {
  if (it.label?.trim()) return it.label.trim();
  if (it.article_id) {
    const a = articles.find((x) => String(x.id) === String(it.article_id));
    if (a) return articleLabel(a as AppointmentArticleOption);
  }
  if (it.family_code) return `Familia ${it.family_code}`;
  return 'Seleccionar…';
};

export const BonusDefinitionItemsEditor: React.FC<Props> = ({ items, onChange, articles, disabled }) => {
  const hasFamilyRow = items.some((it) => it.coverage_type === 'family');
  const { familyRows, loading: familiesLoading } = useNonEmptyArticleFamilies('all', hasFamilyRow);

  const articleById = useMemo(() => {
    const map = new Map<string, ArticleRow>();
    for (const a of articles) map.set(String(a.id), a);
    return map;
  }, [articles]);

  return (
    <div className="space-y-2">
      <Label>Composición incluida en el precio del bono (servicios, productos, familias)</Label>
      {items.map((it, idx) => {
        const pickerKind = coverageToPickerKind(it.coverage_type);
        const selectedArticle = it.article_id ? articleById.get(String(it.article_id)) : null;
        const selectedLabel = rowArticleLabel(it, articles);
        const selectedPrice =
          selectedArticle && 'precio' in selectedArticle
            ? Number((selectedArticle as { precio?: number | null }).precio ?? 0)
            : null;

        return (
          <div
            key={it.id ?? `row-${idx}`}
            className="grid grid-cols-1 md:grid-cols-[110px_1fr_160px_90px_40px] gap-2 items-center"
          >
            <Select
              value={it.coverage_type}
              disabled={disabled}
              onValueChange={(v: BonoCoverageItem['coverage_type']) => {
                const next = [...items];
                next[idx] = {
                  ...it,
                  coverage_type: v,
                  article_id: null,
                  family_code: null,
                  label: v === 'family' ? 'Familia' : 'Cobertura',
                };
                onChange(next);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="service">Servicio</SelectItem>
                <SelectItem value="product">Producto</SelectItem>
                <SelectItem value="family">Familia</SelectItem>
              </SelectContent>
            </Select>

            {it.coverage_type === 'family' ? (
              <Select
                value={it.family_code ?? 'none'}
                disabled={disabled || familiesLoading}
                onValueChange={(v) => {
                  const next = [...items];
                  const code = v === 'none' ? null : v;
                  next[idx] = {
                    ...it,
                    family_code: code,
                    article_id: null,
                    label: code ? `Familia ${code === '__sin_familia__' ? 'Sin familia' : code}` : 'Familia',
                  };
                  onChange(next);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={familiesLoading ? 'Cargando…' : 'Familia'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Selecciona familia</SelectItem>
                  {familyRows.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f === '__sin_familia__' ? 'Sin familia' : f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <ArticleFamilyPicker
                value={it.article_id}
                itemKind={pickerKind}
                selectedLabel={selectedLabel}
                selectedUnitPrice={selectedPrice}
                disabled={disabled}
                triggerClassName="h-9 w-full text-sm"
                onClear={() => {
                  const next = [...items];
                  next[idx] = { ...it, article_id: null, label: 'Cobertura' };
                  onChange(next);
                }}
                onSelect={(a) => {
                  const next = [...items];
                  next[idx] = {
                    ...it,
                    article_id: a.id,
                    family_code: null,
                    label: articleLabel(a),
                  };
                  onChange(next);
                }}
              />
            )}

            <Input
              value={it.label}
              disabled={disabled}
              onChange={(e) => {
                const next = [...items];
                next[idx] = { ...it, label: e.target.value };
                onChange(next);
              }}
              placeholder="Etiqueta / nota"
            />
            <Input
              type="number"
              min="0"
              step="0.5"
              value={it.covered_quantity}
              disabled={disabled}
              onChange={(e) => {
                const next = [...items];
                next[idx] = { ...it, covered_quantity: Number(e.target.value) };
                onChange(next);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              onClick={() => onChange(items.filter((_, i) => i !== idx))}
              aria-label="Quitar"
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        );
      })}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() =>
          onChange([
            ...items,
            {
              coverage_type: 'service',
              article_id: null,
              family_code: null,
              covered_quantity: 1,
              label: 'Cobertura',
            },
          ])
        }
      >
        <Plus className="w-4 h-4 mr-1" /> Añadir componente
      </Button>
    </div>
  );
};
