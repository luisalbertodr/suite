import React, { useMemo } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import {
  suiteTopBannerSurfaceClassName,
  useSuiteTopBanner,
} from '@/contexts/SuiteTopBannerContext';

type ConflictField = {
  field: string;
  style?: string;
  suite?: string;
};

const FIELD_LABELS: Record<string, string> = {
  name: 'Nombre',
  email: 'Email',
  phone: 'Teléfono',
  tax_id: 'DNI/NIF',
  notes: 'Observaciones',
  address_street: 'Dirección',
};

interface Props {
  customerId: string;
  conflictAt: string | null | undefined;
  conflictFields: ConflictField[] | null | undefined;
}

export const StyleSyncConflictBanner: React.FC<Props> = ({
  customerId,
  conflictAt,
  conflictFields,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const resolveMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('style_sync_resolve_customer_conflict', {
        p_customer_id: customerId,
      });
      if (error) throw error;
      if (data && typeof data === 'object' && (data as { ok?: boolean }).ok === false) {
        throw new Error('No se pudo marcar como resuelto');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer_detail', customerId] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast({ title: 'Conflicto marcado como revisado' });
    },
    onError: () => {
      toast({ title: 'Error al resolver conflicto', variant: 'destructive' });
    },
  });

  const fields = Array.isArray(conflictFields) ? conflictFields : [];

  const content = useMemo(() => {
    if (!conflictAt) return null;
    return (
      <div className={suiteTopBannerSurfaceClassName()}>
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium text-sm">Conflicto de sincronización Style ↔ Suite</p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs shrink-0 border-amber-600/40"
                onClick={() => resolveMutation.mutate()}
                disabled={resolveMutation.isPending}
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                {resolveMutation.isPending ? 'Guardando…' : 'Marcar revisado'}
              </Button>
            </div>
            <p className="text-xs opacity-90">
              El mismo dato se editó en Style y Suite casi a la vez (ventana 5 min). El resto de
              campos ya se fusionó; revisa los indicados abajo y marca como revisado cuando esté resuelto.
            </p>
            {fields.length > 0 && (
              <ul className="text-xs space-y-1 list-disc pl-4">
                {fields.map((f) => (
                  <li key={f.field}>
                    <strong>{FIELD_LABELS[f.field] ?? f.field}:</strong>{' '}
                    Suite «{f.suite ?? '—'}» · Style «{f.style ?? '—'}»
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }, [conflictAt, fields, resolveMutation]);

  useSuiteTopBanner(`style-sync-conflict-${customerId}`, content);
  return null;
};
