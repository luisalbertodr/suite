import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  inbodyBarScale,
  inbodyRangeStatus,
  inbodyStatusLabel,
  completeSpanishDni,
  normalizeInbodyMeasurement,
  type InbodyMeasurement,
  type InbodySegmentEntry,
} from '@/lib/inbodyMeasurements';

export const INBODY_REPORT_TEMPLATE_URL = '/inbody/inbody-report-template.png';

/** Plantilla y coordenadas en píxeles reales 980×1200 (origen arriba-izquierda). */
const REF_W = 980;
const REF_H = 1200;
const FONT = 'Arial, Helvetica, sans-serif';
/** Escala global de tipografía (respecto a la base 11 px). */
const FONT_SCALE = 1.28;
const fs = (base: number) => Math.round(base * FONT_SCALE);
const EXERCISE_DURATION_MIN = 30;
const EXERCISE_KCAL_COEFF = 0.0084;

/** MET por icono del planificador (filas × columnas). */
const EXERCISE_METS: number[][] = [
  [4.8, 3.5, 3.0, 2.5, 4.5, 4.0, 7.0],
  [7.0, 6.5, 10.0, 9.0, 7.0, 6.8, 8.0],
];

type RefRect = { x1: number; y1: number; x2: number; y2: number };

/** Regiones en píxeles de la plantilla 980×1200. */
const REGIONS = {
  patientInfo: { x1: 260, y1: 49, x2: 748, y2: 73 },
  logo: { x1: 748, y1: 7, x2: 962, y2: 78 },
  composition: { x1: 166, y1: 107, x2: 576, y2: 249 },
  act: { x1: 164, y1: 256, x2: 303, y2: 293 },
  mlg: { x1: 433, y1: 256, x2: 576, y2: 294 },
  diagnosis: { x1: 165, y1: 382, x2: 369, y2: 572 },
  muscleControl: { x1: 166, y1: 647, x2: 300, y2: 699 },
  fatControl: { x1: 448, y1: 649, x2: 575, y2: 699 },
  impedance: { x1: 693, y1: 642, x2: 939, y2: 680 },
  leanSegmental: { x1: 732, y1: 116, x2: 937, y2: 320 },
  fatSegmental: { x1: 732, y1: 357, x2: 937, y2: 558 },
  exercise: { x1: 45, y1: 832, x2: 652, y2: 985 },
  dailyKcal: { x1: 671, y1: 1092, x2: 911, y2: 1118 },
  exerciseWeight: { x1: 290, y1: 693, x2: 345, y2: 706 },
} as const satisfies Record<string, RefRect>;

/** Composición corporal — eje horizontal (980×1200). */
const COMPOSITION_BAR = { x1: 142, x2: 340 }; // Bajo 142–221 · Normal 221–280 · Alto 280–340
const COMPOSITION_UNIT = { x1: 341, x2: 414 }; // Unidad / valor medido (kg)
const COMPOSITION_NORM = { x1: 420, x2: 489 }; // Valor normal + valoración debajo

type SegmentKey = 'right_arm' | 'left_arm' | 'trunk' | 'right_leg' | 'left_leg';

/** Posición duración planificador (min). */
const EXERCISE_DURATION = { x: 315, y: 776 };

/** Posiciones X segmentales (extremidades +20 px de separación horizontal). */
const SEGMENT_X: Record<SegmentKey, number> = {
  right_arm: 779,
  left_arm: 890,
  trunk: 834.5,
  right_leg: 779,
  left_leg: 890,
};

const SEGMENT_Y: Record<SegmentKey, { lean: number; fat: number }> = {
  right_arm: { lean: 0.16, fat: 0.16 },
  left_arm: { lean: 0.16, fat: 0.16 },
  trunk: { lean: 0.5, fat: 0.5 },
  right_leg: { lean: 0.84, fat: 0.84 },
  left_leg: { lean: 0.84, fat: 0.84 },
};

const SEGMENT_KEYS: SegmentKey[] = ['right_arm', 'left_arm', 'trunk', 'right_leg', 'left_leg'];

const IMPEDANCE_COLS: Array<{ key: keyof NonNullable<InbodyMeasurement['impedance']>[string]; col: number }> = [
  { key: 'right_arm', col: 0 },
  { key: 'left_arm', col: 1 },
  { key: 'trunk', col: 2 },
  { key: 'right_leg', col: 3 },
  { key: 'left_leg', col: 4 },
];

export interface InbodyReportRenderOptions {
  customerName?: string;
  logo?: HTMLImageElement | null;
  logoUrl?: string | null;
}

function fmt(value: number | null | undefined, decimals = 1, suffix = ''): string {
  if (value == null || Number.isNaN(value)) return '';
  return `${value.toFixed(decimals).replace('.', ',')}${suffix}`;
}

function fmtRange(min: number | null | undefined, max: number | null | undefined, decimals = 1): string {
  if (min == null || max == null) return '';
  return `${min.toFixed(decimals).replace('.', ',')} ~ ${max.toFixed(decimals).replace('.', ',')}`;
}

function segmentPoint(rect: RefRect, xRef: number, rowPct: number) {
  return {
    x: xRef,
    y: rect.y1 + (rect.y2 - rect.y1) * rowPct,
  };
}

function ensureHttpsAssetUrl(url: string): string {
  return url.startsWith('http://') ? url.replace(/^http:\/\//i, 'https://') : url;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: 'image/jpeg' | 'image/png' = 'image/jpeg',
  quality = 0.92,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen'))),
      mime,
      quality,
    );
  });
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

async function triggerCanvasDownload(
  canvas: HTMLCanvasElement,
  filename: string,
  quality = 0.92,
): Promise<void> {
  const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
  triggerBlobDownload(blob, filename);
}

function canShareInbodyFile(file: File): boolean {
  if (typeof navigator.share !== 'function') return false;
  try {
    return navigator.canShare?.({ files: [file] }) ?? false;
  } catch {
    return false;
  }
}

function isShareUnsupportedError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? err.message
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: unknown }).message ?? '')
        : String(err ?? '');
  return /UNSUPPORTED_OS|not supported|Share API|denied/i.test(msg);
}

function px(w: number, h: number, x: number, y: number): { x: number; y: number } {
  return { x: (x / REF_W) * w, y: (y / REF_H) * h };
}

function scaledRect(w: number, h: number, rect: RefRect) {
  const tl = px(w, h, rect.x1, rect.y1);
  const br = px(w, h, rect.x2, rect.y2);
  return {
    x: tl.x,
    y: tl.y,
    w: br.x - tl.x,
    h: br.y - tl.y,
    cx: (tl.x + br.x) / 2,
    cy: (tl.y + br.y) / 2,
  };
}

function rowCenterY(rect: RefRect, rowIndex: number, rowCount: number): number {
  const band = (rect.y2 - rect.y1) / rowCount;
  return rect.y1 + band * (rowIndex + 0.5);
}

function colCenterX(rect: RefRect, colIndex: number, colCount: number): number {
  const band = (rect.x2 - rect.x1) / colCount;
  return rect.x1 + band * (colIndex + 0.5);
}

function sliceRow(rect: RefRect, rowIndex: number, rowCount: number): RefRect {
  const band = (rect.y2 - rect.y1) / rowCount;
  return {
    x1: rect.x1,
    x2: rect.x2,
    y1: rect.y1 + band * rowIndex,
    y2: rect.y1 + band * (rowIndex + 1),
  };
}

function splitRectHorizontal(rect: RefRect, leftRatio: number): [RefRect, RefRect] {
  const mid = rect.x1 + (rect.x2 - rect.x1) * leftRatio;
  return [
    { x1: rect.x1, y1: rect.y1, x2: mid, y2: rect.y2 },
    { x1: mid, y1: rect.y1, x2: rect.x2, y2: rect.y2 },
  ];
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: { size?: number; align?: CanvasTextAlign; bold?: boolean; color?: string } = {},
) {
  if (!text) return;
  const { size = fs(11), align = 'left', bold = false, color = '#1a1a1a' } = opts;
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${bold ? '700' : '400'} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawTextInRect(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rect: RefRect,
  text: string,
  opts: { size?: number; align?: CanvasTextAlign; bold?: boolean; color?: string } = {},
) {
  const r = scaledRect(w, h, rect);
  drawText(ctx, text, r.cx, r.cy, { align: 'center', ...opts });
}

function drawCompositionMarker(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  yRef: number,
  value: number | null | undefined,
  min: number | null | undefined,
  max: number | null | undefined,
) {
  if (value == null || min == null || max == null) return;
  const scale = inbodyBarScale(value, min, max);
  const barLeft = px(w, h, COMPOSITION_BAR.x1, yRef);
  const barRight = px(w, h, COMPOSITION_BAR.x2, yRef);
  const barWidth = barRight.x - barLeft.x;
  const barH = px(w, h, 0, 18).y;
  const markerX = barLeft.x + (scale.markerPct / 100) * barWidth;
  ctx.save();
  ctx.strokeStyle = '#1d4ed8';
  ctx.lineWidth = Math.max(2, px(w, h, 0, 2.5).y);
  ctx.beginPath();
  ctx.moveTo(markerX, barLeft.y - barH / 2);
  ctx.lineTo(markerX, barLeft.y + barH / 2);
  ctx.stroke();
  ctx.restore();
}

function drawTextInRowSlice(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rowSlice: RefRect,
  xRect: RefRect,
  text: string,
  opts: Parameters<typeof drawTextInRect>[4] = {},
  yFraction = 0.5,
) {
  const slice: RefRect = {
    x1: xRect.x1,
    x2: xRect.x2,
    y1: rowSlice.y1,
    y2: rowSlice.y2,
  };
  const r = scaledRect(w, h, slice);
  drawText(ctx, text, r.cx, r.y + r.h * yFraction, { align: 'center', ...opts });
}

function evalCodeLabel(code: number | null | undefined): string {
  if (code == null || Number.isNaN(code)) return '';
  if (code <= 0) return 'Bajo';
  if (code >= 2) return 'Alto';
  return 'Normal';
}

function evalFromEntry(entry?: InbodySegmentEntry): number | null {
  const code = entry?.eval_pct;
  if (code != null && !Number.isNaN(code) && code <= 2) return code;
  const pct = entry?.pct;
  return pct == null || Number.isNaN(pct) ? null : pct;
}

function exerciseKcal(weightKg: number, met: number, minutes = EXERCISE_DURATION_MIN): number {
  if (met <= 0) return 0;
  return Math.round(EXERCISE_KCAL_COEFF * met * weightKg * minutes);
}

function recommendedDailyKcal(bmr: number | null | undefined): number | null {
  if (bmr == null || Number.isNaN(bmr)) return null;
  return Math.round(bmr * 1.55);
}

function drawPatientInfo(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  m: InbodyMeasurement,
  customerName?: string,
) {
  const rect = REGIONS.patientInfo;
  const name = (customerName || '').trim() || '—';
  const dni = completeSpanishDni(m.inbody_user_id) || '—';
  const age = m.age_years != null ? `${fmt(m.age_years, 0)} años` : '—';
  const dateStr = format(new Date(m.measured_at), 'dd/MM/yyyy HH:mm', { locale: es });
  const line = [name, `DNI ${dni}`, age, dateStr].filter(Boolean).join('   ·   ');
  drawTextInRect(ctx, w, h, rect, line, { size: fs(10), bold: true });
}

function drawLogo(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  logo: HTMLImageElement | null | undefined,
) {
  const r = scaledRect(w, h, REGIONS.logo);
  if (logo?.naturalWidth) {
    ctx.save();
    const pad = Math.max(2, r.w * 0.04);
    const maxW = r.w - pad * 2;
    const maxH = r.h - pad * 2;
    const scale = Math.min(maxW / logo.naturalWidth, maxH / logo.naturalHeight);
    const drawW = logo.naturalWidth * scale;
    const drawH = logo.naturalHeight * scale;
    ctx.drawImage(logo, r.cx - drawW / 2, r.cy - drawH / 2, drawW, drawH);
    ctx.restore();
    return;
  }
  drawTextInRect(ctx, w, h, REGIONS.logo, 'Lipoout', { size: fs(14), bold: true, color: '#0f766e' });
}

function drawComposition(ctx: CanvasRenderingContext2D, w: number, h: number, m: InbodyMeasurement) {
  const rect = REGIONS.composition;
  const rows = [
    { row: 0, value: m.weight_kg, min: m.weight_min_kg, max: m.weight_max_kg },
    { row: 1, value: m.smm_kg, min: m.smm_min_kg, max: m.smm_max_kg },
    { row: 2, value: m.body_fat_kg, min: m.body_fat_min_kg, max: m.body_fat_max_kg },
  ];

  for (const item of rows) {
    const yRef = rowCenterY(rect, item.row, 3);
    const rowSlice = sliceRow(rect, item.row, 3);

    drawCompositionMarker(ctx, w, h, yRef, item.value, item.min, item.max);

    drawTextInRowSlice(
      ctx,
      w,
      h,
      rowSlice,
      COMPOSITION_UNIT,
      fmt(item.value, 1),
      { size: fs(13), bold: true },
    );

    const rangeText = fmtRange(item.min, item.max);
    const status = inbodyStatusLabel(inbodyRangeStatus(item.value, item.min, item.max));
    drawTextInRowSlice(
      ctx,
      w,
      h,
      rowSlice,
      COMPOSITION_NORM,
      rangeText,
      { size: fs(11) },
      0.35,
    );
    if (status !== '—') {
      drawTextInRowSlice(
        ctx,
        w,
        h,
        rowSlice,
        COMPOSITION_NORM,
        status,
        { size: fs(11), color: '#374151', bold: true },
        0.75,
      );
    }
  }
}

function drawActAndMlg(ctx: CanvasRenderingContext2D, w: number, h: number, m: InbodyMeasurement) {
  const [actValue, actRange] = splitRectHorizontal(REGIONS.act, 0.45);
  drawTextInRect(ctx, w, h, actValue, fmt(m.tbw_kg, 1), { size: fs(12), bold: true });
  drawTextInRect(ctx, w, h, actRange, fmtRange(m.tbw_min_kg, m.tbw_max_kg), { size: fs(11) });

  const [mlgValue, mlgRange] = splitRectHorizontal(REGIONS.mlg, 0.45);
  drawTextInRect(ctx, w, h, mlgValue, fmt(m.ffm_kg, 1), { size: fs(12), bold: true });
  drawTextInRect(ctx, w, h, mlgRange, fmtRange(m.ffm_min_kg, m.ffm_max_kg), { size: fs(11) });
}

function drawDiagnosis(ctx: CanvasRenderingContext2D, w: number, h: number, m: InbodyMeasurement) {
  const rect = REGIONS.diagnosis;
  const rows = [
    { value: fmt(m.bmi, 1), range: fmtRange(m.bmi_min, m.bmi_max) },
    { value: fmt(m.pbf_pct, 1, '%'), range: fmtRange(m.pbf_min_pct, m.pbf_max_pct, 1) },
    { value: fmt(m.whr, 2), range: fmtRange(m.whr_min, m.whr_max, 2) },
    { value: fmt(m.bmr_kcal, 0), range: fmtRange(m.bmr_min_kcal, m.bmr_max_kcal, 0) },
  ];

  rows.forEach((row, index) => {
    const rowRect = sliceRow(rect, index, rows.length);
    const [valuePart, rangePart] = splitRectHorizontal(rowRect, 0.42);
    drawTextInRect(ctx, w, h, valuePart, row.value, { size: fs(12), bold: true });
    drawTextInRect(ctx, w, h, rangePart, row.range, { size: fs(11) });
  });
}

function drawControlValues(ctx: CanvasRenderingContext2D, w: number, h: number, m: InbodyMeasurement) {
  drawTextInRect(ctx, w, h, REGIONS.muscleControl, fmt(m.muscle_control_kg, 1), {
    size: fs(13),
    bold: true,
  });
  drawTextInRect(ctx, w, h, REGIONS.fatControl, fmt(m.fat_control_kg, 1), {
    size: fs(13),
    bold: true,
  });
}

function drawSegmentBlock(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  lean: InbodyMeasurement['segmental_lean'],
  fat: InbodyMeasurement['segmental_fat'],
) {
  const lineGap = px(w, h, 0, 16).y;

  for (const key of SEGMENT_KEYS) {
    const leanEntry = lean?.[key];
    const fatEntry = fat?.[key];
    const yLean = SEGMENT_Y[key].lean;
    const yFat = SEGMENT_Y[key].fat;

    const leanPt = segmentPoint(REGIONS.leanSegmental, SEGMENT_X[key], yLean);
    const fatPt = segmentPoint(REGIONS.fatSegmental, SEGMENT_X[key], yFat);
    const leanPos = px(w, h, leanPt.x, leanPt.y);
    const fatPos = px(w, h, fatPt.x, fatPt.y);

    drawText(ctx, fmt(leanEntry?.kg, 1), leanPos.x, leanPos.y - lineGap / 2, {
      size: fs(11),
      align: 'center',
      bold: true,
    });
    drawText(ctx, evalCodeLabel(evalFromEntry(leanEntry)), leanPos.x, leanPos.y + lineGap / 2, {
      size: fs(10),
      align: 'center',
    });

    const fatPct = fmt(fatEntry?.pct, 1, '%');
    const fatKg = fmt(fatEntry?.kg, 1);
    const fatLine = [fatPct, fatKg].filter(Boolean).join(' · ');
    if (fatLine) {
      drawText(ctx, fatLine, fatPos.x, fatPos.y - lineGap / 2, {
        size: fs(10),
        align: 'center',
        bold: true,
      });
    }
    const fatEval = evalCodeLabel(evalFromEntry(fatEntry as InbodySegmentEntry | undefined));
    if (fatEval) {
      drawText(ctx, fatEval, fatPos.x, fatPos.y + lineGap / 2, { size: fs(10), align: 'center' });
    }
  }
}

function drawImpedance(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  impedance: InbodyMeasurement['impedance'],
) {
  const rect = REGIONS.impedance;
  const freqs = [
    { key: '20khz' as const, row: 0 },
    { key: '100khz' as const, row: 1 },
  ];

  for (const freq of freqs) {
    const block = impedance?.[freq.key];
    if (!block) continue;
    for (const col of IMPEDANCE_COLS) {
      const val = block[col.key];
      const x = colCenterX(rect, col.col, IMPEDANCE_COLS.length);
      const y = rowCenterY(rect, freq.row, freqs.length) + 5;
      const p = px(w, h, x, y);
      drawText(ctx, fmt(val, 1), p.x, p.y, { size: fs(10), align: 'center' });
    }
  }
}

function drawExercisePlanner(ctx: CanvasRenderingContext2D, w: number, h: number, m: InbodyMeasurement) {
  const weight = m.weight_kg;
  if (weight == null) return;

  drawTextInRect(ctx, w, h, REGIONS.exerciseWeight, fmt(weight, 1, 'kg'), {
    size: fs(11),
    bold: true,
  });

  const durPos = px(w, h, EXERCISE_DURATION.x, EXERCISE_DURATION.y);
  drawText(ctx, String(EXERCISE_DURATION_MIN), durPos.x, durPos.y, {
    size: fs(11),
    bold: true,
    align: 'center',
  });

  const rect = REGIONS.exercise;
  EXERCISE_METS.forEach((row, rowIdx) => {
    row.forEach((met, colIdx) => {
      if (met <= 0) return;
      const kcal = exerciseKcal(weight, met);
      const x = colCenterX(rect, colIdx, row.length);
      const y = rowCenterY(rect, rowIdx, EXERCISE_METS.length);
      const p = px(w, h, x, y);
      drawText(ctx, String(kcal), p.x, p.y, { size: fs(10), align: 'center', bold: true });
    });
  });

  const recommended = recommendedDailyKcal(m.bmr_kcal);
  if (recommended != null) {
    drawTextInRect(ctx, w, h, REGIONS.dailyKcal, String(recommended), {
      size: fs(12),
      bold: true,
    });
  }
}

export async function loadInbodyReportTemplate(): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la plantilla InBody'));
    img.src = INBODY_REPORT_TEMPLATE_URL;
  });
}

export async function loadInbodyReportLogo(url?: string | null): Promise<HTMLImageElement | null> {
  if (!url?.trim()) return null;
  const safeUrl = ensureHttpsAssetUrl(url.trim());
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = safeUrl;
  });
}

async function renderReportCanvas(
  measurement: InbodyMeasurement,
  options: InbodyReportRenderOptions = {},
): Promise<HTMLCanvasElement> {
  const template = await loadInbodyReportTemplate();
  const logo = options.logo ?? (await loadInbodyReportLogo(options.logoUrl));
  return renderInbodyReportCanvas(template, measurement, { ...options, logo });
}

export function renderInbodyReportCanvas(
  template: HTMLImageElement,
  measurement: InbodyMeasurement,
  options: InbodyReportRenderOptions = {},
): HTMLCanvasElement {
  const m = normalizeInbodyMeasurement(measurement);
  const canvas = document.createElement('canvas');
  canvas.width = REF_W;
  canvas.height = REF_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');

  const w = canvas.width;
  const h = canvas.height;

  ctx.drawImage(template, 0, 0, w, h);
  drawPatientInfo(ctx, w, h, m, options.customerName);
  drawLogo(ctx, w, h, options.logo);
  drawComposition(ctx, w, h, m);
  drawActAndMlg(ctx, w, h, m);
  drawDiagnosis(ctx, w, h, m);
  drawControlValues(ctx, w, h, m);
  drawSegmentBlock(ctx, w, h, m.segmental_lean, m.segmental_fat);
  drawImpedance(ctx, w, h, m.impedance);
  drawExercisePlanner(ctx, w, h, m);

  return canvas;
}

export async function buildInbodyReportBlob(
  measurement: InbodyMeasurement,
  mime: 'image/jpeg' | 'image/png' = 'image/jpeg',
  quality = 0.92,
  options: InbodyReportRenderOptions = {},
): Promise<Blob> {
  const canvas = await renderReportCanvas(measurement, options);
  return canvasToBlob(canvas, mime, quality);
}

export function inbodyReportFilename(measurement: InbodyMeasurement, customerName?: string): string {
  const date = measurement.measured_at.slice(0, 10);
  const slug = (customerName || measurement.inbody_user_id || 'cliente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `inbody-${slug}-${date}.jpg`;
}

export async function downloadInbodyReport(
  measurement: InbodyMeasurement,
  customerName?: string,
  options: Omit<InbodyReportRenderOptions, 'customerName'> = {},
): Promise<void> {
  const canvas = await renderReportCanvas(measurement, { ...options, customerName });
  await triggerCanvasDownload(canvas, inbodyReportFilename(measurement, customerName));
}

export async function shareInbodyReport(
  measurement: InbodyMeasurement,
  customerName?: string,
  options: Omit<InbodyReportRenderOptions, 'customerName'> = {},
): Promise<'shared' | 'downloaded'> {
  const canvas = await renderReportCanvas(measurement, { ...options, customerName });
  const filename = inbodyReportFilename(measurement, customerName);
  const blob = await canvasToBlob(canvas);
  const file = new File([blob], filename, { type: 'image/jpeg' });

  if (canShareInbodyFile(file)) {
    try {
      await navigator.share({
        files: [file],
        title: `Informe InBody ${customerName || ''}`.trim(),
        text: `Composición corporal InBody (${measurement.measured_at.slice(0, 10)})`,
      });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') throw err;
      if (!isShareUnsupportedError(err)) {
        console.warn('[inbody] navigator.share falló, usando descarga:', err);
      }
    }
  }

  triggerBlobDownload(blob, filename);
  return 'downloaded';
}
