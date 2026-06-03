import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO, subDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { Loader2, Images, Calendar, CheckSquare, Square, Video } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import {
  downloadImmichAsset,
  fetchImmichThumbnail,
  isImmichVideoAsset,
  resolveImmichBrowseStartDate,
  searchImmichAssetsByDate,
  todayYmd,
  type ImmichAsset,
} from '@/lib/immichClient';
import { uploadAppointmentAsset, uploadCustomerLogAsset } from '@/lib/appointmentAssets';
import { cn } from '@/lib/utils';

const MAX_EMPTY_DAYS_BEFORE_STOP = 21;
const SCROLL_LOAD_THRESHOLD_PX = 140;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  companyId: string;
  customerLabel: string;
  /** Si se indica, los archivos se vinculan a la cita (popup agenda). */
  appointmentId?: string;
  logDate?: string;
  defaultAnchorDate?: string;
  dialogLayerClass?: string;
  onImported?: () => void;
}

type DayGroup = { date: string; assets: ImmichAsset[] };

function assetDate(asset: ImmichAsset): string {
  const raw = asset.localDateTime ?? asset.fileCreatedAt;
  if (!raw) return new Date().toISOString().slice(0, 10);
  return raw.slice(0, 10);
}

function formatDayLabel(ymd: string): string {
  try {
    return format(parseISO(`${ymd}T12:00:00`), "EEEE d 'de' MMMM yyyy", { locale: es });
  } catch {
    return ymd;
  }
}

function previousYmd(ymd: string): string {
  return format(subDays(parseISO(`${ymd}T12:00:00`), 1), 'yyyy-MM-dd');
}

function ImmichAssetThumb({
  asset,
  selected,
  onToggle,
}: {
  asset: ImmichAsset;
  selected: boolean;
  onToggle: () => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    fetchImmichThumbnail(asset.id)
      .then((url) => {
        if (!cancelled) {
          objectUrl = url;
          setSrc(url);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [asset.id]);

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'relative aspect-square rounded-lg border overflow-hidden bg-muted/40 text-left',
        selected ? 'ring-2 ring-sky-500 border-sky-500' : 'border-border/60 hover:border-sky-300',
      )}
      title={asset.originalFileName ?? asset.id}
    >
      {src && !failed ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground px-1 text-center">
          {failed ? 'Sin miniatura' : <Loader2 className="h-5 w-5 animate-spin" />}
        </div>
      )}
      {isImmichVideoAsset(asset) ? (
        <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 py-0.5 text-white">
          <Video className="h-3 w-3" />
        </span>
      ) : null}
      <span className="absolute top-1 right-1 rounded bg-black/50 p-0.5 text-white">
        {selected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
      </span>
    </button>
  );
}

export const ImmichImportDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  customerId,
  companyId,
  customerLabel,
  appointmentId,
  logDate,
  defaultAnchorDate,
  dialogLayerClass = 'z-[110]',
  onImported,
}) => {
  const importToAppointment = Boolean(appointmentId && logDate);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);

  const [anchorDate, setAnchorDate] = useState(todayYmd);
  const [anchorReady, setAnchorReady] = useState(false);
  const [dayGroups, setDayGroups] = useState<DayGroup[]>([]);
  const [oldestLoadedDate, setOldestLoadedDate] = useState<string | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);

  const allAssets = useMemo(
    () => dayGroups.flatMap((g) => g.assets),
    [dayGroups],
  );

  const assetById = useMemo(() => {
    const map = new Map<string, ImmichAsset>();
    for (const a of allAssets) map.set(a.id, a);
    return map;
  }, [allAssets]);

  const loadDay = useCallback(async (ymd: string) => {
    const { assets } = await searchImmichAssetsByDate(ymd);
    return { date: ymd, assets };
  }, []);

  const resetFeed = useCallback(() => {
    setDayGroups([]);
    setOldestLoadedDate(null);
    setHasMore(true);
    setLoadError(null);
    setSelected(new Set());
    loadingMoreRef.current = false;
  }, []);

  const loadAnchorDay = useCallback(
    async (ymd: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return;
      setLoadingInitial(true);
      setLoadError(null);
      try {
        const group = await loadDay(ymd);
        setDayGroups([group]);
        setOldestLoadedDate(ymd);
        setHasMore(true);
      } catch (e) {
        setLoadError((e as Error).message || 'Error al cargar Immich');
        setDayGroups([]);
      } finally {
        setLoadingInitial(false);
      }
    },
    [loadDay],
  );

  const appendOlderDays = useCallback(async () => {
    if (loadingMoreRef.current || !hasMore || !oldestLoadedDate) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      let cursor = oldestLoadedDate;
      let emptyStreak = 0;
      const appended: DayGroup[] = [];

      while (emptyStreak < MAX_EMPTY_DAYS_BEFORE_STOP) {
        cursor = previousYmd(cursor);
        const group = await loadDay(cursor);
        if (group.assets.length > 0) {
          appended.push(group);
          emptyStreak = 0;
          break;
        }
        emptyStreak += 1;
      }

      if (appended.length > 0) {
        setDayGroups((prev) => [...prev, ...appended]);
        setOldestLoadedDate(appended[appended.length - 1].date);
      }
      if (emptyStreak >= MAX_EMPTY_DAYS_BEFORE_STOP) {
        setHasMore(false);
      }
    } catch (e) {
      setLoadError((e as Error).message || 'Error al cargar más días');
    } finally {
      setLoadingMore(false);
      loadingMoreRef.current = false;
    }
  }, [hasMore, oldestLoadedDate, loadDay]);

  useEffect(() => {
    if (!open) {
      resetFeed();
      setAnchorReady(false);
      return;
    }
    let cancelled = false;
    resetFeed();
    setAnchorReady(false);
    setLoadingInitial(true);
    setLoadError(null);

    void (async () => {
      try {
        const resolved = await resolveImmichBrowseStartDate(defaultAnchorDate);
        if (cancelled) return;
        setAnchorDate(resolved);
        setAnchorReady(true);
      } catch (e) {
        if (!cancelled) {
          setLoadError((e as Error).message || 'Error al conectar con Immich');
          setAnchorDate(defaultAnchorDate ?? todayYmd());
          setAnchorReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, defaultAnchorDate, resetFeed]);

  useEffect(() => {
    if (!open || !anchorReady) return;
    void loadAnchorDay(anchorDate);
  }, [open, anchorReady, anchorDate, loadAnchorDay]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || loadingInitial || loadingMore || !hasMore) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distance < SCROLL_LOAD_THRESHOLD_PX) {
      void appendOlderDays();
    }
  }, [appendOlderDays, hasMore, loadingInitial, loadingMore]);

  const toggleAll = useCallback(() => {
    if (selected.size === allAssets.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allAssets.map((a) => a.id)));
    }
  }, [allAssets, selected.size]);

  const handleImport = async () => {
    if (selected.size === 0) {
      toast({ title: 'Selecciona al menos un archivo', variant: 'destructive' });
      return;
    }
    setImporting(true);
    let ok = 0;
    let fail = 0;
    try {
      for (const assetId of selected) {
        const asset = assetById.get(assetId);
        try {
          const { blob, fileName, mimeType } = await downloadImmichAsset(assetId);
          const itemDate = asset ? assetDate(asset) : anchorDate;
          const title = asset?.originalFileName ?? 'Immich';
          if (importToAppointment) {
            const file = new File([blob], fileName, {
              type: mimeType || blob.type || 'application/octet-stream',
            });
            await uploadAppointmentAsset({
              file,
              appointmentId: appointmentId!,
              customerId,
              companyId,
              logDate: logDate!,
              title,
            });
          } else {
            await uploadCustomerLogAsset({
              blob,
              fileName,
              mimeType,
              customerId,
              companyId,
              logDate: itemDate,
              title,
            });
          }
          ok += 1;
        } catch (e) {
          console.error('immich import item', assetId, e);
          fail += 1;
        }
      }
      queryClient.invalidateQueries({ queryKey: ['customer_attachments', customerId] });
      queryClient.invalidateQueries({ queryKey: ['customer_day_timeline', customerId] });
      if (appointmentId) {
        queryClient.invalidateQueries({ queryKey: ['appointment_assets', appointmentId] });
        queryClient.invalidateQueries({ queryKey: ['agenda-appointment-attachments'] });
      }
      onImported?.();
      toast({
        title: 'Importación completada',
        description: `${ok} archivo(s) importado(s)${fail ? ` · ${fail} error(es)` : ''}.`,
      });
      onOpenChange(false);
    } finally {
      setImporting(false);
    }
  };

  const isToday = anchorDate === todayYmd();
  const totalFiles = allAssets.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName={dialogLayerClass}
        className={cn(dialogLayerClass, 'max-w-2xl max-h-[90vh] flex flex-col overflow-hidden')}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Images className="h-5 w-5" />
            Importar desde Immich
          </DialogTitle>
          <DialogDescription>
            Fotos y vídeos desde el día elegido hacia atrás. Desplázate hacia abajo para cargar días
            anteriores. Se adjuntan a{' '}
            <span className="font-medium text-foreground">{customerLabel}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5 flex-1 min-w-[180px]">
            <Label htmlFor="immich-photo-date">Día de inicio</Label>
            <div className="relative">
              <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="immich-photo-date"
                type="date"
                className="pl-8"
                value={anchorDate}
                onChange={(e) => setAnchorDate(e.target.value)}
              />
            </div>
          </div>
          <Button
            type="button"
            variant={isToday ? 'secondary' : 'outline'}
            size="sm"
            className="mb-0.5"
            onClick={() => setAnchorDate(todayYmd())}
          >
            Hoy
          </Button>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {loadingInitial
              ? 'Cargando…'
              : `${totalFiles} archivo(s) en ${dayGroups.length} día(s) · ${selected.size} seleccionado(s)`}
          </span>
          {totalFiles > 0 ? (
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={toggleAll}>
              {selected.size === totalFiles ? 'Quitar selección' : 'Seleccionar todos'}
            </Button>
          ) : null}
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 min-h-0 overflow-y-auto rounded-md border p-2 max-h-[min(58vh,520px)]"
        >
          {loadError ? (
            <p className="text-sm text-destructive p-4 text-center">{loadError}</p>
          ) : loadingInitial ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : dayGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center">
              No hay archivos en Immich para este día. Prueba otro día o desplázate si ya cargaste más
              abajo.
            </p>
          ) : (
            <div className="space-y-4">
              {dayGroups.map((group) => (
                <section key={group.date}>
                  <h3 className="text-xs font-semibold text-foreground capitalize sticky top-0 z-[1] bg-background/95 backdrop-blur py-1.5 mb-2 border-b border-border/40">
                    {formatDayLabel(group.date)}
                    <span className="ml-2 font-normal text-muted-foreground tabular-nums">
                      ({group.assets.length})
                    </span>
                  </h3>
                  {group.assets.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-1">Sin archivos este día.</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {group.assets.map((asset) => (
                        <ImmichAssetThumb
                          key={asset.id}
                          asset={asset}
                          selected={selected.has(asset.id)}
                          onToggle={() => {
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (next.has(asset.id)) next.delete(asset.id);
                              else next.add(asset.id);
                              return next;
                            });
                          }}
                        />
                      ))}
                    </div>
                  )}
                </section>
              ))}

              <div className="flex justify-center py-3 text-xs text-muted-foreground">
                {loadingMore ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Cargando días anteriores…
                  </span>
                ) : hasMore ? (
                  'Desplázate para cargar días anteriores'
                ) : (
                  'No hay más días con archivos'
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleImport} disabled={importing || selected.size === 0}>
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importando…
              </>
            ) : (
              `Importar ${selected.size || ''} archivo(s)`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
