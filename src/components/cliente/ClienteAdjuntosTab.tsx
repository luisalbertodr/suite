import React, { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ImageIcon, Paperclip } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useCustomerAttachments } from '@/hooks/useCustomerAttachments';
import { groupCustomerAttachmentsByDate } from '@/lib/customerAttachments';
import { AttachmentLightbox, AttachmentThumbnail } from '@/components/cliente/AttachmentLightbox';
import { cn } from '@/lib/utils';

interface Props {
  customerId: string;
  compact?: boolean;
}

function formatGroupDate(ymd: string): string {
  try {
    return format(parseISO(`${ymd}T12:00:00`), "EEEE d 'de' MMMM yyyy", { locale: es });
  } catch {
    return ymd;
  }
}

export const ClienteAdjuntosTab: React.FC<Props> = ({ customerId, compact }) => {
  const { data: attachments = [], isLoading, isError, error } = useCustomerAttachments(customerId);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const groups = useMemo(() => groupCustomerAttachmentsByDate(attachments), [attachments]);

  const flatIndexById = useMemo(() => {
    const map = new Map<string, number>();
    attachments.forEach((item, i) => map.set(item.id, i));
    return map;
  }, [attachments]);

  const openLightbox = (id: string) => {
    const idx = flatIndexById.get(id);
    if (idx != null) setLightboxIndex(idx);
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-4', compact && 'space-y-3')}>
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="aspect-square rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive" role="alert">
        {error instanceof Error ? error.message : 'No se pudieron cargar los adjuntos.'}
      </p>
    );
  }

  if (!attachments.length) {
    return (
      <div
        className={cn(
          'rounded-xl border border-dashed border-sky-200/80 bg-sky-50/40 dark:border-sky-800/50 dark:bg-sky-950/20 px-4 py-10 text-center',
          compact && 'py-8',
        )}
      >
        <Paperclip className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
        <p className="font-medium text-foreground">Sin adjuntos</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
          Las fotos de citas, historial clínico y consentimientos firmados aparecerán aquí ordenados por fecha.
        </p>
      </div>
    );
  }

  const photoCount = attachments.filter((a) => a.isImage).length;
  const docCount = attachments.length - photoCount;

  return (
    <>
      <div className={cn('space-y-5', compact && 'space-y-4')}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <ImageIcon className="h-4 w-4" />
            {photoCount} foto{photoCount === 1 ? '' : 's'}
          </span>
          <span className="flex items-center gap-1.5">
            <Paperclip className="h-4 w-4" />
            {docCount} documento{docCount === 1 ? '' : 's'}
          </span>
          <span className="text-xs">Pulsa una miniatura para ver a pantalla completa</span>
        </div>

        {groups.map((group) => (
          <section key={group.date}>
            <h3
              className={cn(
                'font-semibold text-foreground capitalize sticky top-0 z-[1] py-1.5',
                'bg-background/95 backdrop-blur-sm border-b border-border/40 mb-2',
                compact ? 'text-xs' : 'text-sm',
              )}
            >
              {formatGroupDate(group.date)}
              <span className="ml-2 font-normal text-muted-foreground tabular-nums">
                ({group.items.length})
              </span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {group.items.map((item) => (
                <AttachmentThumbnail
                  key={item.id}
                  item={item}
                  onClick={() => openLightbox(item.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {lightboxIndex != null && (
        <AttachmentLightbox
          items={attachments}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
};
