import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { useWorkCenter } from '@/hooks/useWorkCenter';

export type WorkCenterBranding = {
  displayName: string;
  logoUrl: string | null;
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
          .select('id, name, logo_url')
          .eq('id', workCenterId)
          .maybeSingle();
        if (error) {
          if (error.code === '42703') {
            return {
              displayName: workCenter?.name ?? hostCompany?.name ?? 'Centro',
              logoUrl: null,
              storage: 'work_centers',
              storageId: workCenterId,
            };
          }
          throw error;
        }
        return {
          displayName: (data?.name ?? workCenter?.name ?? 'Centro').trim(),
          logoUrl: (data?.logo_url as string | null) ?? null,
          storage: 'work_centers',
          storageId: workCenterId,
        };
      }

      const { data, error } = await supabase
        .from('companies')
        .select('id, name, logo_url')
        .eq('id', companyId)
        .single();
      if (error) throw error;
      return {
        displayName: (data.name ?? 'Empresa').trim(),
        logoUrl: data.logo_url ?? null,
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
    mutationFn: async (file: File) => {
      const branding = brandingQuery.data;
      if (!branding) throw new Error('Sin datos de centro');
      const dataUrl = await readFileAsDataUrl(file);
      const { error } = await supabase
        .from(branding.storage)
        .update({ logo_url: dataUrl })
        .eq('id', branding.storageId);
      if (error) throw error;
      return dataUrl;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Logo guardado', description: 'Se muestra en la barra superior y en los PDFs.' });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'No se pudo guardar el logo. ¿Tienes permisos de administrador?',
        variant: 'destructive',
      });
    },
  });

  const removeLogo = useMutation({
    mutationFn: async () => {
      const branding = brandingQuery.data;
      if (!branding) throw new Error('Sin datos de centro');
      const { error } = await supabase
        .from(branding.storage)
        .update({ logo_url: null })
        .eq('id', branding.storageId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Logo eliminado' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo eliminar el logo', variant: 'destructive' });
    },
  });

  return {
    branding: brandingQuery.data ?? null,
    displayName: brandingQuery.data?.displayName ?? 'Lipoout',
    logoUrl: brandingQuery.data?.logoUrl ?? null,
    isLoading: wcLoading || brandingQuery.isLoading,
    updateLogo,
    removeLogo,
    hasWorkCenter: !!workCenterId,
  };
}
