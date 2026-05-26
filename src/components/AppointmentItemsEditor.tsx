import React, { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { GripVertical, Plus, Trash2, Clock, CreditCard } from 'lucide-react';
import type { AppointmentItemDraft, AppointmentItemKind, BonusPaymentMode } from '@/types/agenda';
import {
  buildAppointmentTimeSegments,
  calcEndFromStart,
  defaultOccupiesTime,
  effectiveDurationMinutes,
  partitionAppointmentItems,
} from '@/lib/agendaAppointmentItems';
import { appointmentItemLineTotal, appointmentItemsTotal } from '@/lib/agendaAppointmentPricing';
import { AppointmentItemTimeline } from '@/components/AppointmentItemTimeline';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

function newClientKey(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function reorderItems(items: AppointmentItemDraft[], from: number, to: number): AppointmentItemDraft[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = [...items];
  const [removed] = next.splice(from, 1);
  next.splice(to, 0, removed);
  return next;
}

export interface AppointmentItemsEditorProps {
  startTime: string;
  items: AppointmentItemDraft[];
  onChange: (items: AppointmentItemDraft[]) => void;
  customerId?: string | null;
  compactHeader?: boolean;
}

export const AppointmentItemsEditor: React.FC<AppointmentItemsEditorProps> = ({
  startTime,
  items,
  onChange,
  customerId = null,
  compactHeader = false,
}) => {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const { companyId } = useCompanyFilter();

  const { data: articles = [] } = useQuery({
    queryKey: ['appointment-item-articles', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('id,codigo,descripcion,precio,duration_minutes,article_kind,estado')
        .eq('company_id', companyId)
        .eq('estado', 'activo')
        .order('descripcion');
      if (error) throw error;
      return (data || []) as Array<{
        id: string;
        codigo: string | null;
        descripcion: string;
        precio: number | null;
        duration_minutes: number | null;
        article_kind: string | null;
      }>;
    },
  });

  const { data: activeVouchers = [] } = useQuery({
    queryKey: ['appointment-customer-vouchers', companyId, customerId],
    enabled: !!companyId && !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_vouchers')
        .select('id,article_id,total_sessions,used_sessions,is_active,bonus_definition_id,coverage_items,articles(descripcion,precio,duration_minutes)')
        .eq('company_id', companyId)
        .eq('customer_id', customerId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || [])
        .filter((v: any) => Number(v.total_sessions || 0) > Number(v.used_sessions || 0))
        .map((v: any) => ({
          id: String(v.id),
          article_id: v.article_id ? String(v.article_id) : null,
          remaining: Math.max(0, Number(v.total_sessions || 0) - Number(v.used_sessions || 0)),
          article_name: v.articles?.descripcion || 'Bono',
          article_price: Math.max(0, Number(v.articles?.precio || 0)),
          article_duration: Math.max(0, Number(v.articles?.duration_minutes || 0)),
          bonus_definition_id: v.bonus_definition_id ? String(v.bonus_definition_id) : null,
          coverage_items: Array.isArray(v.coverage_items) ? v.coverage_items : [],
        }));
    },
  });

  const { data: bonusDefinitions = [] } = useQuery({
    queryKey: ['appointment-bonus-definitions', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bonus_definitions')
        .select(`
          id,name,
          bonus_definition_items(coverage_type,article_id,family_code,covered_quantity,articles:article_id(codigo,descripcion))
        `)
        .eq('company_id', companyId)
        .order('name', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pendingDebt = 0 } = useQuery({
    queryKey: ['appointment-customer-debt', companyId, customerId],
    enabled: !!companyId && !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select('total_amount,paid_status,status')
        .eq('company_id', companyId)
        .eq('customer_id', customerId)
        .eq('status', 'issued')
        .or('paid_status.is.null,paid_status.eq.false');
      if (error) throw error;
      return (data || []).reduce((sum: number, r: any) => sum + Math.max(0, Number(r.total_amount || 0)), 0);
    },
  });

  const articleById = useMemo(() => {
    const m = new Map<string, (typeof articles)[number]>();
    for (const a of articles) m.set(a.id, a);
    return m;
  }, [articles]);

  const definitionById = useMemo(() => {
    const m = new Map<string, any>();
    for (const d of bonusDefinitions) m.set(String((d as any).id), d);
    return m;
  }, [bonusDefinitions]);

  const voucherCoveragePreview = useCallback((voucher: any) => {
    const rawCoverage = Array.isArray(voucher?.coverage_items) ? voucher.coverage_items : [];
    if (rawCoverage.length > 0) {
      return rawCoverage.map((it: any) => ({
        label: String(it?.label || (it?.family_code ? `Familia ${it.family_code}` : 'Cobertura')),
        qty: Number(it?.covered_quantity ?? 1),
      }));
    }
    const def = voucher?.bonus_definition_id ? definitionById.get(String(voucher.bonus_definition_id)) : null;
    const rows = Array.isArray(def?.bonus_definition_items) ? def.bonus_definition_items : [];
    return rows.map((it: any) => ({
      label: it?.articles
        ? `${it.articles.codigo ? `${it.articles.codigo} - ` : ''}${it.articles.descripcion}`
        : (it?.family_code ? `Familia ${it.family_code}` : 'Cobertura'),
      qty: Number(it?.covered_quantity ?? 1),
    }));
  }, [definitionById]);

  const normalizeKind = (value: string | null | undefined): string => {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  };

  const articleMatchesItemKind = useCallback(
    (itemKind: AppointmentItemKind, article: { article_kind: string | null }) => {
      const k = normalizeKind(article.article_kind);
      if (itemKind === 'service') return k.includes('service') || k.includes('servicio');
      if (itemKind === 'product') {
        return (
          k.includes('product') ||
          k.includes('producto') ||
          k.includes('standard') ||
          k.includes('textil') ||
          k.includes('calzado')
        );
      }
      if (itemKind === 'bonus') return k.includes('bonus') || k.includes('bono');
      return true;
    },
    []
  );

  const endPreview = calcEndFromStart(startTime, effectiveDurationMinutes(items));
  const timeSegments = useMemo(
    () => buildAppointmentTimeSegments(startTime, items),
    [startTime, items]
  );
  const timelineEnd = timeSegments.length
    ? timeSegments[timeSegments.length - 1]!.endTime
    : endPreview;
  const { timeItems, paymentItems } = useMemo(() => partitionAppointmentItems(items), [items]);

  const updateAt = useCallback(
    (index: number, patch: Partial<AppointmentItemDraft>) => {
      onChange(items.map((it, i) => (i === index ? { ...it, ...patch } : it)));
    },
    [items, onChange]
  );

  const handleKindChange = useCallback(
    (index: number, nextKind: AppointmentItemKind) => {
      const current = items[index];
      const usingVoucher = !!current?.customer_voucher_id;
      if (nextKind === 'bonus' && !usingVoucher) {
        updateAt(index, {
          kind: nextKind,
          occupies_time: false,
          duration_minutes: 0,
          bonus_payment_mode: current?.bonus_payment_mode ?? 'none',
        });
        return;
      }
      if (nextKind === 'product') {
        updateAt(index, {
          kind: nextKind,
          occupies_time: false,
          duration_minutes: 0,
        });
        return;
      }
      if (nextKind === 'service') {
        updateAt(index, {
          kind: nextKind,
          occupies_time: true,
          duration_minutes: Math.max(0, Number(current?.duration_minutes || 0)) || 30,
        });
        return;
      }
      updateAt(index, {
        kind: nextKind,
        occupies_time: defaultOccupiesTime(nextKind, { usingVoucher }),
      });
    },
    [items, updateAt]
  );

  const addTimeItem = () => {
    onChange([
      ...items,
      {
        clientKey: newClientKey(),
        kind: 'service',
        label: '',
        duration_minutes: 30,
        occupies_time: true,
        quantity: 1,
        unit_price: 0,
        bonus_payment_mode: 'none',
      },
    ]);
  };

  const addPaymentItem = () => {
    onChange([
      ...items,
      {
        clientKey: newClientKey(),
        kind: 'product',
        label: '',
        duration_minutes: 0,
        occupies_time: false,
        quantity: 1,
        unit_price: 0,
        bonus_payment_mode: 'none',
      },
    ]);
  };

  const removeAt = (index: number) => {
    if (items.length <= 1) return;
    onChange(items.filter((_, i) => i !== index));
  };

  const totalPreview = appointmentItemsTotal(items);

  const applyArticleAt = useCallback(
    (index: number, articleId: string) => {
      const a = articleById.get(articleId);
      if (!a) return;
      const nextKind: AppointmentItemKind =
        a.article_kind === 'service' ? 'service' : a.article_kind === 'product' ? 'product' : 'other';
      const nextLabel = `${a.codigo ? `${a.codigo} - ` : ''}${a.descripcion}`.trim();
      const isBonusKind = nextKind === 'bonus';
      const isProductKind = nextKind === 'product';
      updateAt(index, {
        article_id: a.id,
        label: nextLabel,
        kind: nextKind,
        unit_price: Math.max(0, Number(a.precio || 0)),
        occupies_time: isBonusKind || isProductKind ? false : true,
        duration_minutes: isBonusKind || isProductKind
          ? 0
          : (Math.max(0, Number(a.duration_minutes || 0)) || items[index]?.duration_minutes || 30),
      });
    },
    [articleById, items, updateAt]
  );

  const useVoucherAt = useCallback(
    (index: number, voucher: { id: string; article_id: string | null; article_name: string; article_price: number; article_duration: number }) => {
      updateAt(index, {
        kind: 'bonus',
        customer_voucher_id: voucher.id,
        article_id: voucher.article_id,
        label: `BONO 00 - ${voucher.article_name}`,
        quantity: 1,
        unit_price: voucher.article_price,
        bonus_payment_mode: 'none',
        occupies_time: true,
        duration_minutes: voucher.article_duration || items[index]?.duration_minutes || 30,
      });
    },
    [items, updateAt]
  );

  return (
    <div className="space-y-2 rounded-md border bg-muted/30 p-2">
      {!compactHeader && (
        <>
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs font-medium">Ítems de la cita</Label>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground tabular-nums">Fin: {endPreview}</span>
              <span className="text-[10px] font-medium tabular-nums">Total: {totalPreview.toFixed(2)} EUR</span>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground leading-tight">
            Ordena los ítems: los que reservan tiempo se encadenan en la agenda; productos y compra de bono solo suman al cobro.
          </p>
        </>
      )}
      <AppointmentItemTimeline
        startTime={startTime}
        endTime={timelineEnd}
        segments={timeSegments}
        compact={compactHeader}
      />
      {!!customerId && (
        <div className="rounded border bg-background/80 p-2 space-y-1">
          <div className="text-[11px] text-muted-foreground">
            Deuda pendiente cliente: <span className="font-semibold text-foreground">{pendingDebt.toFixed(2)} EUR</span>
          </div>
          {activeVouchers.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {activeVouchers.map((v) => (
                <span key={v.id} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  {v.article_name} · {v.remaining} sesión(es)
                </span>
              ))}
            </div>
          )}
          {activeVouchers.length > 0 && (
            <div className="space-y-1 pt-1">
              {activeVouchers.slice(0, 3).map((v) => {
                const lines = voucherCoveragePreview(v).slice(0, 4);
                if (!lines.length) return null;
                return (
                  <div key={`cov-${v.id}`} className="text-[10px] text-muted-foreground">
                    <span className="font-medium text-foreground">{v.article_name}:</span>{' '}
                    {lines.map((ln) => `${ln.qty} x ${ln.label}`).join(' · ')}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      <div className="space-y-2 max-h-[340px] overflow-y-auto pr-0.5">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground sticky top-0 bg-muted/30 py-0.5 z-[1]">
            <Clock className="w-3.5 h-3.5 text-sky-600" />
            Reservan tiempo ({timeItems.length})
          </div>
          {items.map((item, index) => {
            if (!item.occupies_time || Number(item.duration_minutes || 0) <= 0) return null;
            const filteredArticles = articles.filter((a) => articleMatchesItemKind(item.kind, a));
            const seg = timeSegments.find((s) => s.clientKey === item.clientKey);
            return (
          <div
            key={item.clientKey}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
              e.preventDefault();
              const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
              if (Number.isNaN(from)) return;
              onChange(reorderItems(items, from, index));
              setDragIndex(null);
            }}
            className={`flex flex-wrap items-center gap-1 rounded border border-sky-200/80 bg-background p-1.5 text-xs ${
              dragIndex === index ? 'opacity-70 ring-1 ring-primary/40' : ''
            }`}
          >
            {seg && (
              <span className="text-[10px] tabular-nums text-sky-700 font-medium shrink-0">
                {seg.startTime}–{seg.endTime}
              </span>
            )}
            <button
              type="button"
              draggable
              onDragStart={(e) => {
                setDragIndex(index);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(index));
              }}
              onDragEnd={() => setDragIndex(null)}
              className="cursor-grab touch-none text-muted-foreground hover:text-foreground p-0.5"
              aria-label="Arrastrar para reordenar"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>
            <Select
              value={item.kind}
              onValueChange={(v) => handleKindChange(index, v as AppointmentItemKind)}
            >
              <SelectTrigger className="h-7 w-[88px] text-[11px] px-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="service">Servicio</SelectItem>
                <SelectItem value="product">Producto</SelectItem>
                <SelectItem value="bonus">Bono</SelectItem>
                <SelectItem value="other">Otro</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="h-7 min-w-[100px] flex-1 text-xs px-1.5"
              placeholder="Nombre (busca y selecciona artículo)"
              value={item.label}
              list={`appointment-item-articles-${index}`}
              onChange={(e) => {
                const val = e.target.value;
                updateAt(index, { label: val });
                const exact = filteredArticles.find(
                  (a) => `${a.codigo ? `${a.codigo} - ` : ''}${a.descripcion}`.trim().toLowerCase() === val.trim().toLowerCase()
                );
                if (exact) applyArticleAt(index, exact.id);
              }}
            />
            <Select
              value={item.article_id ?? 'none'}
              onValueChange={(v) => {
                if (v === 'none') {
                  updateAt(index, { article_id: null });
                  return;
                }
                applyArticleAt(index, v);
              }}
            >
              <SelectTrigger className="h-7 w-[120px] text-[11px] px-1.5">
                <SelectValue placeholder="Artículo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin artículo</SelectItem>
                {filteredArticles.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {`${a.codigo ? `${a.codigo} - ` : ''}${a.descripcion}`.trim()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <datalist id={`appointment-item-articles-${index}`}>
              {filteredArticles.map((a) => (
                <option key={a.id} value={`${a.codigo ? `${a.codigo} - ` : ''}${a.descripcion}`.trim()} />
              ))}
            </datalist>
            {!!customerId && activeVouchers.some((v) => v.article_id && v.article_id === item.article_id && v.remaining > 0) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[10px] px-2"
                onClick={() => {
                  const voucher = activeVouchers.find((v) => v.article_id && v.article_id === item.article_id && v.remaining > 0);
                  if (voucher) useVoucherAt(index, voucher);
                }}
              >
                Usar bono
              </Button>
            )}
            {item.customer_voucher_id && (
              <div className="basis-full text-[10px] text-muted-foreground -mt-0.5">
                {(() => {
                  const voucher = activeVouchers.find((v) => v.id === item.customer_voucher_id);
                  if (!voucher) return 'Bono aplicado.';
                  const lines = voucherCoveragePreview(voucher).slice(0, 3);
                  if (!lines.length) return `Bono aplicado: ${voucher.article_name}`;
                  return `Bono aplicado: ${lines.map((ln) => `${ln.qty} x ${ln.label}`).join(' · ')}`;
                })()}
              </div>
            )}
            <div className="flex items-center gap-0.5">
              <Input
                type="number"
                min={0}
                step={5}
                className="h-7 w-12 text-xs px-1"
                value={item.duration_minutes}
                onChange={(e) => updateAt(index, { duration_minutes: parseInt(e.target.value, 10) || 0 })}
              />
              <span className="text-[10px] text-muted-foreground">min</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] text-muted-foreground whitespace-nowrap">Tiempo</span>
              <Switch
                checked={item.occupies_time}
                onCheckedChange={(checked) =>
                  updateAt(index, {
                    occupies_time: checked,
                    duration_minutes: checked
                      ? Math.max(0, Number(item.duration_minutes || 0)) || 30
                      : 0,
                  })
                }
                className="scale-75 origin-center"
              />
            </div>
            {item.kind === 'bonus' ? (
              <div className="flex items-center gap-1">
                <Select
                  value={item.bonus_payment_mode ?? 'none'}
                  onValueChange={(v) => updateAt(index, { bonus_payment_mode: v as BonusPaymentMode })}
                >
                  <SelectTrigger className="h-7 w-[78px] text-[11px] px-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin cobro</SelectItem>
                    <SelectItem value="full">100%</SelectItem>
                    <SelectItem value="60">60%</SelectItem>
                    <SelectItem value="40">40%</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  className="h-7 w-16 text-xs px-1"
                  value={item.unit_price ?? 0}
                  onChange={(e) => updateAt(index, { unit_price: parseFloat(e.target.value) || 0 })}
                />
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  className="h-7 w-14 text-xs px-1"
                  value={item.quantity ?? 1}
                  onChange={(e) => updateAt(index, { quantity: parseFloat(e.target.value) || 0 })}
                />
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  className="h-7 w-16 text-xs px-1"
                  value={item.unit_price ?? 0}
                  onChange={(e) => updateAt(index, { unit_price: parseFloat(e.target.value) || 0 })}
                />
              </div>
            )}
            <span className="text-[10px] tabular-nums min-w-[55px] text-right">
              {appointmentItemLineTotal(item).toFixed(2)} EUR
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 shrink-0"
              disabled={items.length <= 1}
              onClick={() => removeAt(index)}
              aria-label="Quitar ítem"
            >
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </Button>
          </div>
            );
          })}
          {!timeItems.length && (
            <p className="text-[10px] text-muted-foreground px-1">Ningún ítem reserva tiempo en el slot.</p>
          )}
          <Button type="button" variant="outline" size="sm" className="h-7 w-full text-xs gap-1" onClick={addTimeItem}>
            <Plus className="w-3 h-3" /> Añadir servicio / sesión
          </Button>
        </div>

        <div className="space-y-1 pt-1 border-t border-border/60">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground sticky top-0 bg-muted/30 py-0.5 z-[1]">
            <CreditCard className="w-3.5 h-3.5 text-amber-600" />
            Solo cobro ({paymentItems.length})
          </div>
          {items.map((item, index) => {
            if (item.occupies_time && Number(item.duration_minutes || 0) > 0) return null;
            const filteredArticles = articles.filter((a) => articleMatchesItemKind(item.kind, a));
            return (
          <div
            key={item.clientKey}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(e) => {
              e.preventDefault();
              const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
              if (Number.isNaN(from)) return;
              onChange(reorderItems(items, from, index));
              setDragIndex(null);
            }}
            className={`flex flex-wrap items-center gap-1 rounded border border-amber-200/60 bg-background/90 p-1.5 text-xs ${
              dragIndex === index ? 'opacity-70 ring-1 ring-primary/40' : ''
            }`}
          >
            <button
              type="button"
              draggable
              onDragStart={(e) => {
                setDragIndex(index);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', String(index));
              }}
              onDragEnd={() => setDragIndex(null)}
              className="cursor-grab touch-none text-muted-foreground hover:text-foreground p-0.5"
              aria-label="Arrastrar para reordenar"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>
            <Select
              value={item.kind}
              onValueChange={(v) => handleKindChange(index, v as AppointmentItemKind)}
            >
              <SelectTrigger className="h-7 w-[88px] text-[11px] px-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="service">Servicio</SelectItem>
                <SelectItem value="product">Producto</SelectItem>
                <SelectItem value="bonus">Bono</SelectItem>
                <SelectItem value="other">Otro</SelectItem>
              </SelectContent>
            </Select>
            <Input
              className="h-7 min-w-[100px] flex-1 text-xs px-1.5"
              placeholder="Nombre"
              value={item.label}
              list={`appointment-item-pay-${index}`}
              onChange={(e) => {
                const val = e.target.value;
                updateAt(index, { label: val });
                const exact = filteredArticles.find(
                  (a) => `${a.codigo ? `${a.codigo} - ` : ''}${a.descripcion}`.trim().toLowerCase() === val.trim().toLowerCase()
                );
                if (exact) applyArticleAt(index, exact.id);
              }}
            />
            <Select
              value={item.article_id ?? 'none'}
              onValueChange={(v) => {
                if (v === 'none') {
                  updateAt(index, { article_id: null });
                  return;
                }
                applyArticleAt(index, v);
              }}
            >
              <SelectTrigger className="h-7 w-[120px] text-[11px] px-1.5">
                <SelectValue placeholder="Artículo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin artículo</SelectItem>
                {filteredArticles.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {`${a.codigo ? `${a.codigo} - ` : ''}${a.descripcion}`.trim()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <datalist id={`appointment-item-pay-${index}`}>
              {filteredArticles.map((a) => (
                <option key={a.id} value={`${a.codigo ? `${a.codigo} - ` : ''}${a.descripcion}`.trim()} />
              ))}
            </datalist>
            {item.kind === 'bonus' ? (
              <div className="flex items-center gap-1">
                <Select
                  value={item.bonus_payment_mode ?? 'none'}
                  onValueChange={(v) => updateAt(index, { bonus_payment_mode: v as BonusPaymentMode })}
                >
                  <SelectTrigger className="h-7 w-[78px] text-[11px] px-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin cobro</SelectItem>
                    <SelectItem value="full">100%</SelectItem>
                    <SelectItem value="60">60%</SelectItem>
                    <SelectItem value="40">40%</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  className="h-7 w-16 text-xs px-1"
                  value={item.unit_price ?? 0}
                  onChange={(e) => updateAt(index, { unit_price: parseFloat(e.target.value) || 0 })}
                />
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  className="h-7 w-14 text-xs px-1"
                  value={item.quantity ?? 1}
                  onChange={(e) => updateAt(index, { quantity: parseFloat(e.target.value) || 0 })}
                />
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  className="h-7 w-16 text-xs px-1"
                  value={item.unit_price ?? 0}
                  onChange={(e) => updateAt(index, { unit_price: parseFloat(e.target.value) || 0 })}
                />
              </div>
            )}
            <span className="text-[10px] tabular-nums min-w-[55px] text-right">
              {appointmentItemLineTotal(item).toFixed(2)} EUR
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 shrink-0"
              disabled={items.length <= 1}
              onClick={() => removeAt(index)}
              aria-label="Quitar ítem"
            >
              <Trash2 className="w-3.5 h-3.5 text-destructive" />
            </Button>
          </div>
            );
          })}
          {!paymentItems.length && (
            <p className="text-[10px] text-muted-foreground px-1">Productos, bonos vendidos u otros cobros sin bloqueo horario.</p>
          )}
          <Button type="button" variant="outline" size="sm" className="h-7 w-full text-xs gap-1" onClick={addPaymentItem}>
            <Plus className="w-3 h-3" /> Añadir producto / bono / cobro
          </Button>
        </div>
      </div>
    </div>
  );
}
