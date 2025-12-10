
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Color {
  id: string;
  name: string;
  created_at: string;
}

export const useColors = () => {
  const queryClient = useQueryClient();

  const { data: colors = [], isLoading: loading, error } = useQuery({
    queryKey: ['colors'],
    queryFn: async () => {
      console.log('Fetching colors');

      const { data, error } = await supabase
        .from('colors')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching colors:', error);
        throw error;
      }

      console.log('Fetched colors:', data?.length || 0);
      return data as Color[] || [];
    },
  });

  const addColorMutation = useMutation({
    mutationFn: async (colorName: string) => {
      console.log('Adding color:', colorName);

      const { data, error } = await supabase
        .from('colors')
        .insert({ name: colorName.trim() })
        .select()
        .single();

      if (error) {
        console.error('Error adding color:', error);
        throw error;
      }

      console.log('Color added successfully:', data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['colors'] });
      toast.success('Color agregado exitosamente');
    },
    onError: (error) => {
      console.error('Error adding color:', error);
      toast.error('Error al agregar el color');
    },
  });

  return {
    colors,
    loading,
    error,
    addColor: addColorMutation.mutateAsync,
    isAdding: addColorMutation.isPending,
  };
};
