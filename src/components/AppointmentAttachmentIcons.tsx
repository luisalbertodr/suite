import React from 'react';
import { Camera, FileSignature, Paperclip } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { AppointmentAttachmentHints } from '@/lib/appointmentAttachmentHints';
import { hasAttachmentHints } from '@/lib/appointmentAttachmentHints';
import { cn } from '@/lib/utils';

interface Props {
  attachments: AppointmentAttachmentHints;
  className?: string;
  iconClassName?: string;
}

export const AppointmentAttachmentIcons: React.FC<Props> = ({
  attachments,
  className,
  iconClassName = 'h-3 w-3',
}) => {
  const { photos, signedConsents, documents } = attachments;
  if (!hasAttachmentHints(attachments)) return null;

  return (
    <TooltipProvider delayDuration={200}>
      <span className={cn('inline-flex items-center gap-0.5 shrink-0', className)}>
        {photos && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="inline-flex text-sky-600 dark:text-sky-400"
                aria-label="Fotos adjuntas"
              >
                <Camera className={iconClassName} aria-hidden />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Fotos adjuntas
            </TooltipContent>
          </Tooltip>
        )}
        {signedConsents && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="inline-flex text-emerald-600 dark:text-emerald-400"
                aria-label="Consentimiento firmado"
              >
                <FileSignature className={iconClassName} aria-hidden />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Consentimiento firmado
            </TooltipContent>
          </Tooltip>
        )}
        {documents && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="inline-flex text-amber-700 dark:text-amber-400"
                aria-label="Documentos adjuntos"
              >
                <Paperclip className={iconClassName} aria-hidden />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              Documentos adjuntos
            </TooltipContent>
          </Tooltip>
        )}
      </span>
    </TooltipProvider>
  );
};
