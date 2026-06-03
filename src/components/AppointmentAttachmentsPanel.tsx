import React, { useMemo, useState } from 'react';
import { FileText, Images, Paperclip, Trash2 } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { ImportFilesButton } from '@/components/cliente/ImportFilesButton';
import { AttachmentLightbox } from '@/components/cliente/AttachmentLightbox';
import { useAppointmentAssets } from '@/hooks/useAppointmentAssets';
import {
  appointmentAssetPublicUrl,
  isAppointmentAssetImage,
  type AppointmentAssetRow,
} from '@/lib/appointmentAssets';
import type { CustomerAttachment } from '@/lib/customerAttachments';
import { DisplayableImage } from '@/components/cliente/DisplayableImage';
import { ImmichImportDialog } from '@/components/cliente/ImmichImportDialog';
import { cn } from '@/lib/utils';

interface Props {
  appointmentId: string;
  customerId?: string | null;
  companyId?: string | null;
  logDate: string;
  customerLabel?: string;
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

function appointmentAssetsToLightboxItems(
  assets: AppointmentAssetRow[],
  logDate: string,
): CustomerAttachment[] {
  return assets.flatMap((asset) => {
    const url = appointmentAssetPublicUrl(asset.storage_path);
    if (!url) return [];
    const isImage = isAppointmentAssetImage(asset);
    return [
      {
        id: asset.id,
        date: logDate,
        createdAt: asset.created_at,
        url,
        title: asset.title?.trim() || assetKindLabel(asset.asset_kind),
        kind: isImage ? 'photo' : 'document',
        source: 'cita',
        sourceLabel: 'Cita',
        isImage,
      },
    ];
  });
}

function AppointmentAssetThumb({
  asset,
  onOpen,
  onRemove,
  removing,
}: {
  asset: AppointmentAssetRow;
  onOpen: () => void;
  onRemove: (id: string) => void;
  removing: boolean;
}) {
  const url = appointmentAssetPublicUrl(asset.storage_path);
  const isImage = isAppointmentAssetImage(asset);

  return (
    <div className="group relative aspect-square rounded-lg overflow-hidden border border-border/60 bg-muted/30">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'absolute inset-0 w-full h-full flex items-center justify-center',
          'hover:ring-2 hover:ring-sky-500/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 rounded-lg',
        )}
        title={asset.title || assetKindLabel(asset.asset_kind)}
      >
        {isImage && url ? (
          <DisplayableImage
            url={url}
            alt={asset.title || assetKindLabel(asset.asset_kind)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 p-2 text-center text-muted-foreground">
            <FileText className="h-8 w-8 opacity-60" />
            <span className="text-[10px] line-clamp-2 leading-tight">
              {asset.title || 'Documento'}
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-2 py-1.5 pt-5 pointer-events-none">
          <p className="text-[10px] text-white truncate">{assetKindLabel(asset.asset_kind)}</p>
          {asset.title ? (
            <p className="text-[9px] text-white/75 truncate">{asset.title}</p>
          ) : null}
        </div>
      </button>
      <Button
        type="button"
        variant="destructive"
        size="icon"
        className="absolute top-1 right-1 z-10 h-7 w-7 rounded-full shadow-md opacity-90 hover:opacity-100"
        disabled={removing}
        aria-label="Eliminar adjunto"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(asset.id);
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export const AppointmentAttachmentsPanel: React.FC<Props> = ({
  appointmentId,
  customerId,
  companyId,
  logDate,
  customerLabel = 'Cliente',
  className,
}) => {
  const [immichOpen, setImmichOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const { assets, isLoading, upload, isUploading, remove, isRemoving } = useAppointmentAssets(
    appointmentId,
    { customerId, companyId, logDate },
  );

  const canUpload = !!customerId && !!companyId && !!logDate;

  const lightboxItems = useMemo(
    () => appointmentAssetsToLightboxItems(assets, logDate),
    [assets, logDate],
  );

  const lightboxIndexByAssetId = useMemo(() => {
    const map = new Map<string, number>();
    lightboxItems.forEach((item, i) => map.set(item.id, i));
    return map;
  }, [lightboxItems]);

  const openLightbox = (assetId: string) => {
    const idx = lightboxIndexByAssetId.get(assetId);
    if (idx != null) setLightboxIndex(idx);
  };

  const handleFiles = async (files: FileList) => {
    for (const file of Array.from(files)) {
      await upload(file);
    }
  };

  const handleRemove = (assetId: string) => {
    if (!window.confirm('¿Eliminar este adjunto?')) return;
    void remove(assetId);
  };

  const immichDialog =
    canUpload && customerId && companyId ? (
      <ImmichImportDialog
        open={immichOpen}
        onOpenChange={setImmichOpen}
        customerId={customerId}
        companyId={companyId}
        customerLabel={customerLabel}
        appointmentId={appointmentId}
        logDate={logDate}
        defaultAnchorDate={logDate}
        dialogLayerClass="z-[110]"
      />
    ) : null;

  return (
    <div className={cn('space-y-2', className)}>
      {immichDialog}
      {lightboxIndex != null && lightboxItems.length > 0 ? (
        <AttachmentLightbox
          items={lightboxItems}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Label className="text-xs flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
          Fotos y adjuntos
          {assets.length > 0 ? (
            <span className="text-muted-foreground font-normal">({assets.length})</span>
          ) : null}
        </Label>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          <ImportFilesButton
            inputId={`appointment-files-${appointmentId}`}
            size="sm"
            disabled={!canUpload}
            uploading={isUploading}
            onFiles={handleFiles}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            disabled={!canUpload}
            onClick={() => setImmichOpen(true)}
          >
            <Images className="h-3.5 w-3.5" />
            Immich
          </Button>
        </div>
      </div>

      {!canUpload && (
        <p className="text-[10px] text-muted-foreground">
          Vincula un cliente a la cita para poder adjuntar fotos y documentos.
        </p>
      )}

      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-square rounded-lg border bg-muted/20 animate-pulse" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <div className="min-h-[88px] rounded-md border border-dashed flex items-center justify-center text-[11px] text-muted-foreground px-4 text-center">
          Sin adjuntos en esta cita. Usa Importar archivos o Immich.
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[280px] overflow-y-auto pr-0.5">
          {assets.map((asset) => (
            <AppointmentAssetThumb
              key={asset.id}
              asset={asset}
              onOpen={() => openLightbox(asset.id)}
              onRemove={handleRemove}
              removing={isRemoving}
            />
          ))}
        </div>
      )}
    </div>
  );
};
