import React from 'react';
import { Loader2 } from 'lucide-react';
import { useDisplayableImageSrc } from '@/hooks/useDisplayableImageSrc';
import { cn } from '@/lib/utils';

interface Props extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  url: string;
}

/** Imagen con soporte HEIC: convierte en cliente si el navegador no la pinta. */
export const DisplayableImage: React.FC<Props> = ({ url, alt, className, ...rest }) => {
  const { src, loading, failed } = useDisplayableImageSrc(url);

  if (loading) {
    return (
      <div
        className={cn('flex items-center justify-center bg-muted/40', className)}
        aria-hidden
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!src || failed) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-muted/40 text-[10px] text-muted-foreground px-2 text-center',
          className,
        )}
      >
        Vista previa no disponible
      </div>
    );
  }

  return <img src={src} alt={alt} className={className} {...rest} />;
};
