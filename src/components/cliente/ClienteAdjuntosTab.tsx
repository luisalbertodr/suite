import React, { useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { ImageIcon, Images, Paperclip } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useCustomerAttachments } from '@/hooks/useCustomerAttachments';
import { useCustomerFileUpload } from '@/hooks/useCustomerFileUpload';
import { useCustomerDetail } from '@/hooks/useCustomerDetail';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import {
  deletableCustomerAttachmentAssetId,
  groupCustomerAttachmentsByDate,
  isDocumentGalleryItem,
  isPhotoGalleryItem,
} from '@/lib/customerAttachments';
import { AttachmentLightbox, AttachmentThumbnail } from '@/components/cliente/AttachmentLightbox';
import { ImmichImportDialog } from '@/components/cliente/ImmichImportDialog';
import { ImportFilesButton } from '@/components/cliente/ImportFilesButton';
import { cn } from '@/lib/utils';

interface Props {
  customerId: string;
  compact?: boolean;
}

type GalleryFilter = 'photos' | 'documents';

function formatGroupDate(ymd: string): string {
  try {
    return format(parseISO(`${ymd}T12:00:00`), "EEEE d 'de' MMMM yyyy", { locale: es });
  } catch {
    return ymd;
  }
}

export const ClienteAdjuntosTab: React.FC<Props> = ({ customerId, compact }) => {
  const {
    data: attachments = [],
    isLoading,
    isError,
    error,
    removeAttachment,
    isRemoving,
  } = useCustomerAttachments(customerId);
  const { customer } = useCustomerDetail(customerId);
  const { companyId } = useCompanyFilter();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [immichOpen, setImmichOpen] = useState(false);
  const [galleryFilter, setGalleryFilter] = useState<GalleryFilter>('photos');
  const { toast } = useToast();
  const { uploadMany, isUploading } = useCustomerFileUpload(customerId, companyId ?? undefined);

  const customerLabel = customer.data?.name?.trim() || 'Cliente';

  const handleImportFiles = async (files: FileList) => {
    if (!companyId) return;
    try {
      await uploadMany(files);
      toast({
        title: 'Archivos importados',
        description: `${files.length} archivo(s) añadido(s) al cliente.`,
      });
    } catch (e) {
      toast({
        title: 'Error al importar',
        description: e instanceof Error ? e.message : 'No se pudieron subir los archivos.',
        variant: 'destructive',
      });
    }
  };

  const photoAttachments = useMemo(
    () => attachments.filter(isPhotoGalleryItem),
    [attachments],
  );
  const documentAttachments = useMemo(
    () => attachments.filter(isDocumentGalleryItem),
    [attachments],
  );

  const visibleAttachments = galleryFilter === 'photos' ? photoAttachments : documentAttachments;

  const groups = useMemo(
    () => groupCustomerAttachmentsByDate(visibleAttachments),
    [visibleAttachments],
  );

  const flatIndexById = useMemo(() => {
    const map = new Map<string, number>();
    visibleAttachments.forEach((item, i) => map.set(item.id, i));
    return map;
  }, [visibleAttachments]);

  const openLightbox = (id: string) => {
    const idx = flatIndexById.get(id);
    if (idx != null) setLightboxIndex(idx);
  };

  const handleDelete = (itemId: string) => {
    const item = attachments.find((a) => a.id === itemId);
    if (!item) return;
    const assetId = deletableCustomerAttachmentAssetId(item);
    if (!assetId) return;
    if (!window.confirm(`¿Eliminar «${item.title}»?`)) return;
    void removeAttachment(assetId);
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

  const canImport = Boolean(companyId && customer.data);
  const photoCount = photoAttachments.length;
  const docCount = documentAttachments.length;

  const importActions = canImport ? (
    <div className="flex flex-wrap items-center gap-2">
      <ImportFilesButton
        size={compact ? 'sm' : 'default'}
        inputId={`customer-files-${customerId}`}
        disabled={!canImport}
        uploading={isUploading}
        onFiles={handleImportFiles}
      />
      <Button
        type="button"
        variant="outline"
        size={compact ? 'sm' : 'default'}
        className="gap-2"
        onClick={() => setImmichOpen(true)}
      >
        <Images className="h-4 w-4" />
        Importar desde Immich
      </Button>
    </div>
  ) : null;

  const immichDialog = canImport ? (
    <ImmichImportDialog
      open={immichOpen}
      onOpenChange={setImmichOpen}
      customerId={customerId}
      companyId={companyId!}
      customerLabel={customerLabel}
    />
  ) : null;

  const galleryToggle = (
    <div
      className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-muted/30 p-1"
      role="tablist"
      aria-label="Ver fotos o documentos"
    >
      <button
        type="button"
        role="tab"
        aria-selected={galleryFilter === 'photos'}
        onClick={() => {
          setGalleryFilter('photos');
          setLightboxIndex(null);
        }}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
          galleryFilter === 'photos'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
        title="Ver fotos"
      >
        <ImageIcon className="h-4 w-4" />
        <span className="tabular-nums">{photoCount}</span>
        <span className="sr-only sm:not-sr-only sm:inline">
          foto{photoCount === 1 ? '' : 's'}
        </span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={galleryFilter === 'documents'}
        onClick={() => {
          setGalleryFilter('documents');
          setLightboxIndex(null);
        }}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm transition-colors',
          galleryFilter === 'documents'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground',
        )}
        title="Ver documentos"
      >
        <Paperclip className="h-4 w-4" />
        <span className="tabular-nums">{docCount}</span>
        <span className="sr-only sm:not-sr-only sm:inline">
          documento{docCount === 1 ? '' : 's'}
        </span>
      </button>
    </div>
  );

  if (!attachments.length) {
    return (
      <div
        className={cn(
          'rounded-xl border border-dashed border-sky-200/80 bg-sky-50/40 dark:border-sky-800/50 dark:bg-sky-950/20 px-4 py-10 text-center space-y-4',
          compact && 'py-8',
        )}
      >
        <Paperclip className="h-10 w-10 mx-auto text-muted-foreground/40" />
        <div>
          <p className="font-medium text-foreground">Sin adjuntos</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            Las fotos de citas, historial clínico y consentimientos firmados aparecerán aquí ordenados
            por fecha. Desde Immich puedes marcar escaneos como documento.
          </p>
        </div>
        <div className="flex justify-center w-full">{importActions}</div>
        {immichDialog}
      </div>
    );
  }

  return (
    <>
      {immichDialog}
      <div className={cn('space-y-5', compact && 'space-y-4')}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            {galleryToggle}
            <span className="text-xs text-muted-foreground">
              Pulsa el icono de foto o de adjunto para cambiar de vista
            </span>
          </div>
          {importActions}
        </div>

        {groups.length === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
            {galleryFilter === 'photos'
              ? 'No hay fotos en esta ficha. Cambia a documentos o importa desde Immich.'
              : 'No hay documentos. En Immich marca «Marcar como documento» al importar escaneos o consentimientos.'}
          </div>
        ) : (
          groups.map((group) => (
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
                    onDelete={
                      deletableCustomerAttachmentAssetId(item)
                        ? () => handleDelete(item.id)
                        : undefined
                    }
                    deleting={isRemoving}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {lightboxIndex != null && (
        <AttachmentLightbox
          items={visibleAttachments}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
};
