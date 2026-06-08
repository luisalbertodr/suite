import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  createDunasoftAppointmentDual,
  deleteDunasoftAppointmentDual,
  updateDunasoftAppointmentDual,
} from '@/lib/dunasoftDualWriteApi';
import type {
  DunasoftCreateAppointmentPayload,
  DunasoftUpdateAppointmentPayload,
} from '@/lib/dunasoftDualWrite';

export function useDunasoftAppointmentMutations(dateYmd: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['dunasoft-agenda-day', dateYmd] });
    void queryClient.invalidateQueries({ queryKey: ['agenda-appointments'] });
  };

  const createMutation = useMutation({
    mutationFn: (payload: DunasoftCreateAppointmentPayload) => createDunasoftAppointmentDual(payload),
    onSuccess: (res) => {
      invalidate();
      toast({
        title: 'Cita creada',
        description: `ID Style ${res.legacy_idplan}. Pendiente de sincronizar DBF si el agente está activo.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Error al crear', description: err.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ idplan, payload }: { idplan: string; payload: DunasoftUpdateAppointmentPayload }) =>
      updateDunasoftAppointmentDual(idplan, payload),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Cita actualizada', description: 'Cambios en Suite y Dunasoft PG; DBF en cola.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error al actualizar', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (idplan: string) => deleteDunasoftAppointmentDual(idplan),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Cita eliminada', description: 'Registrado BORRAR en planinc; DBF en cola.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error al eliminar', description: err.message, variant: 'destructive' });
    },
  });

  return { createMutation, updateMutation, deleteMutation };
}
