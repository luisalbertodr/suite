import React, { useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, ExternalLink, FileText, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { CustomerAttachment } from '@/lib/customerAttachments';
import { DisplayableImage } from '@/components/cliente/DisplayableImage';
import { cn } from '@/lib/utils';

interface Props {
  items: CustomerAttachment[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

function formatDateLabel(ymd: string): string {
  try {
    return format(parseISO(`${ymd}T12:00:00`), "EEEE d MMMM yyyy", { locale: es });
  } catch {
    return ymd;
  }
}

export const AttachmentLightbox: React.FC<Props> = ({
  items,
  index,
  onIndexChange,
  onClose,
}) => {
  const item = items[index];
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) onIndexChange(index - 1);
  }, [hasPrev, index, onIndexChange]);

  const goNext = useCallback(() => {
    if (hasNext) onIndexChange(index + 1);
  }, [hasNext, index, onIndexChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, onClose]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  if (!item || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex flex-col bg-black/95 text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Visor de adjuntos"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 shrink-0">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{item.title}</p>
          <p className="text-xs text-white/70 truncate">
            {formatDateLabel(item.date)} · {item.sourceLabel} · {index + 1} / {items.length}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-white hover:bg-white/10 h-8"
            asChild
          >
            <a href={item.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" />
              Abrir
            </a>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/10 h-8 w-8"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div className="relative flex-1 min-h-0 flex items-center justify-center p-4">
        {hasPrev && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 text-white hover:bg-black/60 z-10"
            onClick={goPrev}
            aria-label="Anterior"
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
        )}

        <div className="w-full h-full flex items-center justify-center">
          {item.isImage ? (
            <DisplayableImage
              url={item.url}
              alt={item.title}
              className="max-h-full max-w-full object-contain select-none"
              draggable={false}
            />
          ) : (
            <div className="flex flex-col items-center gap-4 text-center px-6">
              <FileText className="h-16 w-16 text-white/50" />
              <p className="text-lg font-medium">{item.title}</p>
              <p className="text-sm text-white/70">{item.sourceLabel}</p>
              <Button variant="secondary" asChild>
                <a href={item.url} target="_blank" rel="noopener noreferrer">
                  Abrir documento
                </a>
              </Button>
            </div>
          )}
        </div>

        {hasNext && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/40 text-white hover:bg-black/60 z-10"
            onClick={goNext}
            aria-label="Siguiente"
          >
            <ChevronRight className="h-6 w-6" />
          </Button>
        )}
      </div>
    </div>,
    document.body,
  );
};

interface ThumbProps {
  item: CustomerAttachment;
  onClick: () => void;
  onDelete?: () => void;
  deleting?: boolean;
  className?: string;
}

export function AttachmentThumbnail({ item, onClick, onDelete, deleting, className }: ThumbProps) {
  return (
    <div
      className={cn(
        'group relative aspect-square rounded-lg overflow-hidden border border-border/60 bg-muted/30',
        className,
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'absolute inset-0 w-full h-full',
          'hover:ring-2 hover:ring-sky-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg',
        )}
        title={item.title}
      >
        {item.isImage ? (
          <DisplayableImage
            url={item.url}
            alt={item.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center gap-1 p-2 text-muted-foreground">
            <FileText className="h-8 w-8 opacity-60" />
            <span className="text-[10px] line-clamp-2 text-center leading-tight">{item.title}</span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 py-1.5 pt-6 pointer-events-none">
          <p className="text-[10px] text-white truncate">{item.title}</p>
          <p className="text-[9px] text-white/75 truncate">{item.sourceLabel}</p>
        </div>
      </button>
      {onDelete ? (
        <Button
          type="button"
          variant="destructive"
          size="icon"
          className="absolute top-1 right-1 z-10 h-7 w-7 rounded-full shadow-md opacity-90 hover:opacity-100"
          disabled={deleting}
          aria-label="Eliminar foto"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );
}
