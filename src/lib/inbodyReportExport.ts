import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  inbodyBarScale,
  inbodyRangeStatus,
  inbodyStatusLabel,
  normalizeInbodyMeasurement,
  resolveInbodySex,
  type InbodyMeasurement,
  type InbodySegmentEntry,
} from '@/lib/inbodyMeasurements';

export const INBODY_REPORT_TEMPLATE_URL = '/inbody/inbody-report-template.png';

/** Plantilla oficial 836×1024 px. Coordenadas en píxeles de referencia. */
const REF_W = 836;
const REF_H = 1024;
const FONT = 'Arial, Helvetica, sans-serif';
const EXERCISE_DURATION_MIN = 30;
/** Coeficiente Lookin'Body (ajustado a valores del software). */
const EXERCISE_KCAL_COEFF = 0.0084;

/** Ajustes finos de alineación (píxeles en plantilla 836×1024). */
const LAYOUT_OFFSET = {
  composition: { dx: 100, dy: 0 },
  diagnosis: { dx: -50, dy: 70 },
  exercise: { dx: 50, dy: -200 },
} as const;

/** MET por icono del planificador (orden filas × columnas en plantilla). */
const EXERCISE_METS: number[][] = [
  [4.8, 3.5, 3.0, 2.5, 4.5, 4.0, 7.0],
  [7.0, 6.5, 10.0, 9.0, 7.0, 6.8, 8.0],
];

function fmt(value: number | null | undefined, decimals = 1, suffix = ''): string {
  if (value == null || Number.isNaN(value)) return '';
  return `${value.toFixed(decimals).replace('.', ',')}${suffix}`;
}

function fmtRange(min: number | null | undefined, max: number | null | undefined, decimals = 1): string {
  if (min == null || max == null) return '';
  return `${min.toFixed(decimals).replace('.', ',')} ~ ${max.toFixed(decimals).replace('.', ',')}`;
}

function px(w: number, h: number, x: number, y: number): { x: number; y: number } {
  return { x: (x / REF_W) * w, y: (y / REF_H) * h };
}

function pxOff(
  w: number,
  h: number,
  x: number,
  y: number,
  offset: { dx: number; dy: number },
): { x: number; y: number } {
  return px(w, h, x + offset.dx, y + offset.dy);
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: { size?: number; align?: CanvasTextAlign; bold?: boolean; color?: string } = {},
) {
  if (!text) return;
  const { size = 11, align = 'left', bold = false, color = '#1a1a1a' } = opts;
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${bold ? '700' : '400'} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawRangeBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  value: number | null | undefined,
  min: number | null | undefined,
  max: number | null | undefined,
) {
  ctx.save();
  ctx.fillStyle = '#eef2f0';
  ctx.fillRect(x, y, width, height);
  ctx.strokeStyle = '#c5d0cb';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);

  if (value != null && min != null && max != null) {
    const scale = inbodyBarScale(value, min, max);
    const normalX = x + (scale.normalStartPct / 100) * width;
    const normalW = ((scale.normalEndPct - scale.normalStartPct) / 100) * width;
    ctx.fillStyle = '#d4ead8';
    ctx.fillRect(normalX, y + 1, normalW, height - 2);

    const markerX = x + (scale.markerPct / 100) * width;
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(markerX, y);
    ctx.lineTo(markerX, y + height);
    ctx.stroke();
  }
  ctx.restore();
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

function drawHeader(ctx: CanvasRenderingContext2D, w: number, h: number, m: InbodyMeasurement) {
  const dateStr = format(new Date(m.measured_at), 'yyyy.MM.dd h:mm:ss a', { locale: es });
  const idPos = px(w, h, 118, 88);
  drawText(ctx, m.inbody_user_id, idPos.x, idPos.y, { size: 10, bold: true });
  const datePos = px(w, h, 620, 88);
  drawText(ctx, dateStr, datePos.x, datePos.y, { size: 9, align: 'left' });
  if (m.height_cm != null) {
    const p = px(w, h, 118, 102);
    drawText(ctx, fmt(m.height_cm, 1), p.x, p.y, { size: 10, bold: true });
  }
  if (m.age_years != null) {
    const p = px(w, h, 248, 102);
    drawText(ctx, fmt(m.age_years, 0), p.x, p.y, { size: 10, bold: true });
  }
  const sex = resolveInbodySex(m.sex);
  if (sex) {
    const p = px(w, h, 318, 102);
    drawText(ctx, sex === 'female' ? 'F' : 'M', p.x, p.y, { size: 10, bold: true });
  }
}

function drawComposition(ctx: CanvasRenderingContext2D, w: number, h: number, m: InbodyMeasurement) {
  const off = LAYOUT_OFFSET.composition;
  const barX = pxOff(w, h, 58, 0, off).x;
  const barW = pxOff(w, h, 310, 0, off).x - barX;
  const barH = px(w, h, 0, 14).y;

  const rows = [
    { y: 113, value: m.weight_kg, min: m.weight_min_kg, max: m.weight_max_kg },
    { y: 138, value: m.smm_kg, min: m.smm_min_kg, max: m.smm_max_kg },
    { y: 163, value: m.body_fat_kg, min: m.body_fat_min_kg, max: m.body_fat_max_kg },
  ];

  for (const row of rows) {
    const { y: yPx } = px(w, h, 0, row.y);
    drawRangeBar(ctx, barX, yPx - barH / 2, barW, barH, row.value, row.min, row.max);
    const valPos = pxOff(w, h, 418, row.y, off);
    drawText(ctx, fmt(row.value, 1), valPos.x, valPos.y, { size: 11, align: 'right', bold: true });
    const rangePos = pxOff(w, h, 520, row.y, off);
    drawText(ctx, fmtRange(row.min, row.max), rangePos.x, rangePos.y, { size: 10 });
    const status = inbodyStatusLabel(inbodyRangeStatus(row.value, row.min, row.max));
    if (status !== '—') {
      const stPos = pxOff(w, h, 680, row.y, off);
      drawText(ctx, status, stPos.x, stPos.y, { size: 9, color: '#374151' });
    }
  }

  const tbwPos = pxOff(w, h, 140, 188, off);
  drawText(ctx, fmt(m.tbw_kg, 1), tbwPos.x, tbwPos.y, { size: 11, bold: true });
  const tbwR = pxOff(w, h, 280, 188, off);
  drawText(ctx, fmtRange(m.tbw_min_kg, m.tbw_max_kg), tbwR.x, tbwR.y, { size: 10 });
  const ffmPos = pxOff(w, h, 140, 208, off);
  drawText(ctx, fmt(m.ffm_kg, 1), ffmPos.x, ffmPos.y, { size: 11, bold: true });
  const ffmR = pxOff(w, h, 280, 208, off);
  drawText(ctx, fmtRange(m.ffm_min_kg, m.ffm_max_kg), ffmR.x, ffmR.y, { size: 10 });
}

function drawDiagnosis(ctx: CanvasRenderingContext2D, w: number, h: number, m: InbodyMeasurement) {
  const off = LAYOUT_OFFSET.diagnosis;
  const rows = [
    { y: 268, value: fmt(m.bmi, 1), range: fmtRange(m.bmi_min, m.bmi_max) },
    { y: 293, value: fmt(m.pbf_pct, 1, '%'), range: fmtRange(m.pbf_min_pct, m.pbf_max_pct, 1) },
    { y: 318, value: fmt(m.whr, 2), range: fmtRange(m.whr_min, m.whr_max, 2) },
    { y: 343, value: fmt(m.bmr_kcal, 0), range: fmtRange(m.bmr_min_kcal, m.bmr_max_kcal, 0) },
  ];
  for (const row of rows) {
    const valPos = pxOff(w, h, 230, row.y, off);
    drawText(ctx, row.value, valPos.x, valPos.y, { size: 11, align: 'center', bold: true });
    const rangePos = pxOff(w, h, 400, row.y, off);
    drawText(ctx, row.range, rangePos.x, rangePos.y, { size: 10, align: 'center' });
  }
  const mcPos = pxOff(w, h, 230, 375, off);
  drawText(ctx, fmt(m.muscle_control_kg, 1), mcPos.x, mcPos.y, { size: 12, align: 'center', bold: true });
  const fcPos = pxOff(w, h, 520, 375, off);
  drawText(ctx, fmt(m.fat_control_kg, 1), fcPos.x, fcPos.y, { size: 12, align: 'center', bold: true });
}

function drawSegmentBlock(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  lean: InbodyMeasurement['segmental_lean'],
  fat: InbodyMeasurement['segmental_fat'],
) {
  type Slot = { x: number; yLean: number; yFat: number; leanKey: keyof typeof lean; fatKey: keyof typeof fat };
  const slots: Slot[] = [
    { x: 548, yLean: 418, yFat: 438, leanKey: 'left_arm', fatKey: 'left_arm' },
    { x: 718, yLean: 418, yFat: 438, leanKey: 'right_arm', fatKey: 'right_arm' },
    { x: 633, yLean: 448, yFat: 468, leanKey: 'trunk', fatKey: 'trunk' },
    { x: 548, yLean: 498, yFat: 518, leanKey: 'left_leg', fatKey: 'left_leg' },
    { x: 718, yLean: 498, yFat: 518, leanKey: 'right_leg', fatKey: 'right_leg' },
  ];

  for (const slot of slots) {
    const leanEntry = lean?.[slot.leanKey];
    const fatEntry = fat?.[slot.fatKey];
    const { x: lx, y: lyLean } = px(w, h, slot.x, slot.yLean);
    const { y: lyFat } = px(w, h, 0, slot.yFat);

    drawText(ctx, fmt(leanEntry?.kg, 1), lx, lyLean, { size: 10, align: 'center', bold: true });
    drawText(ctx, evalCodeLabel(evalFromEntry(leanEntry)), lx, lyLean + 12, { size: 9, align: 'center' });

    const fatLine = [fmt(fatEntry?.pct, 1, '%'), fmt(fatEntry?.kg, 1)].filter(Boolean).join(' · ');
    if (fatLine) drawText(ctx, fatLine, lx, lyFat, { size: 9, align: 'center', bold: true });
  }
}

function drawImpedance(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  impedance: InbodyMeasurement['impedance'],
) {
  const freqs = [
    { key: '20khz' as const, y: 598 },
    { key: '100khz' as const, y: 618 },
  ];
  const cols = [
    { key: 'right_arm' as const, x: 528 },
    { key: 'left_arm' as const, x: 578 },
    { key: 'trunk' as const, x: 628 },
    { key: 'right_leg' as const, x: 678 },
    { key: 'left_leg' as const, x: 728 },
  ];

  for (const freq of freqs) {
    const block = impedance?.[freq.key];
    if (!block) continue;
    for (const col of cols) {
      const val = block[col.key];
      const p = px(w, h, col.x, freq.y);
      drawText(ctx, fmt(val, 1), p.x, p.y, { size: 9, align: 'center' });
    }
  }
}

function drawExercisePlanner(ctx: CanvasRenderingContext2D, w: number, h: number, m: InbodyMeasurement) {
  const weight = m.weight_kg;
  if (weight == null) return;

  const off = LAYOUT_OFFSET.exercise;
  const weightPos = pxOff(w, h, 118, 862, off);
  drawText(ctx, fmt(weight, 1, 'kg'), weightPos.x, weightPos.y, { size: 10, bold: true });
  const durPos = pxOff(w, h, 268, 862, off);
  drawText(ctx, String(EXERCISE_DURATION_MIN), durPos.x, durPos.y, { size: 10, bold: true, align: 'center' });

  const startX = 52 + off.dx;
  const startY = 888 + off.dy;
  const colStep = 108;
  const rowStep = 28;

  EXERCISE_METS.forEach((row, rowIdx) => {
    row.forEach((met, colIdx) => {
      if (met <= 0) return;
      const kcal = exerciseKcal(weight, met);
      const p = px(w, h, startX + colIdx * colStep, startY + rowIdx * rowStep);
      drawText(ctx, String(kcal), p.x, p.y, { size: 9, align: 'center', bold: true });
    });
  });

  const recommended = recommendedDailyKcal(m.bmr_kcal);
  if (recommended != null) {
    const p = pxOff(w, h, 718, 982, off);
    drawText(ctx, String(recommended), p.x, p.y, { size: 11, align: 'center', bold: true });
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

export function renderInbodyReportCanvas(
  template: HTMLImageElement,
  measurement: InbodyMeasurement,
): HTMLCanvasElement {
  const m = normalizeInbodyMeasurement(measurement);
  const canvas = document.createElement('canvas');
  canvas.width = template.naturalWidth;
  canvas.height = template.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');

  const w = canvas.width;
  const h = canvas.height;

  ctx.drawImage(template, 0, 0, w, h);
  drawHeader(ctx, w, h, m);
  drawComposition(ctx, w, h, m);
  drawDiagnosis(ctx, w, h, m);
  drawSegmentBlock(ctx, w, h, m.segmental_lean, m.segmental_fat);
  drawImpedance(ctx, w, h, m.impedance);
  drawExercisePlanner(ctx, w, h, m);

  return canvas;
}

export async function buildInbodyReportBlob(
  measurement: InbodyMeasurement,
  mime: 'image/jpeg' | 'image/png' = 'image/jpeg',
  quality = 0.92,
): Promise<Blob> {
  const template = await loadInbodyReportTemplate();
  const canvas = renderInbodyReportCanvas(template, measurement);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('No se pudo generar la imagen'))),
      mime,
      quality,
    );
  });
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
): Promise<void> {
  const blob = await buildInbodyReportBlob(measurement);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = inbodyReportFilename(measurement, customerName);
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function shareInbodyReport(
  measurement: InbodyMeasurement,
  customerName?: string,
): Promise<'shared' | 'downloaded'> {
  const blob = await buildInbodyReportBlob(measurement);
  const filename = inbodyReportFilename(measurement, customerName);
  const file = new File([blob], filename, { type: 'image/jpeg' });

  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: `Informe InBody ${customerName || ''}`.trim(),
      text: `Composición corporal InBody (${measurement.measured_at.slice(0, 10)})`,
    });
    return 'shared';
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return 'downloaded';
}
