import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useWorkCenter } from '@/hooks/useWorkCenter';
import type { PostgrestError } from '@supabase/supabase-js';

export type WorkCenterBranding = {
  displayName: string;
  logoUrlLight: string | null;
  logoUrlDark: string | null;
  /** Tabla donde se persiste el logo */
  storage: 'work_centers' | 'companies';
  storageId: string;
};

async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
    reader.readAsDataURL(file);
  });
}

function isMissingColumnError(error: unknown, column: string): boolean {
  const e = error as PostgrestError | null | undefined;
  if (!e) return false;
  if (e.code === '42703' || e.code === 'PGRST204') {
    const msg = String(e.message || '').toLowerCase();
    return msg.includes(column.toLowerCase());
  }
  return false;
}

export function useWorkCenterBranding() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    workCenterId,
    workCenter,
    hostCompany,
    companyId,
    loading: wcLoading,
  } = useWorkCenter();

  const brandingQuery = useQuery({
    queryKey: ['work-center-branding', workCenterId, companyId],
    enabled: !!companyId && !wcLoading,
    queryFn: async (): Promise<WorkCenterBranding | null> => {
      if (!companyId) return null;

      if (workCenterId) {
        const { data, error } = await supabase
          .from('work_centers')
          .select('id, name, logo_url, logo_url_dark')
          .eq('id', workCenterId)
          .maybeSingle();
        if (error) {
          if (error.code === '42703') {
            const { data: fallback, error: fallbackErr } = await supabase
              .from('work_centers')
              .select('id, name, logo_url')
              .eq('id', workCenterId)
              .maybeSingle();
            if (fallbackErr) throw fallbackErr;
            return {
              displayName: (fallback?.name ?? workCenter?.name ?? hostCompany?.name ?? 'Centro').trim(),
              logoUrlLight: ((fallback as any)?.logo_url as string | null) ?? null,
              logoUrlDark: null,
              storage: 'work_centers',
              storageId: workCenterId,
            };
          }
          throw error;
        }
        return {
          displayName: (data?.name ?? workCenter?.name ?? 'Centro').trim(),
          logoUrlLight: ((data as any)?.logo_url as string | null) ?? null,
          logoUrlDark: ((data as any)?.logo_url_dark as string | null) ?? null,
          storage: 'work_centers',
          storageId: workCenterId,
        };
      }

      const { data, error } = await supabase
        .from('companies')
        .select('id, name, logo_url, logo_url_dark')
        .eq('id', companyId)
        .single();
      if (error) {
        if (error.code === '42703') {
          const { data: fallback, error: fallbackErr } = await supabase
            .from('companies')
            .select('id, name, logo_url')
            .eq('id', companyId)
            .single();
          if (fallbackErr) throw fallbackErr;
          return {
            displayName: (fallback.name ?? 'Empresa').trim(),
            logoUrlLight: (fallback.logo_url as string | null) ?? null,
            logoUrlDark: null,
            storage: 'companies',
            storageId: companyId,
          };
        }
        throw error;
      }
      return {
        displayName: (data.name ?? 'Empresa').trim(),
        logoUrlLight: ((data as any).logo_url as string | null) ?? null,
        logoUrlDark: ((data as any).logo_url_dark as string | null) ?? null,
        storage: 'companies',
        storageId: companyId,
      };
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['work-center-branding'] });
    queryClient.invalidateQueries({ queryKey: ['work-center', workCenterId] });
    queryClient.invalidateQueries({ queryKey: ['company', companyId, 'topbar-brand'] });
  };

  const updateLogo = useMutation({
    mutationFn: async (payload: { file: File; variant?: 'light' | 'dark' }) => {
      const branding = brandingQuery.data;
      if (!branding) throw new Error('Sin datos de centro');
      const { file, variant = 'light' } = payload;
      const dataUrl = await readFileAsDataUrl(file);
      const column = variant === 'dark' ? 'logo_url_dark' : 'logo_url';
      const { error } = await supabase
        .from(branding.storage)
        .update({ [column]: dataUrl })
        .eq('id', branding.storageId);
      if (isMissingColumnError(error, 'logo_url_dark') && variant === 'dark') {
        throw new Error('Falta actualizar la base de datos para el logo nocturno. Aplica la migración y vuelve a intentarlo.');
      }
      if (error) throw error;
      return dataUrl;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Logo guardado', description: 'Se muestra en la barra superior y en los PDFs.' });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'No se pudo guardar el logo. ¿Tienes permisos de administrador?',
        variant: 'destructive',
      });
    },
  });

  const removeLogo = useMutation({
    mutationFn: async (variant: 'light' | 'dark' = 'light') => {
      const branding = brandingQuery.data;
      if (!branding) throw new Error('Sin datos de centro');
      const column = variant === 'dark' ? 'logo_url_dark' : 'logo_url';
      const { error } = await supabase
        .from(branding.storage)
        .update({ [column]: null })
        .eq('id', branding.storageId);
      if (isMissingColumnError(error, 'logo_url_dark') && variant === 'dark') {
        throw new Error('Falta actualizar la base de datos para el logo nocturno. Aplica la migración y vuelve a intentarlo.');
      }
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Logo eliminado' });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'No se pudo eliminar el logo',
        variant: 'destructive',
      });
    },
  });

  return {
    branding: brandingQuery.data ?? null,
    displayName: brandingQuery.data?.displayName ?? 'Lipoout',
    logoUrl: brandingQuery.data?.logoUrlLight ?? null,
    logoUrlLight: brandingQuery.data?.logoUrlLight ?? null,
    logoUrlDark: brandingQuery.data?.logoUrlDark ?? null,
    isLoading: wcLoading || brandingQuery.isLoading,
    updateLogo,
    removeLogo,
    hasWorkCenter: !!workCenterId,
  };
}
