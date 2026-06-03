import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Plus, Gift, X, Play, Pencil, Trash2, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { bonoSessionsDisplay } from '@/lib/bonoSessionsDisplay';
import { useCustomerPurchasedProducts } from '@/hooks/useCustomerPurchasedProducts';
import { fetchBonoPurchaseAppointmentMap } from '@/lib/customerBonoAppointmentLinks';
import { AppointmentCitaLink } from '@/components/cliente/AppointmentCitaLink';
import type { PostgrestError } from '@supabase/supabase-js';

interface Props {
  customerId: string;
  onAppointmentClick?: (appointmentId: string, dateYmd: string) => void;
}

type CoverageItem = {
  coverage_type: 'service' | 'product' | 'family';
  article_id?: string | null;
  family_code?: string | null;
  covered_quantity: number;
  label: string;
  max_covered_if_unpaid?: number | null;
  commission_pvp?: number | null;
  used_quantity?: number | null;
};

type BonusStorage = 'bonos' | 'customer_vouchers';

type BonusRow = {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio_total: number;
  sesiones_totales: number;
  sesiones_usadas: number;
  estado: string;
  fecha_compra: string | null;
  fecha_vencimiento: string | null;
  legacy_codboncli: string | null;
  bonus_definition_id: string | null;
  coverage_items: CoverageItem[];
  payment_mode: 'full' | 'split_60_40';
  paid_amount: number;
  second_payment_due_at_used_sessions: number | null;
  second_payment_paid: boolean;
  storage: BonusStorage;
};

const isMissingRelation = (error: PostgrestError | null) =>
  Boolean(
    error &&
      (error.code === '42P01' ||
        (error.message || '').toLowerCase().includes('relation') ||
        (error.message || '').toLowerCase().includes('does not exist'))
  );

const parseCoverageItems = (raw: unknown): CoverageItem[] => {
  if (!Array.isArray(raw)) return [];
  return raw.map((it: any) => ({
    coverage_type: (it?.coverage_type ?? 'service') as CoverageItem['coverage_type'],
    article_id: it?.article_id ?? null,
    family_code: it?.family_code ?? null,
    covered_quantity: Number(it?.covered_quantity ?? 1),
    max_covered_if_unpaid: it?.max_covered_if_unpaid ?? null,
    commission_pvp: it?.commission_pvp ?? null,
    used_quantity: it?.used_quantity ?? null,
    label: String(it?.label ?? 'Cobertura'),
  }));
};

const mapDefinitionItem = (it: any): CoverageItem => ({
  coverage_type: (it?.coverage_type ?? 'service') as CoverageItem['coverage_type'],
  article_id: it?.article_id ?? null,
  family_code: it?.family_code ?? null,
  covered_quantity: Number(it?.covered_quantity ?? 1),
  max_covered_if_unpaid: it?.max_covered_if_unpaid ?? null,
  commission_pvp: it?.commission_pvp ?? null,
  label: it?.articles
    ? `${it.articles.codigo ? `${it.articles.codigo} - ` : ''}${it.articles.descripcion}`
    : (it?.family_code ? `Familia ${it.family_code}` : 'Cobertura'),
});

const resolveBonoCoverage = (
  rowCoverage: CoverageItem[],
  definitionItems: CoverageItem[] | undefined,
): CoverageItem[] => {
  if (rowCoverage.length) return rowCoverage;
  return definitionItems ?? [];
};

const parseVoucherNotes = (notes: string | null | undefined) => {
  if (!notes) return {};
  try {
    return JSON.parse(notes);
  } catch {
    return { descripcion: notes };
  }
};

const fmtShortDate = (value: string | null | undefined) => {
  if (!value) return null;
  try {
    return format(new Date(value), 'dd/MM/yy');
  } catch {
    return null;
  }
};

const toDateInputValue = (value: string | null | undefined) =>
  value ? String(value).slice(0, 10) : '';

const isBonoExpired = (b: BonusRow) => {
  if (!b.fecha_vencimiento) return false;
  const vence = new Date(String(b.fecha_vencimiento).slice(0, 10) + 'T23:59:59');
  return !Number.isNaN(vence.getTime()) && vence < new Date();
};

const isBonoUsable = (b: BonusRow) => {
  if (String(b.estado).toLowerCase() === 'completado') return false;
  if (
    bonoSessionsDisplay({
      sesiones_totales: b.sesiones_totales,
      sesiones_usadas: b.sesiones_usadas,
      coverage_items: b.coverage_items,
    }).remaining <= 0
  ) {
    return false;
  }
  if (isBonoExpired(b)) return false;
  return true;
};

const bonoInactiveLabel = (b: BonusRow) => {
  if (isBonoExpired(b)) return 'Vencido';
  if (
    String(b.estado).toLowerCase() === 'completado' ||
    bonoSessionsDisplay({
      sesiones_totales: b.sesiones_totales,
      sesiones_usadas: b.sesiones_usadas,
      coverage_items: b.coverage_items,
    }).remaining <= 0
  ) {
    return 'Agotado';
  }
  return 'No utilizable';
};

type BonoFormState = {
  nombre: string;
  descripcion: string;
  precio_total: number;
  sesiones_totales: number;
  fecha_vencimiento: string;
  bonus_definition_id: string;
  coverage_items: CoverageItem[];
  payment_mode: 'full' | 'split_60_40';
};

const emptyForm = (): BonoFormState => ({
  nombre: '',
  descripcion: '',
  precio_total: 0,
  sesiones_totales: 1,
  fecha_vencimiento: '',
  bonus_definition_id: '',
  coverage_items: [],
  payment_mode: 'full',
});

const applyDefinitionToForm = (selected: any): Partial<BonoFormState> => {
  const mappedItems: CoverageItem[] = (selected.bonus_definition_items ?? [])
    .filter((it: any) => it?.notes !== 'legacy-bonus-article')
    .map((it: any) => ({
      coverage_type: it.coverage_type,
      article_id: it.article_id ?? null,
      family_code: it.family_code ?? null,
      covered_quantity: Number(it.covered_quantity ?? 1),
      label: it?.articles
        ? `${it.articles.codigo ? `${it.articles.codigo} - ` : ''}${it.articles.descripcion}`
        : (it.family_code ? `Familia ${it.family_code}` : 'Cobertura'),
    }));
  return {
    bonus_definition_id: String(selected.id),
    nombre: selected.name ?? '',
    descripcion: selected.description ?? '',
    precio_total: Number(selected.default_price ?? 0),
    sesiones_totales: Number(selected.default_total_sessions ?? 1),
    coverage_items: mappedItems,
  };
};

const bonoToForm = (bono: BonusRow): BonoFormState => ({
  nombre: bono.nombre ?? '',
  descripcion: bono.descripcion ?? '',
  precio_total: Number(bono.precio_total ?? 0),
  sesiones_totales: Number(bono.sesiones_totales ?? 1),
  fecha_vencimiento: toDateInputValue(bono.fecha_vencimiento),
  bonus_definition_id: bono.bonus_definition_id ?? 'none',
  payment_mode: bono.payment_mode ?? 'full',
  coverage_items: bono.coverage_items.map((it) => ({ ...it })),
});

export const ClienteBonosTab: React.FC<Props> = ({ customerId, onAppointmentClick }) => {
  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { companyId } = useCompanyFilter();

  const [form, setForm] = useState<BonoFormState>(emptyForm());

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
  };

  const openEdit = (bono: BonusRow) => {
    setShowNewForm(false);
    setEditingId(bono.id);
    setForm(bonoToForm(bono));
  };

  const cancelEditing = () => {
    resetForm();
  };

  const openNew = () => {
    resetForm();
    setShowNewForm((prev) => !prev);
  };

  const { data: bonusData, isLoading } = useQuery({
    queryKey: ['bonos', customerId, companyId],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data: bonosRows, error: bonosError } = await supabase
        .from('bonos')
        .select('*')
        .eq('customer_id', customerId)
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false });

      if (!bonosError) {
        const rows: BonusRow[] = (bonosRows ?? []).map((row: any) => ({
          id: row.id,
          nombre: row.nombre ?? 'Bono',
          descripcion: row.descripcion ?? null,
          precio_total: Number(row.precio_total ?? 0),
          sesiones_totales: Number(row.sesiones_totales ?? 1),
          sesiones_usadas: Number(row.sesiones_usadas ?? 0),
          estado: row.estado ?? 'activo',
          fecha_compra: row.fecha_compra ?? null,
          fecha_vencimiento: row.fecha_vencimiento ?? null,
          legacy_codboncli: row.legacy_codboncli ?? null,
          bonus_definition_id: row.bonus_definition_id ?? null,
          coverage_items: parseCoverageItems(row.coverage_items),
          payment_mode: row.payment_mode === 'split_60_40' ? 'split_60_40' : 'full',
          paid_amount: Number(row.paid_amount ?? 0),
          second_payment_due_at_used_sessions: row.second_payment_due_at_used_sessions ?? null,
          second_payment_paid: Boolean(row.second_payment_paid ?? true),
          storage: 'bonos' as BonusStorage,
        }));
        return { storage: 'bonos' as BonusStorage, rows };
      }

      if (!isMissingRelation(bonosError)) throw bonosError;

      const { data: voucherRows, error: vouchersError } = await supabase
        .from('customer_vouchers')
        .select('*')
        .eq('customer_id', customerId)
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false });
      if (vouchersError) throw vouchersError;

      const rows: BonusRow[] = (voucherRows ?? []).map((row: any) => {
        const notesPayload = parseVoucherNotes(row.notes);
        const total = Number((notesPayload as any)?.precio_total ?? 0);
        return {
          id: row.id,
          nombre: row.voucher_code ?? (row.article_id ? 'Bono' : 'Vale'),
          descripcion: ((notesPayload as any)?.descripcion as string) ?? null,
          precio_total: Number.isFinite(total) ? total : 0,
          sesiones_totales: Number(row.total_sessions ?? 1),
          sesiones_usadas: Number(row.used_sessions ?? 0),
          estado: row.is_active === false || Number(row.used_sessions ?? 0) >= Number(row.total_sessions ?? 1) ? 'completado' : 'activo',
          fecha_compra: row.created_at ?? null,
          fecha_vencimiento: row.expiry_date ?? null,
          legacy_codboncli: null,
          bonus_definition_id: row.bonus_definition_id ?? null,
          coverage_items: parseCoverageItems(row.coverage_items ?? (notesPayload as any)?.coverage_items),
          payment_mode: row.payment_mode === 'split_60_40' ? 'split_60_40' : ((notesPayload as any)?.payment_mode === 'split_60_40' ? 'split_60_40' : 'full'),
          paid_amount: Number(row.paid_amount ?? (notesPayload as any)?.paid_amount ?? 0),
          second_payment_due_at_used_sessions: row.second_payment_due_at_used_sessions ?? (notesPayload as any)?.second_payment_due_at_used_sessions ?? null,
          second_payment_paid: Boolean(row.second_payment_paid ?? (notesPayload as any)?.second_payment_paid ?? true),
          storage: 'customer_vouchers',
        };
      });

      return { storage: 'customer_vouchers' as BonusStorage, rows };
    },
  });

  const { data: definitions } = useQuery({
    queryKey: ['bonus-definitions', companyId],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bonus_definitions')
        .select(`
          id, code, name, description, default_price, default_total_sessions,
          bonus_definition_items(coverage_type, article_id, family_code, covered_quantity, notes, articles:article_id(descripcion, codigo))
        `)
        .eq('company_id', companyId!)
        .order('name', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const definitionById = React.useMemo(() => {
    const m = new Map<string, any>();
    for (const d of definitions ?? []) m.set(String((d as any).id), d);
    return m;
  }, [definitions]);

  const bonosRaw = bonusData?.rows ?? [];
  const storage = bonusData?.storage ?? 'bonos';

  const bonos = React.useMemo(() => {
    return bonosRaw.map((b) => {
      if (b.coverage_items.length > 0 || !b.bonus_definition_id) return b;
      const def = definitionById.get(String(b.bonus_definition_id));
      const defItems = (def?.bonus_definition_items ?? [])
        .filter((it: any) => it?.notes !== 'legacy-bonus-article')
        .map(mapDefinitionItem);
      const coverage = resolveBonoCoverage(b.coverage_items, defItems);
      return coverage.length ? { ...b, coverage_items: coverage } : b;
    });
  }, [bonosRaw, definitionById]);

  const { data: bonoAppointmentById = new Map() } = useQuery({
    queryKey: ['customer-bono-appointment-links', customerId, companyId, bonos.map((b) => b.id).join(',')],
    enabled: Boolean(companyId && bonos.length),
    queryFn: () =>
      fetchBonoPurchaseAppointmentMap(
        customerId,
        companyId!,
        bonos.map((b) => ({ id: b.id, nombre: b.nombre, fecha_compra: b.fecha_compra })),
      ),
  });

  const { bonosVigentes, bonosHistorico } = React.useMemo(() => {
    const vigentes: BonusRow[] = [];
    const historico: BonusRow[] = [];
    for (const b of bonos) {
      if (isBonoUsable(b)) vigentes.push(b);
      else historico.push(b);
    }
    return { bonosVigentes: vigentes, bonosHistorico: historico };
  }, [bonos]);

  const { data: coverageArticles = [] } = useQuery({
    queryKey: ['bonus-coverage-articles', companyId],
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('id,codigo,descripcion,article_kind,familia,estado')
        .eq('company_id', companyId!)
        .eq('estado', 'activo')
        .order('descripcion', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const familiasDisponibles = React.useMemo(() => {
    return [...new Set((coverageArticles || []).map((a: any) => String(a.familia || '').trim()).filter(Boolean))];
  }, [coverageArticles]);

  const formatArticleLabel = (a: any) => `${a?.codigo ? `${a.codigo} - ` : ''}${a?.descripcion || 'Artículo'}`.trim();

  const articleById = React.useMemo(() => {
    const m = new Map<string, any>();
    for (const a of coverageArticles) m.set(String((a as any).id), a);
    return m;
  }, [coverageArticles]);

  const filteredCoverageArticles = React.useCallback((type: CoverageItem['coverage_type']) => {
    const toKind = (v: unknown) => String(v || '').toLowerCase();
    if (type === 'service') {
      return coverageArticles.filter((a: any) => toKind(a.article_kind).includes('serv'));
    }
    if (type === 'product') {
      return coverageArticles.filter((a: any) => {
        const k = toKind(a.article_kind);
        return k.includes('prod') || k.includes('standard') || k.includes('textil') || k.includes('calzado');
      });
    }
    return coverageArticles;
  }, [coverageArticles]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const coverageItems = form.coverage_items.map((item) => ({
        coverage_type: item.coverage_type,
        article_id: item.article_id ?? null,
        family_code: item.family_code ?? null,
        covered_quantity: Number(item.covered_quantity || 0),
        label: item.label,
      }));

      const common = {
        customer_id: customerId,
        company_id: companyId!,
        bonus_definition_id: form.bonus_definition_id === 'none' ? null : form.bonus_definition_id,
      };
      const secondPaymentDueAtUsedSessions = form.payment_mode === 'split_60_40'
        ? Math.max(1, Math.ceil(Number(form.sesiones_totales || 1) / 2))
        : null;
      const paidAmount = form.payment_mode === 'split_60_40'
        ? Number((Number(form.precio_total || 0) * 0.6).toFixed(2))
        : Number(form.precio_total || 0);
      const secondPaymentPaid = form.payment_mode === 'split_60_40' ? false : true;

      let error: PostgrestError | null = null;
      if (storage === 'bonos') {
        const payload = {
          ...common,
          nombre: form.nombre,
          descripcion: form.descripcion || null,
          precio_total: form.precio_total,
          sesiones_totales: form.sesiones_totales,
          fecha_vencimiento: form.fecha_vencimiento || null,
          coverage_items: coverageItems,
          payment_mode: form.payment_mode,
          paid_amount: paidAmount,
          second_payment_due_at_used_sessions: secondPaymentDueAtUsedSessions,
          second_payment_paid: secondPaymentPaid,
        };
        const query = editingId
          ? supabase.from('bonos').update(payload).eq('id', editingId)
          : supabase.from('bonos').insert(payload);
        const res = await query;
        error = res.error;
      } else {
        const notes = JSON.stringify({
          descripcion: form.descripcion || null,
          precio_total: form.precio_total,
          coverage_items: coverageItems,
          payment_mode: form.payment_mode,
          paid_amount: paidAmount,
          second_payment_due_at_used_sessions: secondPaymentDueAtUsedSessions,
          second_payment_paid: secondPaymentPaid,
        });
        const payload = {
          ...common,
          total_sessions: form.sesiones_totales,
          expiry_date: form.fecha_vencimiento || null,
          voucher_code: form.nombre,
          notes,
          coverage_items: coverageItems,
          payment_mode: form.payment_mode,
          paid_amount: paidAmount,
          second_payment_due_at_used_sessions: secondPaymentDueAtUsedSessions,
          second_payment_paid: secondPaymentPaid,
        };
        const query = editingId
          ? supabase.from('customer_vouchers').update(payload).eq('id', editingId)
          : supabase.from('customer_vouchers').insert(payload);
        const res = await query;
        error = res.error;
      }
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bonos', customerId] });
      queryClient.invalidateQueries({ queryKey: ['active-vouchers', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer_day_timeline', customerId] });
      setShowNewForm(false);
      resetForm();
      toast({ title: editingId ? 'Bono actualizado' : 'Bono asignado al cliente' });
    },
    onError: () => toast({ title: 'Error', variant: 'destructive' }),
  });

  const usarSesionMutation = useMutation({
    mutationFn: async (bonoId: string) => {
      const bono = bonos?.find(b => b.id === bonoId);
      if (!bono || bono.sesiones_usadas >= bono.sesiones_totales) throw new Error('Sin sesiones disponibles');

      let updateError: PostgrestError | null = null;
      if (bono.storage === 'bonos') {
        const { error: usoError } = await supabase.from('bono_uso').insert({ bono_id: bonoId });
        if (usoError && !isMissingRelation(usoError)) throw usoError;
        const res = await supabase.from('bonos').update({
          sesiones_usadas: bono.sesiones_usadas + 1,
          estado: bono.sesiones_usadas + 1 >= bono.sesiones_totales ? 'completado' : 'activo',
        }).eq('id', bonoId);
        updateError = res.error;
      } else {
        const nextUsed = bono.sesiones_usadas + 1;
        const res = await supabase.from('customer_vouchers').update({
          used_sessions: nextUsed,
          is_active: nextUsed < bono.sesiones_totales,
        }).eq('id', bonoId);
        updateError = res.error;
      }
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bonos', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer_day_timeline', customerId] });
      toast({ title: 'Sesión registrada' });
    },
    onError: (e) => toast({ title: (e as Error).message, variant: 'destructive' }),
  });

  const cobrarPendienteMutation = useMutation({
    mutationFn: async (bonoId: string) => {
      const bono = bonos?.find((b) => b.id === bonoId);
      if (!bono) throw new Error('Bono no encontrado');
      if (bono.payment_mode !== 'split_60_40') throw new Error('Este bono no es 60/40');
      if (bono.second_payment_paid) throw new Error('El 40% ya está cobrado');
      const amount = Number((bono.precio_total - bono.paid_amount).toFixed(2));
      if (amount <= 0) throw new Error('No hay importe pendiente');

      let error: PostgrestError | null = null;
      if (bono.storage === 'bonos') {
        const res = await supabase
          .from('bonos')
          .update({ paid_amount: bono.precio_total, second_payment_paid: true })
          .eq('id', bonoId);
        error = res.error;
      } else {
        const notes = JSON.stringify({
          descripcion: bono.descripcion || null,
          precio_total: bono.precio_total,
          coverage_items: bono.coverage_items,
          payment_mode: bono.payment_mode,
          paid_amount: bono.precio_total,
          second_payment_due_at_used_sessions: bono.second_payment_due_at_used_sessions,
          second_payment_paid: true,
        });
        const res = await supabase
          .from('customer_vouchers')
          .update({ paid_amount: bono.precio_total, second_payment_paid: true, notes })
          .eq('id', bonoId);
        error = res.error;
      }
      if (error) throw error;
      return amount;
    },
    onSuccess: (amount) => {
      queryClient.invalidateQueries({ queryKey: ['bonos', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer_day_timeline', customerId] });
      toast({ title: 'Cobro registrado', description: `${amount.toFixed(2)} €` });
    },
    onError: (e) => toast({ title: (e as Error).message, variant: 'destructive' }),
  });

  const renderBonoForm = (opts: {
    onCancel: () => void;
    submitLabel: string;
    embedded?: boolean;
    mode?: 'assign' | 'edit';
  }) => {
    const isAssign = opts.mode === 'assign';
    const hasDefinition = Boolean(form.bonus_definition_id && form.bonus_definition_id !== 'none');

    return (
    <div className={cn('space-y-4', opts.embedded && 'pt-3 border-t')}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={isAssign ? 'md:col-span-2' : undefined}>
          <Label>{isAssign ? 'Tipo de bono *' : 'Tipo de bono (plantilla)'}</Label>
          <Select
            value={hasDefinition ? form.bonus_definition_id : undefined}
            onValueChange={(v) => {
              const selected = definitions?.find((d: any) => d.id === v);
              if (!selected) {
                if (!isAssign) {
                  setForm((prev) => ({ ...prev, bonus_definition_id: 'none' }));
                }
                return;
              }
              setForm((prev) => ({ ...prev, ...applyDefinitionToForm(selected) }));
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={isAssign ? 'Selecciona un tipo de bono' : 'Sin plantilla'} />
            </SelectTrigger>
            <SelectContent>
              {!isAssign && <SelectItem value="none">Sin plantilla</SelectItem>}
              {(definitions ?? []).map((d: any) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}{d.code ? ` (${d.code})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAssign && !(definitions ?? []).length && (
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
              No hay tipos de bono definidos. Créalos en Artículos → Bonos → Nuevo artículo (categoría Bono).
            </p>
          )}
        </div>
      </div>
      {isAssign && hasDefinition && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-sm">
          <p className="font-medium">{form.nombre}</p>
          {form.descripcion && <p className="text-muted-foreground text-xs">{form.descripcion}</p>}
          <p className="text-xs text-muted-foreground">
            {form.precio_total.toFixed(2)} € · {form.sesiones_totales} sesiones
            {form.coverage_items.length > 0 && ` · ${coverageSummary(form.coverage_items)}`}
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        {!isAssign && (
          <div>
            <Label>Nombre *</Label>
            <Input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Bono 10 sesiones" />
          </div>
        )}
        <div>
          <Label>Precio Total (€)</Label>
          <Input
            type="number"
            value={form.precio_total}
            onChange={(e) => setForm({ ...form, precio_total: Number(e.target.value) })}
            readOnly={isAssign}
            className={isAssign ? 'bg-muted' : undefined}
          />
        </div>
        <div>
          <Label>Sesiones Totales</Label>
          <Input
            type="number"
            min="1"
            value={form.sesiones_totales}
            onChange={(e) => setForm({ ...form, sesiones_totales: Number(e.target.value) })}
            readOnly={isAssign}
            className={isAssign ? 'bg-muted' : undefined}
          />
        </div>
        <div>
          <Label>Fecha Vencimiento</Label>
          <Input type="date" value={form.fecha_vencimiento} onChange={(e) => setForm({ ...form, fecha_vencimiento: e.target.value })} />
        </div>
        <div>
          <Label>Modalidad de pago</Label>
          <Select
            value={form.payment_mode}
            onValueChange={(v: 'full' | 'split_60_40') => setForm((prev) => ({ ...prev, payment_mode: v }))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full">100% al alta</SelectItem>
              <SelectItem value="split_60_40">60% al alta + 40% a mitad</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {!isAssign && (
          <div>
            <Label>Descripción</Label>
            <Input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Opcional" />
          </div>
        )}
      </div>
      {form.payment_mode === 'split_60_40' && (
        <p className="text-xs text-muted-foreground">
          Se cobrará ahora el 60% ({(Number(form.precio_total || 0) * 0.6).toFixed(2)} €) y el 40% ({(Number(form.precio_total || 0) * 0.4).toFixed(2)} €) al llegar a mitad de sesiones.
        </p>
      )}
      {!isAssign && (
      <div className="space-y-2">
        <Label>Cobertura del bono</Label>
        {!form.coverage_items.length ? (
          <p className="text-xs text-muted-foreground">Sin líneas de cobertura. Añade servicios/productos/familias para definir el bono.</p>
        ) : (
          <div className="space-y-2">
            {form.coverage_items.map((item, idx) => (
              <div key={`${item.label}-${idx}`} className="grid grid-cols-1 md:grid-cols-[112px_1fr_160px_92px_40px] gap-2 items-center">
                <Select
                  value={item.coverage_type}
                  onValueChange={(v: CoverageItem['coverage_type']) => {
                    const next = [...form.coverage_items];
                    next[idx] = {
                      ...item,
                      coverage_type: v,
                      article_id: null,
                      family_code: null,
                      label: v === 'family' ? 'Familia' : 'Cobertura',
                    };
                    setForm((prev) => ({ ...prev, coverage_items: next }));
                  }}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="service">Servicio</SelectItem>
                    <SelectItem value="product">Producto</SelectItem>
                    <SelectItem value="family">Familia</SelectItem>
                  </SelectContent>
                </Select>
                {item.coverage_type === 'family' ? (
                  <Select
                    value={item.family_code ?? 'none'}
                    onValueChange={(v) => {
                      const next = [...form.coverage_items];
                      next[idx] = {
                        ...item,
                        family_code: v === 'none' ? null : v,
                        article_id: null,
                        label: v === 'none' ? 'Familia' : `Familia ${v}`,
                      };
                      setForm((prev) => ({ ...prev, coverage_items: next }));
                    }}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Familia" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Selecciona familia</SelectItem>
                      {familiasDisponibles.map((f) => (
                        <SelectItem key={f} value={f}>{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select
                    value={item.article_id ?? 'none'}
                    onValueChange={(v) => {
                      const picked = v === 'none' ? null : articleById.get(String(v));
                      const next = [...form.coverage_items];
                      next[idx] = {
                        ...item,
                        article_id: v === 'none' ? null : String(v),
                        family_code: null,
                        label: picked ? formatArticleLabel(picked) : 'Cobertura',
                      };
                      setForm((prev) => ({ ...prev, coverage_items: next }));
                    }}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Servicio/Producto" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Selecciona artículo</SelectItem>
                      {filteredCoverageArticles(item.coverage_type).map((a: any) => (
                        <SelectItem key={a.id} value={String(a.id)}>
                          {formatArticleLabel(a)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Input
                  value={item.label}
                  className="h-8"
                  onChange={(e) => {
                    const next = [...form.coverage_items];
                    next[idx] = { ...item, label: e.target.value };
                    setForm((prev) => ({ ...prev, coverage_items: next }));
                  }}
                />
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  className="h-8"
                  value={item.covered_quantity}
                  onChange={(e) => {
                    const next = [...form.coverage_items];
                    next[idx] = { ...item, covered_quantity: Number(e.target.value) };
                    setForm((prev) => ({ ...prev, coverage_items: next }));
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    const next = form.coverage_items.filter((_, i) => i !== idx);
                    setForm((prev) => ({ ...prev, coverage_items: next }));
                  }}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() =>
            setForm((prev) => ({
              ...prev,
              coverage_items: [
                ...prev.coverage_items,
                {
                  coverage_type: 'service',
                  article_id: null,
                  family_code: null,
                  covered_quantity: 1,
                  label: 'Cobertura',
                },
              ],
            }))
          }
        >
          <Plus className="w-3.5 h-3.5 mr-1" /> Añadir componente
        </Button>
      </div>
      )}
      <div className="flex gap-2">
        <Button
          onClick={() => {
            if (isAssign && !hasDefinition) {
              toast({ title: 'Selecciona un tipo de bono', variant: 'destructive' });
              return;
            }
            saveMutation.mutate();
          }}
          disabled={
            saveMutation.isPending ||
            (isAssign ? !hasDefinition : !form.nombre)
          }
        >
          {opts.submitLabel}
        </Button>
        <Button variant="outline" onClick={opts.onCancel} disabled={saveMutation.isPending}>
          Cancelar
        </Button>
      </div>
    </div>
    );
  };

  const renderBonoCard = (bono: BonusRow, section: 'vigente' | 'historico') => {
    const { remaining, total } = bonoSessionsDisplay({
      sesiones_totales: bono.sesiones_totales,
      sesiones_usadas: bono.sesiones_usadas,
      coverage_items: bono.coverage_items,
    });
    const usable = isBonoUsable(bono);
    const isEditing = editingId === bono.id;
    const vence = fmtShortDate(bono.fecha_vencimiento);
    const pending40 =
      bono.payment_mode === 'split_60_40' &&
      !bono.second_payment_paid &&
      (bono.second_payment_due_at_used_sessions ?? 0) <= bono.sesiones_usadas;
    const sessionsTitle = `${remaining} sesión${remaining === 1 ? '' : 'es'} disponible${remaining === 1 ? '' : 's'} de ${total}`;

    if (isEditing) {
      return (
        <Card key={bono.id} className="overflow-hidden ring-1 ring-primary/40">
          <CardContent className="p-2.5 sm:p-3">
            <div className="flex items-center gap-2 text-sm leading-tight mb-2">
              <Gift className="w-3.5 h-3.5 shrink-0 text-primary" />
              <span className="font-medium truncate">Editando: {bono.nombre}</span>
            </div>
            {renderBonoForm({
              onCancel: cancelEditing,
              submitLabel: 'Guardar cambios',
              embedded: true,
              mode: 'edit',
            })}
          </CardContent>
        </Card>
      );
    }

    const isVigente = section === 'vigente';
    const cita = bonoAppointmentById.get(bono.id);

    return (
      <div
        key={bono.id}
        className={cn(
          'flex items-center gap-1.5 sm:gap-2 min-h-9 px-2 sm:px-2.5 py-1.5 rounded-md border text-xs sm:text-sm leading-tight min-w-0',
          isVigente
            ? 'border-emerald-300/70 bg-emerald-50/80 dark:bg-emerald-950/35 dark:border-emerald-700/50 shadow-sm'
            : 'border-border/30 bg-muted/15 text-muted-foreground opacity-55',
        )}
        title={sessionsTitle}
      >
        <Gift
          className={cn(
            'w-3.5 h-3.5 shrink-0',
            isVigente ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
          )}
        />
        <span className={cn('font-medium truncate min-w-0 flex-1', isVigente && 'text-foreground')}>
          {bono.nombre}
        </span>
        {bono.legacy_codboncli && (
          <span className="hidden md:inline shrink-0 font-mono text-[10px] opacity-80">
            {bono.legacy_codboncli}
          </span>
        )}
        <span
          className={cn(
            'shrink-0 tabular-nums font-semibold whitespace-nowrap',
            isVigente ? 'text-emerald-700 dark:text-emerald-300' : 'text-muted-foreground',
          )}
        >
          {remaining}/{total} ses.
        </span>
        {vence && (
          <span className="hidden sm:inline shrink-0 text-[10px] whitespace-nowrap opacity-80">
            {isVigente ? `→ ${vence}` : vence}
          </span>
        )}
        {cita ? (
          <AppointmentCitaLink
            appointmentId={cita.appointmentId}
            dateYmd={cita.dateYmd}
            onOpen={onAppointmentClick}
          />
        ) : null}
        {!isVigente && (
          <span className="shrink-0 text-[10px] uppercase tracking-wide font-medium">
            {bonoInactiveLabel(bono)}
          </span>
        )}
        {isVigente && pending40 && (
          <Button
            size="sm"
            variant="secondary"
            className="h-6 px-1.5 text-[10px] shrink-0"
            onClick={() => cobrarPendienteMutation.mutate(bono.id)}
            disabled={cobrarPendienteMutation.isPending}
          >
            40%
          </Button>
        )}
        <div className="flex items-center shrink-0 ml-0.5">
          <Button
            size="icon"
            variant="ghost"
            className={cn('h-7 w-7', !isVigente && 'h-6 w-6 opacity-70')}
            onClick={() => openEdit(bono)}
            disabled={Boolean(editingId && editingId !== bono.id)}
            title="Editar"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {usable && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => usarSesionMutation.mutate(bono.id)}
              disabled={usarSesionMutation.isPending}
              title="Usar sesión"
            >
              <Play className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  const { data: purchasedProducts = [], isLoading: productsLoading } = useCustomerPurchasedProducts(customerId);

  const renderProductRow = (p: (typeof purchasedProducts)[number]) => {
    const dateYmd = p.appointmentDateYmd ?? p.purchasedAt.slice(0, 10);
    return (
      <div
        key={p.id}
        className="flex items-center gap-1.5 sm:gap-2 min-h-9 px-2 sm:px-2.5 py-1.5 rounded-md border border-border/40 bg-background/60 text-xs sm:text-sm leading-tight min-w-0"
      >
        <Package className="w-3.5 h-3.5 shrink-0 text-sky-600 dark:text-sky-400" />
        <span className="font-medium truncate min-w-0 flex-1">{p.label}</span>
        {p.codigo && (
          <span className="hidden md:inline shrink-0 font-mono text-[10px] text-muted-foreground">
            {p.codigo}
          </span>
        )}
        <span className="shrink-0 tabular-nums text-muted-foreground whitespace-nowrap">
          ×{p.quantity}
        </span>
        <span className="shrink-0 tabular-nums font-semibold whitespace-nowrap">
          {p.totalPrice.toFixed(2)} €
        </span>
        {p.appointmentId ? (
          <AppointmentCitaLink
            appointmentId={p.appointmentId}
            dateYmd={dateYmd}
            onOpen={onAppointmentClick}
          />
        ) : p.ticketNumber ? (
          <span className="hidden sm:inline shrink-0 text-[10px] text-muted-foreground whitespace-nowrap">
            {p.ticketNumber}
          </span>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-base font-semibold">Bonos</h3>
        <Button size="sm" onClick={openNew} disabled={Boolean(editingId)}>
          {showNewForm ? <X className="w-4 h-4 mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
          {showNewForm ? 'Cancelar' : 'Asignar Bono'}
        </Button>
      </div>

      {showNewForm && (
        <Card>
          <CardContent className="pt-4 pb-4">
            {renderBonoForm({
              onCancel: () => { setShowNewForm(false); resetForm(); },
              submitLabel: 'Asignar Bono',
              mode: 'assign',
            })}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Cargando...</div>
      ) : !bonos?.length ? (
        <div className="text-center py-8 text-muted-foreground">No hay bonos</div>
      ) : (
        <div className="space-y-3">
          {bonosVigentes.length > 0 && (
            <section className="space-y-1">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 px-0.5">
                Vigentes ({bonosVigentes.length})
              </h4>
              <div className="space-y-1">
                {bonosVigentes.map((b) => renderBonoCard(b, 'vigente'))}
              </div>
            </section>
          )}
          {bonosHistorico.length > 0 && (
            <section className="space-y-1">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80 px-0.5">
                Histórico ({bonosHistorico.length})
              </h4>
              <div className="space-y-0.5">
                {bonosHistorico.map((b) => renderBonoCard(b, 'historico'))}
              </div>
            </section>
          )}
          {bonosVigentes.length === 0 && bonosHistorico.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">No hay bonos</div>
          )}
        </div>
      )}

      <section className="space-y-2 pt-1 border-t border-border/50">
        <h3 className="text-base font-semibold">Productos comprados</h3>
        {productsLoading ? (
          <div className="text-center py-4 text-sm text-muted-foreground">Cargando productos...</div>
        ) : !purchasedProducts.length ? (
          <div className="text-center py-4 text-sm text-muted-foreground">Sin productos registrados</div>
        ) : (
          <div className="space-y-0.5">{purchasedProducts.map(renderProductRow)}</div>
        )}
      </section>
    </div>
  );
};
