import React, { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';

export type BonoCoverageItem = {
  id?: string;
  coverage_type: 'service' | 'product' | 'family';
  article_id: string | null;
  family_code: string | null;
  covered_quantity: number;
  label: string;
};

type ArticleRow = { id: string; codigo?: string | null; descripcion?: string | null; article_kind?: string | null; familia?: string | null };

interface Props {
  items: BonoCoverageItem[];
  onChange: (next: BonoCoverageItem[]) => void;
  articles: ArticleRow[];
  /** Si true, el usuario no puede añadir/editar (ej. aún no hay artículo guardado) */
  disabled?: boolean;
}

const articleLabel = (a: ArticleRow) => `${a?.codigo ? `${a.codigo} - ` : ''}${a?.descripcion || 'Artículo'}`.trim();

export const BonusDefinitionItemsEditor: React.FC<Props> = ({ items, onChange, articles, disabled }) => {
  const articleById = useMemo(() => {
    const map = new Map<string, ArticleRow>();
    for (const a of articles) map.set(String(a.id), a);
    return map;
  }, [articles]);

  const families = useMemo(
    () => [...new Set(articles.map((a) => String(a.familia || '').trim()).filter(Boolean))],
    [articles]
  );

  const filteredArticles = (type: BonoCoverageItem['coverage_type']) => {
    const toKind = (v: unknown) => String(v || '').toLowerCase();
    if (type === 'service') return articles.filter((a) => toKind(a.article_kind).includes('serv'));
    if (type === 'product') {
      return articles.filter((a) => {
        const k = toKind(a.article_kind);
        return k.includes('prod') || k.includes('bono') || k.includes('standard') || k.includes('textil') || k.includes('calzado');
      });
    }
    return articles;
  };

  return (
    <div className="space-y-2">
      <Label>Composición incluida en el precio del bono (servicios, productos, familias)</Label>
      {items.map((it, idx) => (
        <div key={it.id ?? `row-${idx}`} className="grid grid-cols-1 md:grid-cols-[110px_1fr_160px_90px_40px] gap-2 items-center">
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
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="service">Servicio</SelectItem>
              <SelectItem value="product">Producto</SelectItem>
              <SelectItem value="family">Familia</SelectItem>
            </SelectContent>
          </Select>

          {it.coverage_type === 'family' ? (
            <Select
              value={it.family_code ?? 'none'}
              disabled={disabled}
              onValueChange={(v) => {
                const next = [...items];
                next[idx] = { ...it, family_code: v === 'none' ? null : v, article_id: null, label: v === 'none' ? 'Familia' : `Familia ${v}` };
                onChange(next);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Familia" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecciona familia</SelectItem>
                {families.map((f) => (
                  <SelectItem key={f} value={f}>{f}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select
              value={it.article_id ?? 'none'}
              disabled={disabled}
              onValueChange={(v) => {
                const a = v === 'none' ? null : articleById.get(String(v));
                const next = [...items];
                next[idx] = { ...it, article_id: v === 'none' ? null : String(v), family_code: null, label: a ? articleLabel(a) : 'Cobertura' };
                onChange(next);
              }}
            >
              <SelectTrigger><SelectValue placeholder="Servicio / producto" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecciona artículo</SelectItem>
                {filteredArticles(it.coverage_type).map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>{articleLabel(a)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() =>
          onChange([
            ...items,
            { coverage_type: 'service', article_id: null, family_code: null, covered_quantity: 1, label: 'Cobertura' },
          ])
        }
      >
        <Plus className="w-4 h-4 mr-1" /> Añadir componente
      </Button>
    </div>
  );
};
