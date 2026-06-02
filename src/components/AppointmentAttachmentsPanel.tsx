import React, { useRef } from 'react';
import { FileText, ImagePlus, Loader2, Paperclip, Trash2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { useAppointmentAssets } from '@/hooks/useAppointmentAssets';
import {
  appointmentAssetPublicUrl,
  isAppointmentAssetImage,
  type AppointmentAssetRow,
} from '@/lib/appointmentAssets';
import { cn } from '@/lib/utils';

interface Props {
  appointmentId: string;
  customerId?: string | null;
  companyId?: string | null;
  logDate: string;
  className?: string;
}

function assetKindLabel(kind: AppointmentAssetRow['asset_kind']): string {
  switch (kind) {
    case 'photo_before':
      return 'Foto antes';
    case 'photo_after':
      return 'Foto';
    case 'consent':
      return 'Consentimiento';
    case 'document':
      return 'Documento';
    default:
      return 'Adjunto';
  }
}

function AssetSlide({
  asset,
  onRemove,
  removing,
}: {
  asset: AppointmentAssetRow;
  onRemove: (id: string) => void;
  removing: boolean;
}) {
  const url = appointmentAssetPublicUrl(asset.storage_path);
  const isImage = isAppointmentAssetImage(asset);

  return (
    <div className="relative rounded-md border bg-background overflow-hidden h-[140px] flex flex-col">
      <div className="flex-1 min-h-0 flex items-center justify-center bg-muted/30">
        {isImage && url ? (
          <img
            src={url}
            alt={asset.title || assetKindLabel(asset.asset_kind)}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 px-3 text-center text-muted-foreground">
            <FileText className="h-8 w-8 opacity-60" />
            <span className="text-[10px] line-clamp-2">{asset.title || 'Documento'}</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-1 px-2 py-1 border-t bg-background/95 text-[10px]">
        <span className="truncate text-muted-foreground">{assetKindLabel(asset.asset_kind)}</span>
        <div className="flex items-center gap-0.5 shrink-0">
          {url && !isImage && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline px-1"
              onClick={(e) => e.stopPropagation()}
            >
              Abrir
            </a>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
            disabled={removing}
            onClick={() => onRemove(asset.id)}
            aria-label="Eliminar adjunto"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export const AppointmentAttachmentsPanel: React.FC<Props> = ({
  appointmentId,
  customerId,
  companyId,
  logDate,
  className,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { assets, isLoading, upload, isUploading, remove, isRemoving } = useAppointmentAssets(
    appointmentId,
    { customerId, companyId, logDate },
  );

  const canUpload = !!customerId && !!companyId && !!logDate;

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      await upload(file);
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
          Fotos y adjuntos
        </Label>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            multiple
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            disabled={!canUpload || isUploading}
            onClick={() => inputRef.current?.click()}
          >
            {isUploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ImagePlus className="h-3.5 w-3.5" />
            )}
            Añadir
          </Button>
        </div>
      </div>

      {!canUpload && (
        <p className="text-[10px] text-muted-foreground">
          Vincula un cliente a la cita para poder adjuntar fotos y documentos.
        </p>
      )}

      {isLoading ? (
        <div className="h-[140px] rounded-md border bg-muted/20 animate-pulse" />
      ) : assets.length === 0 ? (
        <div className="h-[88px] rounded-md border border-dashed flex items-center justify-center text-[11px] text-muted-foreground px-4 text-center">
          Sin adjuntos en esta cita. Añade fotos o documentos firmados.
        </div>
      ) : (
        <Carousel opts={{ align: 'start' }} className="w-full">
          <CarouselContent className="-ml-2">
            {assets.map((asset) => (
              <CarouselItem key={asset.id} className="pl-2 basis-[72%] sm:basis-[55%]">
                <AssetSlide asset={asset} onRemove={remove} removing={isRemoving} />
              </CarouselItem>
            ))}
          </CarouselContent>
          {assets.length > 1 && (
            <>
              <CarouselPrevious className="left-0 h-7 w-7 -translate-y-1/2 top-1/2" />
              <CarouselNext className="right-0 h-7 w-7 -translate-y-1/2 top-1/2" />
            </>
          )}
        </Carousel>
      )}
    </div>
  );
};
