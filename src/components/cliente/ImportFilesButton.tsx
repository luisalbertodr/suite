import React, { useRef } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CUSTOMER_IMPORT_FILE_ACCEPT } from '@/lib/customerImportFiles';
import { cn } from '@/lib/utils';

interface Props {
  onFiles: (files: FileList) => void | Promise<void>;
  disabled?: boolean;
  uploading?: boolean;
  size?: 'sm' | 'default';
  className?: string;
  accept?: string;
  inputId?: string;
}

export const ImportFilesButton: React.FC<Props> = ({
  onFiles,
  disabled,
  uploading,
  size = 'default',
  className,
  accept = CUSTOMER_IMPORT_FILE_ACCEPT,
  inputId = 'import-customer-files',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        aria-label="Importar archivos"
        onChange={(e) => {
          const list = e.target.files;
          if (list?.length) void onFiles(list);
          e.target.value = '';
        }}
      />
      <Button
        type="button"
        variant="outline"
        size={size}
        className={cn('gap-2', size === 'sm' && 'h-7 text-xs gap-1', className)}
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className={cn('animate-spin', size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
        ) : (
          <Upload className={cn(size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
        )}
        Importar archivos
      </Button>
    </>
  );
};
