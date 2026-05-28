import React, { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AppointmentSelectContent } from '@/components/AppointmentSelectContent';
import { GripVertical, Plus, Trash2, Clock, CreditCard, AlertTriangle } from 'lucide-react';
import type { Appointment, AppointmentItemDraft, AppointmentItemKind, BonusPaymentMode } from '@/types/agenda';
import {
  buildAppointmentTimeSegments,
  calcEndFromStart,
  defaultOccupiesTime,
  effectiveDurationMinutes,
  partitionAppointmentItems,
} from '@/lib/agendaAppointmentItems';
import {
  autoAssignItemRecurso,
  toRecursoCatalogEntries,
  type ArticleResourceHint,
  type RecursoCatalogEntry,
} from '@/lib/agendaRecursoMatch';
import { findItemResourceConflicts, segmentsToConflictProbes } from '@/lib/agendaResourceConflicts';
import { appointmentItemLineTotal, appointmentItemsTotal, formatAppointmentItemAmount, isBonoSessionItem } from '@/lib/agendaAppointmentPricing';
import { AppointmentItemTimeline } from '@/components/AppointmentItemTimeline';
import { useCompanyFilter } from '@/hooks/useCompanyFilter';
import { useCustomerActiveBonos, type CustomerActiveBono } from '@/hooks/useCustomerActiveBonos';
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
  recursosCatalog?: RecursoCatalogEntry[];
  cabinasCatalog?: Array<{ id: string; nombre: string; activa?: boolean }>;
  appointmentDate?: string;
  dayAppointments?: Appointment[];
  excludeAppointmentId?: string;
  compactHeader?: boolean;
}

export const AppointmentItemsEditor: React.FC<AppointmentItemsEditorProps> = ({
  startTime,
  items,
  onChange,
  customerId = null,
  recursosCatalog = [],
  cabinasCatalog = [],
  appointmentDate,
  dayAppointments = [],
  excludeAppointmentId,
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
        .select('id,codigo,descripcion,precio,duration_minutes,article_kind,estado,familia,recurso_id')
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
        familia?: string | null;
        recurso_id?: string | null;
      }>;
    },
  });

  const { data: activeBonos = [] } = useCustomerActiveBonos(customerId);

  const legacyVouchers = useMemo(
    () => activeBonos.filter((b) => b.storage === 'customer_vouchers'),
    [activeBonos],
  );

  const articleById = useMemo(() => {
    const m = new Map<string, (typeof articles)[number]>();
    for (const a of articles) m.set(a.id, a);
    return m;
  }, [articles]);

  const voucherCoveragePreview = useCallback((bono: CustomerActiveBono) => {
    return (bono.coverage_items ?? []).map((it) => ({
      label: it.label,
      qty: it.covered_quantity,
      remaining: it.remaining,
    }));
  }, []);

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

  const articleHints = useMemo(() => {
    const m = new Map<string, ArticleResourceHint>();
    for (const a of articles) {
      m.set(a.id, { familia: a.familia ?? null, recurso_id: a.recurso_id ?? null });
    }
    return m;
  }, [articles]);

  const segmentOptions = useMemo(
    () => ({
      recursos: recursosCatalog,
      cabinas: cabinasCatalog.map((c) => ({ id: c.id, nombre: c.nombre })),
      articleHints,
    }),
    [recursosCatalog, cabinasCatalog, articleHints]
  );

  const endPreview = calcEndFromStart(startTime, effectiveDurationMinutes(items));
  const timeSegments = useMemo(
    () => buildAppointmentTimeSegments(startTime, items, recursosCatalog, segmentOptions),
    [startTime, items, recursosCatalog, segmentOptions]
  );
  const itemConflicts = useMemo(() => {
    if (!appointmentDate) return new Map<string, string[]>();
    const probes = segmentsToConflictProbes(timeSegments);
    return findItemResourceConflicts(appointmentDate, probes, dayAppointments, excludeAppointmentId);
  }, [appointmentDate, dayAppointments, excludeAppointmentId, timeSegments]);
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
      const usingVoucher = !!current?.customer_voucher_id || !!current?.bono_id;
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
      const hint: ArticleResourceHint = { familia: a.familia ?? null, recurso_id: a.recurso_id ?? null };
      const draftBase = {
        ...items[index],
        label: nextLabel,
        article_id: a.id,
        kind: nextKind,
      } as AppointmentItemDraft;
      const autoRecurso =
        !isBonusKind && !isProductKind
          ? autoAssignItemRecurso(draftBase, recursosCatalog, hint)
          : null;
      updateAt(index, {
        article_id: a.id,
        label: nextLabel,
        kind: nextKind,
        unit_price: Math.max(0, Number(a.precio || 0)),
        occupies_time: isBonusKind || isProductKind ? false : true,
        duration_minutes: isBonusKind || isProductKind
          ? 0
          : (Math.max(0, Number(a.duration_minutes || 0)) || items[index]?.duration_minutes || 30),
        recurso_id: a.recurso_id ?? autoRecurso,
      });
    },
    [articleById, items, updateAt, recursosCatalog]
  );

  const useVoucherAt = useCallback(
    (index: number, voucher: CustomerActiveBono) => {
      updateAt(index, {
        kind: 'service',
        customer_voucher_id: voucher.id,
        bono_id: null,
        article_id: voucher.article_id ?? null,
        label: voucher.article_id
          ? (articleById.get(voucher.article_id)?.descripcion
            ? `${articleById.get(voucher.article_id)?.codigo ? `${articleById.get(voucher.article_id)?.codigo} - ` : ''}${articleById.get(voucher.article_id)?.descripcion}`
            : voucher.nombre)
          : voucher.nombre,
        quantity: 1,
        unit_price: 0,
        bonus_payment_mode: 'none',
        occupies_time: true,
        duration_minutes: voucher.article_duration || items[index]?.duration_minutes || 30,
      });
    },
    [articleById, items, updateAt]
  );

  const addBonoSession = useCallback(
    (bono: CustomerActiveBono, coverageIndex?: number) => {
      const line =
        typeof coverageIndex === 'number' ? bono.coverage_items[coverageIndex] : null;
      const articleId = line?.article_id ?? null;
      const article = articleId ? articleById.get(articleId) : null;
      const duration = Math.max(
        0,
        Number(article?.duration_minutes || 0) || (line ? 30 : 30),
      );
      const label =
        (line?.label?.trim())
        || (article
          ? `${article.codigo ? `${article.codigo} - ` : ''}${article.descripcion}`.trim()
          : '')
        || bono.nombre;

      const draftBase: AppointmentItemDraft = {
        clientKey: newClientKey(),
        kind: 'service',
        label: label || bono.nombre,
        article_id: articleId,
        duration_minutes: duration || 30,
        occupies_time: true,
        quantity: 1,
        unit_price: 0,
        bonus_payment_mode: 'none',
        bono_id: bono.storage === 'bonos' ? bono.id : null,
        bono_coverage_index: line?.index ?? coverageIndex ?? null,
        customer_voucher_id: bono.storage === 'customer_vouchers' ? bono.id : null,
      };

      const hint: ArticleResourceHint | null = article
        ? { familia: article.familia ?? null, recurso_id: article.recurso_id ?? null }
        : null;
      const autoRecurso = hint
        ? autoAssignItemRecurso(draftBase, recursosCatalog, hint)
        : null;

      onChange([
        ...items,
        {
          ...draftBase,
          recurso_id: article?.recurso_id ?? autoRecurso,
        },
      ]);
    },
    [articleById, items, onChange, recursosCatalog]
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
      {!!customerId && activeBonos.length > 0 && (
        <div className="rounded border bg-background/80 p-2 space-y-2">
          <p className="text-[11px] font-medium text-foreground">Bonos activos con sesiones</p>
          {activeBonos.map((bono) => {
            const lines = voucherCoveragePreview(bono);
            const usableLines = lines.filter((ln) => ln.remaining > 0);
            return (
              <div key={bono.id} className="rounded border border-emerald-200/70 bg-emerald-50/40 dark:bg-emerald-950/20 p-1.5 space-y-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                  <span className="font-medium text-foreground">{bono.nombre}</span>
                  <span className="text-emerald-700 dark:text-emerald-400 tabular-nums">
                    {bono.remaining} ses. pendientes
                  </span>
                  {bono.legacy_codboncli && (
                    <span className="font-mono text-[10px] text-muted-foreground">#{bono.legacy_codboncli}</span>
                  )}
                  {!usableLines.length && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] px-2 ml-auto"
                      onClick={() => addBonoSession(bono)}
                    >
                      Usar sesión
                    </Button>
                  )}
                </div>
                {bono.coverage_items.filter((ln) => ln.remaining > 0).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {bono.coverage_items
                      .filter((ln) => ln.remaining > 0)
                      .map((ln) => (
                        <Button
                          key={`${bono.id}-${ln.index}`}
                          type="button"
                          variant="secondary"
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          onClick={() => addBonoSession(bono, ln.index)}
                        >
                          {ln.label.length > 32 ? `${ln.label.slice(0, 30)}…` : ln.label}
                          {' '}({ln.remaining}/{ln.covered_quantity})
                        </Button>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      <div className="space-y-2">
        <div className="space-y-1 max-h-[220px] overflow-y-auto pr-0.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground sticky top-0 bg-muted/30 py-0.5 z-[1]">
            <Clock className="w-3.5 h-3.5 text-sky-600" />
            Reservan tiempo ({timeItems.length})
          </div>
          {items.map((item, index) => {
            if (!item.occupies_time || Number(item.duration_minutes || 0) <= 0) return null;
            const filteredArticles = articles.filter((a) => articleMatchesItemKind(item.kind, a));
            const seg = timeSegments.find((s) => s.clientKey === item.clientKey);
            const conflicts = itemConflicts.get(item.clientKey) ?? [];
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
            className={`rounded border border-sky-200/80 bg-background p-1 text-xs ${
              dragIndex === index ? 'opacity-70 ring-1 ring-primary/40' : ''
            }`}
          >
            <div className="flex items-center gap-0.5 h-7 flex-nowrap">
              {seg && (
                <span className="text-[10px] tabular-nums text-sky-700 font-medium shrink-0 w-[68px]">
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
                className="cursor-grab touch-none text-muted-foreground hover:text-foreground p-0.5 shrink-0"
                aria-label="Arrastrar para reordenar"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </button>
              <Select
                value={item.kind}
                onValueChange={(v) => handleKindChange(index, v as AppointmentItemKind)}
              >
                <SelectTrigger className="h-7 w-[72px] text-[11px] px-1 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <AppointmentSelectContent>
                  <SelectItem value="service">Servicio</SelectItem>
                  <SelectItem value="product">Producto</SelectItem>
                  <SelectItem value="bonus">Bono</SelectItem>
                  <SelectItem value="other">Otro</SelectItem>
                </AppointmentSelectContent>
              </Select>
              <Select
                value={item.article_id ?? 'none'}
                onValueChange={(v) => {
                  if (v === 'none') {
                    updateAt(index, { article_id: null, label: '' });
                    return;
                  }
                  applyArticleAt(index, v);
                }}
              >
                <SelectTrigger className="h-7 min-w-0 flex-1 text-[11px] px-1.5">
                  <SelectValue placeholder="Seleccionar artículo" />
                </SelectTrigger>
                <AppointmentSelectContent>
                  <SelectItem value="none">Sin artículo</SelectItem>
                  {filteredArticles.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {`${a.codigo ? `${a.codigo} - ` : ''}${a.descripcion}`.trim()}
                    </SelectItem>
                  ))}
                </AppointmentSelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-0.5 h-7 mt-0.5 flex-nowrap overflow-x-auto">
                <Input
                  type="number"
                  min={0}
                  step={5}
                  className="h-7 w-10 text-xs px-1 shrink-0"
                  value={item.duration_minutes}
                  onChange={(e) => updateAt(index, { duration_minutes: parseInt(e.target.value, 10) || 0 })}
                />
                <span className="text-[10px] text-muted-foreground shrink-0">m</span>
              {isBonoSessionItem(item) ? (
                <span className="text-[11px] font-semibold text-emerald-700 shrink-0 px-1">BONO</span>
              ) : item.kind === 'bonus' ? (
                <>
                  <Select
                    value={item.bonus_payment_mode ?? 'none'}
                    onValueChange={(v) => updateAt(index, { bonus_payment_mode: v as BonusPaymentMode })}
                  >
                    <SelectTrigger className="h-7 w-[72px] text-[11px] px-1.5 shrink-0">
                      <SelectValue />
                    </SelectTrigger>
                    <AppointmentSelectContent>
                      <SelectItem value="none">Sin cobro</SelectItem>
                      <SelectItem value="full">100%</SelectItem>
                      <SelectItem value="60">60%</SelectItem>
                      <SelectItem value="40">40%</SelectItem>
                    </AppointmentSelectContent>
                  </Select>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    className="h-7 w-14 text-xs px-1 shrink-0"
                    value={item.unit_price ?? 0}
                    onChange={(e) => updateAt(index, { unit_price: parseFloat(e.target.value) || 0 })}
                  />
                </>
              ) : (
                <>
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    className="h-7 w-10 text-xs px-1 shrink-0"
                    value={item.quantity ?? 1}
                    onChange={(e) => updateAt(index, { quantity: parseFloat(e.target.value) || 0 })}
                  />
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    className="h-7 w-14 text-xs px-1 shrink-0"
                    value={item.unit_price ?? 0}
                    onChange={(e) => updateAt(index, { unit_price: parseFloat(e.target.value) || 0 })}
                  />
                </>
              )}
              <span className="text-[10px] tabular-nums shrink-0 w-[44px] text-right font-medium text-emerald-700">
                {formatAppointmentItemAmount(item)}
              </span>
              {cabinasCatalog.filter((c) => c.activa !== false).length > 0 && (
                <Select
                  value={item.cabina_id || 'none'}
                  onValueChange={(v) => updateAt(index, { cabina_id: v === 'none' ? null : v })}
                >
                  <SelectTrigger className="h-7 w-[88px] text-[10px] px-1 shrink-0">
                    <SelectValue placeholder="Cabina" />
                  </SelectTrigger>
                  <AppointmentSelectContent>
                    <SelectItem value="none">Sin cabina</SelectItem>
                    {cabinasCatalog.filter((c) => c.activa !== false).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>
                    ))}
                  </AppointmentSelectContent>
                </Select>
              )}
              {recursosCatalog.length > 0 && (
                <Select
                  value={item.recurso_id || 'none'}
                  onValueChange={(v) => updateAt(index, { recurso_id: v === 'none' ? null : v })}
                >
                  <SelectTrigger className="h-7 w-[88px] text-[10px] px-1 shrink-0">
                    <SelectValue placeholder="Recurso" />
                  </SelectTrigger>
                  <AppointmentSelectContent>
                    <SelectItem value="none">
                      {seg?.recursoName ? `Auto (${seg.recursoName})` : 'Auto'}
                    </SelectItem>
                    {recursosCatalog.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.nombre}</SelectItem>
                    ))}
                  </AppointmentSelectContent>
                </Select>
              )}
              {!!customerId && legacyVouchers.some((v) => v.article_id && v.article_id === item.article_id && v.remaining > 0) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-[10px] px-1.5 shrink-0"
                  onClick={() => {
                    const voucher = legacyVouchers.find((v) => v.article_id && v.article_id === item.article_id && v.remaining > 0);
                    if (voucher) useVoucherAt(index, voucher);
                  }}
                >
                  Bono
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0 ml-auto"
                disabled={items.length <= 1}
                onClick={() => removeAt(index)}
                aria-label="Quitar ítem"
              >
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
            {(item.bono_id || item.customer_voucher_id || conflicts.length > 0) && (
              <div className="flex flex-wrap items-center gap-1 pt-0.5 text-[10px]">
                {item.bono_id && (
                  <span className="text-emerald-700 font-medium">
                    {(() => {
                      const bono = activeBonos.find((b) => b.id === item.bono_id);
                      return bono ? `Bono: ${bono.nombre}` : 'Sesión de bono';
                    })()}
                  </span>
                )}
                {item.customer_voucher_id && !item.bono_id && (
                  <span className="text-muted-foreground">
                    {(() => {
                      const voucher = activeBonos.find((v) => v.id === item.customer_voucher_id);
                      if (!voucher) return 'Bono aplicado';
                      return `Bono: ${voucher.nombre}`;
                    })()}
                  </span>
                )}
                {conflicts.map((msg) => (
                  <span key={msg} className="inline-flex items-center gap-0.5 text-destructive">
                    <AlertTriangle className="w-3 h-3 shrink-0" />
                    {msg}
                  </span>
                ))}
              </div>
            )}
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

        <div className="space-y-1 max-h-[180px] overflow-y-auto pr-0.5 pt-1 border-t border-border/60">
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
              <AppointmentSelectContent>
                <SelectItem value="service">Servicio</SelectItem>
                <SelectItem value="product">Producto</SelectItem>
                <SelectItem value="bonus">Bono</SelectItem>
                <SelectItem value="other">Otro</SelectItem>
              </AppointmentSelectContent>
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
              <AppointmentSelectContent>
                <SelectItem value="none">Sin artículo</SelectItem>
                {filteredArticles.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {`${a.codigo ? `${a.codigo} - ` : ''}${a.descripcion}`.trim()}
                  </SelectItem>
                ))}
              </AppointmentSelectContent>
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
                  <AppointmentSelectContent>
                    <SelectItem value="none">Sin cobro</SelectItem>
                    <SelectItem value="full">100%</SelectItem>
                    <SelectItem value="60">60%</SelectItem>
                    <SelectItem value="40">40%</SelectItem>
                  </AppointmentSelectContent>
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
            <span className="text-[10px] tabular-nums min-w-[55px] text-right font-medium text-emerald-700">
              {formatAppointmentItemAmount(item)}
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
