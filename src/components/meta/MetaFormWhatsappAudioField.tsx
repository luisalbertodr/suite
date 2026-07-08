import React, { useRef, useState } from 'react';
import { Mic, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  removeMetaFormWhatsappAudio,
  uploadMetaFormWhatsappAudio,
} from '@/lib/metaFormWhatsappAudio';
import type { MetaFormRow } from '@/hooks/useMetaConfig';
import type { useMetaConfig } from '@/hooks/useMetaConfig';

type Props = {
  form: MetaFormRow;
  companyId: string;
  updateForm: ReturnType<typeof useMetaConfig>['updateForm'];
  onToast: (input: { title: string; description?: string; variant?: 'destructive' }) => void;
  /** Etiqueta del checkbox (por defecto: bienvenida automática). */
  checkboxLabel?: string;
  checkboxHint?: string;
};

export const MetaFormWhatsappAudioField: React.FC<Props> = ({
  form,
  companyId,
  updateForm,
  onToast,
  checkboxLabel = 'Audio de campaña disponible',
  checkboxHint = 'No se envía automáticamente al lead. Se usa con el botón «Audio campaña» en el chat de WhatsApp. OGG/Opus recomendado.',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const audioEnabled = form.whatsapp_initial_audio_enabled === true;

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadMetaFormWhatsappAudio(companyId, form.id, file);
      updateForm.mutate({
        id: form.id,
        values: {
          whatsapp_initial_audio_enabled: true,
          whatsapp_initial_audio_path: uploaded.path,
          whatsapp_initial_audio_filename: uploaded.filename,
          whatsapp_initial_audio_mime: uploaded.mime,
        },
      });
      onToast({ title: 'Audio guardado', description: uploaded.filename });
    } catch (e) {
      onToast({
        title: 'Error al subir audio',
        description: e instanceof Error ? e.message : 'No se pudo subir el archivo',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = async () => {
    const path = form.whatsapp_initial_audio_path;
    if (path) {
      try {
        await removeMetaFormWhatsappAudio(path);
      } catch {
        /* ignorar si ya no existe */
      }
    }
    updateForm.mutate({
      id: form.id,
      values: {
        whatsapp_initial_audio_path: null,
        whatsapp_initial_audio_filename: null,
        whatsapp_initial_audio_mime: null,
      },
    });
  };

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-violet-300/70 bg-violet-50/40 p-3 dark:border-violet-900 dark:bg-violet-950/20">
      <label className="flex cursor-pointer items-start gap-2">
        <Checkbox
          checked={audioEnabled}
          onCheckedChange={(v) =>
            updateForm.mutate({
              id: form.id,
              values: { whatsapp_initial_audio_enabled: v === true },
            })
          }
        />
        <span className="text-[11px] leading-snug">
          <span className="font-medium text-foreground">{checkboxLabel}</span>
          <span className="block text-muted-foreground">{checkboxHint}</span>
        </span>
      </label>
      {audioEnabled ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/ogg,audio/opus,.ogg,.opus,application/ogg"
            className="hidden"
            aria-label="Adjuntar audio de campaña"
            onChange={(e) => void handleUpload(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            disabled={uploading || updateForm.isPending}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Mic className="mr-1.5 h-3.5 w-3.5" />
            )}
            {form.whatsapp_initial_audio_filename ? 'Cambiar audio' : 'Adjuntar audio'}
          </Button>
          {form.whatsapp_initial_audio_filename ? (
            <>
              <span className="truncate text-xs text-muted-foreground max-w-[220px]">
                {form.whatsapp_initial_audio_filename}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Quitar audio"
                onClick={() => void handleRemove()}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <span className="text-[10px] text-amber-700 dark:text-amber-400">
              Solo OGG/Opus (nota de voz de WhatsApp)
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
};
