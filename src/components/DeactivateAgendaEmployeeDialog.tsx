import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

export type DeactivateAgendaEmployeeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string | null;
  employeeName: string;
  companyId: string | null;
  /** Empleados activos distintos del que se desactiva (destino de reasignación). */
  reassignmentTargets: { id: string; name: string; label?: string }[];
  /** Otros campos a persistir en `agenda_employees` junto con `active: false`. */
  employeeRowPatch?: Record<string, unknown>;
  onSuccess?: () => void;
};

export const DeactivateAgendaEmployeeDialog: React.FC<DeactivateAgendaEmployeeDialogProps> = ({
  open,
  onOpenChange,
  employeeId,
  employeeName,
  companyId,
  reassignmentTargets,
  employeeRowPatch,
  onSuccess,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [targetId, setTargetId] = useState<string>('');

  useEffect(() => {
    if (open) setTargetId('');
  }, [open, employeeId]);

  const { data: futureIds = [], isLoading: loadingIds } = useQuery({
    queryKey: ['agenda-future-appointment-ids', companyId, employeeId],
    queryFn: async () => {
      if (!companyId || !employeeId) return [];
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from('agenda_appointments')
        .select('id')
        .eq('company_id', companyId)
        .eq('employee_id', employeeId)
        .gte('start_time', nowIso)
        .neq('status', 'cancelled');
      if (error) throw error;
      return (data || []).map((r) => r.id as string);
    },
    enabled: open && !!companyId && !!employeeId,
  });

  const deactivateMutation = useMutation({
    mutationFn: async (opts: { reassignTo: string | null }) => {
      if (!companyId || !employeeId) throw new Error('Datos incompletos');

      if (futureIds.length > 0 && opts.reassignTo) {
        const { error: u1 } = await supabase
          .from('agenda_appointments')
          .update({ employee_id: opts.reassignTo })
          .in('id', futureIds)
          .eq('company_id', companyId);
        if (u1) throw u1;
      }

      let patch: Record<string, unknown> = { is_active: false as const, ...employeeRowPatch };
      let { error: u2 } = await supabase
        .from('agenda_employees')
        .update(patch as never)
        .eq('id', employeeId)
        .eq('company_id', companyId);
      if (u2?.code === '42703') {
        patch = { active: false as const, ...employeeRowPatch };
        ({ error: u2 } = await supabase
          .from('agenda_employees')
          .update(patch as never)
          .eq('id', employeeId)
          .eq('company_id', companyId));
      }
      if (u2) throw u2;

      return {
        reassigned: Boolean(opts.reassignTo && futureIds.length > 0),
        n: futureIds.length,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['agenda-employees'] });
      queryClient.invalidateQueries({ queryKey: ['agenda-appointments'] });
      const n = result.n;
      if (result.reassigned) {
        toast({
          title: 'Empleado desactivado',
          description: `Se reasignaron ${n} cita(s) futura(s) y se ocultó el empleado en la agenda.`,
        });
      } else if (n > 0) {
        toast({
          title: 'Empleado desactivado',
          description:
            'Las citas futuras siguen asignadas a este empleado: no verás su columna hasta reactivarlo o cambiar empleado en cada cita.',
        });
      } else {
        toast({ title: 'Empleado desactivado', description: 'El empleado ya no aparece en la agenda.' });
      }
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (e: Error) => {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    },
  });

  const nFuture = futureIds.length;
  const busy = deactivateMutation.isPending;
  const canReassign = reassignmentTargets.length > 0 && nFuture > 0;
  const reassignReady = Boolean(targetId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Desactivar {employeeName}</DialogTitle>
          <DialogDescription className="space-y-2 text-left">
            <span className="block">
              Un empleado inactivo no tiene columna en la vista de agenda. Las citas pasadas no se modifican.
            </span>
            {loadingIds ? (
              <span className="block">Comprobando citas futuras…</span>
            ) : nFuture > 0 ? (
              <span className="block">
                Hay <strong className="text-foreground">{nFuture}</strong> cita(s) futura(s) no canceladas. Puedes
                pasarlas todas a otro empleado (misma fecha y hora) y luego afinar horarios arrastrando citas en la
                agenda, o desactivar sin moverlas (quedarán ocultas en la cuadrícula hasta que las edites).
              </span>
            ) : (
              <span className="block">No hay citas futuras pendientes para este empleado.</span>
            )}
          </DialogDescription>
        </DialogHeader>

        {nFuture > 0 && canReassign && (
          <div className="space-y-2 py-1">
            <Label>Reasignar citas futuras a</Label>
            <Select value={targetId || undefined} onValueChange={setTargetId}>
              <SelectTrigger>
                <SelectValue placeholder="Elige empleado" />
              </SelectTrigger>
              <SelectContent>
                {reassignmentTargets.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.label ?? t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {nFuture > 0 && !canReassign && !loadingIds && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            No hay otros empleados activos: crea uno antes de reasignar, o desactiva sin mover las citas (sigue
            pudiendo editarlas desde la ficha del cliente si aplica).
          </p>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          {nFuture > 0 && canReassign && (
            <Button
              type="button"
              disabled={busy || !reassignReady || loadingIds}
              onClick={() => deactivateMutation.mutate({ reassignTo: targetId })}
            >
              Reasignar citas y desactivar
            </Button>
          )}
          <Button
            type="button"
            variant={nFuture > 0 ? 'outline' : 'default'}
            disabled={busy || loadingIds}
            onClick={() => deactivateMutation.mutate({ reassignTo: null })}
          >
            {nFuture > 0 ? 'Desactivar sin reasignar citas' : 'Desactivar'}
          </Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
