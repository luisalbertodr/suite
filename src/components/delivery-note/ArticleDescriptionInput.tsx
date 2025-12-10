
import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  placeholder?: string;
}

export const ArticleDescriptionInput: React.FC<ArticleDescriptionInputProps> = ({
  value,
  onChange,
  onArticleSelect,
  articles,
  placeholder = "Descripción del producto"
}) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredArticles = articles.filter(article =>
    article.descripcion.toLowerCase().includes(searchTerm.toLowerCase()) ||
    article.codigo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleInputChange = (newValue: string) => {
    console.log('ArticleDescriptionInput - Input changed to:', newValue);
    onChange(newValue);
    setSearchTerm(newValue);
    if (newValue.length > 0 && filteredArticles.length > 0) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  const handleArticleSelect = (article: Article) => {
    console.log('ArticleDescriptionInput - Article selected:', article);
    // Primero actualizamos la descripción
    onChange(article.descripcion);
    // Luego notificamos que se seleccionó un artículo
    onArticleSelect(article);
    setOpen(false);
    setSearchTerm('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' && filteredArticles.length > 0) {
      e.preventDefault();
      setOpen(true);
    }
  };

  useEffect(() => {
    if (!open) {
      setSearchTerm('');
    }
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full"
          />
          {articles.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
              onClick={() => setOpen(!open)}
              type="button"
            >
              <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
            </Button>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput
            placeholder="Buscar artículos..."
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            <CommandEmpty>No se encontraron artículos.</CommandEmpty>
            <CommandGroup>
              {filteredArticles.slice(0, 10).map((article) => (
                <CommandItem
                  key={article.id}
                  value={article.descripcion}
                  onSelect={() => handleArticleSelect(article)}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === article.descripcion ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">{article.descripcion}</span>
                    <span className="text-sm text-gray-500">
                      {article.codigo} - €{article.precio.toFixed(2)} - Stock: {article.stock_actual}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};
