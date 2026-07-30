import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { resolveArticleImageUrl, type ArticleImageSource } from '@/lib/resolveArticleImageUrl';
import { Box, FolderOpen, Gift, Scissors } from 'lucide-react';

type Props = {
  label: string;
  subtitle?: string | null;
  image?: ArticleImageSource | null;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  /** Icono cuando no hay imagen. */
  fallback?: 'product' | 'service' | 'bonus' | 'family';
  className?: string;
};

const FALLBACK_ICON = {
  product: Box,
  service: Scissors,
  bonus: Gift,
  family: FolderOpen,
} as const;

export const ArticleImageTile: React.FC<Props> = ({
  label,
  subtitle,
  image,
  selected,
  disabled,
  onClick,
  fallback = 'product',
  className,
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const imageUrl = image ? resolveArticleImageUrl(image) : null;
  const showImage = Boolean(imageUrl) && !imageFailed;
  const FallbackIcon = FALLBACK_ICON[fallback];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'group flex min-h-[7.5rem] w-full flex-col overflow-hidden rounded-xl border bg-card text-left shadow-sm transition-all',
        'touch-manipulation active:scale-[0.98]',
        selected ? 'border-primary ring-2 ring-primary/40' : 'border-border hover:border-primary/50 hover:shadow-md',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-muted/40">
        {showImage ? (
          <img
            src={imageUrl!}
            alt={label}
            loading="lazy"
            className="h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-500 dark:from-slate-800 dark:to-slate-900 dark:text-slate-300">
            <FallbackIcon className="h-10 w-10 opacity-80" />
          </div>
        )}
      </div>
      <div className="flex min-h-[2.75rem] flex-1 flex-col justify-center gap-0.5 px-2 py-1.5">
        <span className="line-clamp-2 text-center text-[11px] font-medium leading-tight text-foreground">
          {label}
        </span>
        {subtitle ? (
          <span className="line-clamp-1 text-center text-[10px] tabular-nums text-muted-foreground">
            {subtitle}
          </span>
        ) : null}
      </div>
    </button>
  );
};
