import React, { useState } from 'react';
import {
  ArticleFamilyPicker,
  articleLabelWithPrice,
  type AppointmentArticleOption,
} from '@/components/forms/AppointmentArticleFamilyPicker';
import type { ArticlePickerKind } from '@/lib/articleSearch';

interface Article {
  id: string;
  codigo: string;
  descripcion: string;
  precio: number;
  stock_actual: number;
  codigo_barras?: string;
  iva_percentage?: number;
}

interface ArticleSearchProps {
  onAddArticle: (article: Article) => void;
  /** Tipo de artículos a listar en el árbol y la búsqueda. */
  itemKind?: ArticlePickerKind;
}

export const ArticleSearch: React.FC<ArticleSearchProps> = ({
  onAddArticle,
  itemKind = 'all',
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | undefined>();

  const handleSelect = (article: AppointmentArticleOption) => {
    setSelectedId(article.id);
    setSelectedLabel(articleLabelWithPrice(article));
    onAddArticle({
      id: article.id,
      codigo: article.codigo || '',
      descripcion: article.descripcion,
      precio: Number(article.precio ?? 0),
      stock_actual: 0,
    });
    setSelectedId(null);
    setSelectedLabel(undefined);
  };

  return (
    <div className="py-2">
      <p className="text-sm text-muted-foreground mb-3">
        Busca con al menos 3 caracteres o navega por familias con artículos activos.
      </p>
      <ArticleFamilyPicker
        value={selectedId}
        itemKind={itemKind}
        selectedLabel={selectedLabel}
        triggerClassName="h-10 w-full text-sm"
        placeholder="Seleccionar artículo del catálogo…"
        onSelect={handleSelect}
      />
    </div>
  );
};
