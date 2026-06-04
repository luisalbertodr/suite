import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArticleFamilyPicker } from '@/components/forms/AppointmentArticleFamilyPicker';
import { ARTICLE_SEARCH_MIN_CHARS } from '@/lib/articleSearch';

interface Article {
  id: string;
  codigo: string;
  descripcion: string;
  precio_compra: number;
  precio: number;
  stock_actual: number;
}

interface ArticleDescriptionInputProps {
  value: string;
  onChange: (value: string) => void;
  onArticleSelect: (article: Article) => void;
  articles: Article[];
  articleId?: string | null;
  placeholder?: string;
}

export const ArticleDescriptionInput: React.FC<ArticleDescriptionInputProps> = ({
  value,
  onChange,
  onArticleSelect,
  articles,
  articleId = null,
  placeholder = 'Descripción del producto',
}) => {
  const [localSearch, setLocalSearch] = useState('');

  const filteredArticles =
    localSearch.trim().length >= ARTICLE_SEARCH_MIN_CHARS
      ? articles.filter((article) => {
          const q = localSearch.toLowerCase();
          return (
            article.descripcion.toLowerCase().includes(q) ||
            article.codigo.toLowerCase().includes(q)
          );
        })
      : [];

  const handleInputChange = (newValue: string) => {
    onChange(newValue);
    setLocalSearch(newValue);
  };

  const handlePickerSelect = (picked: {
    id: string;
    codigo: string | null;
    descripcion: string;
    precio: number | null;
  }) => {
    const article = articles.find((a) => a.id === picked.id) ?? {
      id: picked.id,
      codigo: picked.codigo || '',
      descripcion: picked.descripcion,
      precio: Number(picked.precio ?? 0),
      precio_compra: Number(picked.precio ?? 0),
      stock_actual: 0,
    };
    onChange(article.descripcion);
    onArticleSelect(article);
    setLocalSearch('');
  };

  return (
    <div className="space-y-1.5">
      <Input
        value={value}
        onChange={(e) => handleInputChange(e.target.value)}
        placeholder={placeholder}
        className="w-full"
      />
      <div>
        <Label className="text-[10px] text-muted-foreground">Catálogo</Label>
        <ArticleFamilyPicker
          value={articleId}
          itemKind="product"
          selectedLabel={value || undefined}
          triggerClassName="h-9 w-full text-sm mt-0.5"
          onSelect={handlePickerSelect}
          onClear={() => {
            onChange('');
            setLocalSearch('');
          }}
        />
      </div>
      {localSearch.trim().length > 0 && localSearch.trim().length < ARTICLE_SEARCH_MIN_CHARS && (
        <p className="text-[10px] text-muted-foreground">
          Escribe al menos {ARTICLE_SEARCH_MIN_CHARS} caracteres para filtrar la lista local, o usa el catálogo.
        </p>
      )}
      {filteredArticles.length > 0 && (
        <ul className="max-h-32 overflow-y-auto rounded-md border text-sm">
          {filteredArticles.slice(0, 8).map((article) => (
            <li key={article.id}>
              <button
                type="button"
                className="w-full px-2 py-1.5 text-left hover:bg-accent"
                onClick={() => {
                  onChange(article.descripcion);
                  onArticleSelect(article);
                  setLocalSearch('');
                }}
              >
                <span className="font-medium">{article.descripcion}</span>
                <span className="text-xs text-muted-foreground ml-1">
                  {article.codigo} · €{article.precio.toFixed(2)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

};
