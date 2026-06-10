import {
  inbodyBarScale,
  inbodyRangeStatus,
  inbodyStatusLabel,
  type InbodyMeasurement,
  type InbodySegmentEntry,
} from '@/lib/inbodyMeasurements';

export const INBODY_REPORT_TEMPLATE_URL = '/inbody/inbody-report-template.png';

const FONT = 'Arial, Helvetica, sans-serif';

function fmt(value: number | null | undefined, decimals = 1, suffix = ''): string {
  if (value == null || Number.isNaN(value)) return '';
  return `${value.toFixed(decimals)}${suffix}`;
}

function fmtRange(min: number | null | undefined, max: number | null | undefined, decimals = 1): string {
  if (min == null || max == null) return '';
  return `${min.toFixed(decimals)} ~ ${max.toFixed(decimals)}`;
}

/** Códigos Lookin'Body: 0 bajo, 1 normal, 2 alto. */
function evalCodeLabel(code: number | null | undefined): string {
  if (code == null || Number.isNaN(code)) return '';
  if (code <= 0) return 'Bajo';
  if (code >= 2) return 'Alto';
  return 'Normal';
}

function evalFromEntry(entry?: InbodySegmentEntry): number | null {
  const pct = entry?.eval_pct ?? entry?.pct;
  return pct == null || Number.isNaN(pct) ? null : pct;
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

function drawSegmentBlock(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  lean: InbodyMeasurement['segmental_lean'],
  fat: InbodyMeasurement['segmental_fat'],
) {
  type Slot = { xPct: number; yPct: number; leanKey: keyof typeof lean; fatKey: keyof typeof fat };
  const slots: Slot[] = [
    { xPct: 0.72, yPct: 0.118, leanKey: 'left_arm', fatKey: 'left_arm' },
    { xPct: 0.88, yPct: 0.118, leanKey: 'right_arm', fatKey: 'right_arm' },
    { xPct: 0.8, yPct: 0.145, leanKey: 'trunk', fatKey: 'trunk' },
    { xPct: 0.72, yPct: 0.178, leanKey: 'left_leg', fatKey: 'left_leg' },
    { xPct: 0.88, yPct: 0.178, leanKey: 'right_leg', fatKey: 'right_leg' },
  ];

  for (const slot of slots) {
    const lx = w * slot.xPct;
    const lyLean = h * slot.yPct;
    const lyFat = h * (slot.yPct + 0.055);
    const leanEntry = lean?.[slot.leanKey];
    const fatEntry = fat?.[slot.fatKey];

    drawText(ctx, fmt(leanEntry?.kg, 1), lx, lyLean, { size: 10, align: 'center', bold: true });
    drawText(ctx, evalCodeLabel(evalFromEntry(leanEntry)), lx, lyLean + 12, { size: 9, align: 'center' });

    const fatPct = fatEntry?.pct;
    const fatKg = fatEntry?.kg;
    if (fatPct != null || fatKg != null) {
      drawText(
        ctx,
        `${fmt(fatPct, 1, '%')}${fatKg != null ? ` · ${fmt(fatKg, 1, ' kg')}` : ''}`,
        lx,
        lyFat,
        { size: 9, align: 'center', bold: true },
      );
    }
  }
}

function drawImpedance(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  impedance: InbodyMeasurement['impedance'],
) {
  const freqs = [
    { key: '20khz' as const, yPct: 0.358 },
    { key: '100khz' as const, yPct: 0.372 },
  ];
  const cols = [
    { key: 'right_arm' as const, xPct: 0.695 },
    { key: 'left_arm' as const, xPct: 0.735 },
    { key: 'trunk' as const, xPct: 0.775 },
    { key: 'right_leg' as const, xPct: 0.815 },
    { key: 'left_leg' as const, xPct: 0.855 },
  ];

  for (const freq of freqs) {
    const block = impedance?.[freq.key];
    if (!block) continue;
    for (const col of cols) {
      const val = block[col.key];
      drawText(ctx, fmt(val, 1), w * col.xPct, h * freq.yPct, { size: 9, align: 'center' });
    }
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
  const canvas = document.createElement('canvas');
  canvas.width = template.naturalWidth;
  canvas.height = template.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas no disponible');

  const w = canvas.width;
  const h = canvas.height;

  ctx.drawImage(template, 0, 0, w, h);

  const barX = w * 0.085;
  const barW = w * 0.42;
  const barH = h * 0.014;
  const barRows = [
    { yPct: 0.118, value: measurement.weight_kg, min: measurement.weight_min_kg, max: measurement.weight_max_kg },
    { yPct: 0.143, value: measurement.smm_kg, min: measurement.smm_min_kg, max: measurement.smm_max_kg },
    { yPct: 0.168, value: measurement.body_fat_kg, min: measurement.body_fat_min_kg, max: measurement.body_fat_max_kg },
  ];

  for (const row of barRows) {
    const y = h * row.yPct;
    drawRangeBar(ctx, barX, y - barH / 2, barW, barH, row.value, row.min, row.max);
    drawText(ctx, fmt(row.value, 1, ' kg'), w * 0.535, y, { size: 11, align: 'right', bold: true });
    drawText(ctx, fmtRange(row.min, row.max), w * 0.68, y, { size: 10, align: 'left' });
    const status = inbodyStatusLabel(inbodyRangeStatus(row.value, row.min, row.max));
    if (status !== '—') {
      drawText(ctx, status, w * 0.78, y, { size: 9, align: 'left', color: '#374151' });
    }
  }

  drawText(ctx, fmt(measurement.tbw_kg, 1, ' kg'), w * 0.14, h * 0.198, { size: 11, bold: true });
  drawText(ctx, fmtRange(measurement.tbw_min_kg, measurement.tbw_max_kg), w * 0.28, h * 0.198, { size: 10 });
  drawText(ctx, fmt(measurement.ffm_kg, 1, ' kg'), w * 0.14, h * 0.218, { size: 11, bold: true });
  drawText(ctx, fmtRange(measurement.ffm_min_kg, measurement.ffm_max_kg), w * 0.28, h * 0.218, { size: 10 });

  const diagRows = [
    { yPct: 0.262, value: fmt(measurement.bmi, 1), range: fmtRange(measurement.bmi_min, measurement.bmi_max) },
    { yPct: 0.282, value: fmt(measurement.pbf_pct, 1, '%'), range: fmtRange(measurement.pbf_min_pct, measurement.pbf_max_pct, 1) },
    { yPct: 0.302, value: fmt(measurement.whr, 2), range: fmtRange(measurement.whr_min, measurement.whr_max, 2) },
    { yPct: 0.322, value: fmt(measurement.bmr_kcal, 0), range: fmtRange(measurement.bmr_min_kcal, measurement.bmr_max_kcal, 0) },
  ];
  for (const row of diagRows) {
    drawText(ctx, row.value, w * 0.22, h * row.yPct, { size: 11, align: 'center', bold: true });
    drawText(ctx, row.range, w * 0.42, h * row.yPct, { size: 10, align: 'center' });
  }

  drawText(ctx, fmt(measurement.muscle_control_kg, 1, ' kg'), w * 0.22, h * 0.352, { size: 12, align: 'center', bold: true });
  drawText(ctx, fmt(measurement.fat_control_kg, 1, ' kg'), w * 0.52, h * 0.352, { size: 12, align: 'center', bold: true });

  drawSegmentBlock(ctx, w, h, measurement.segmental_lean, measurement.segmental_fat);
  drawImpedance(ctx, w, h, measurement.impedance);

  if (measurement.weight_kg != null) {
    drawText(
      ctx,
      `${fmt(measurement.weight_kg, 1, 'kg')}`,
      w * 0.72,
      h * 0.905,
      { size: 10, align: 'left', bold: true },
    );
  }

  const recommendedKcal = measurement.bmr_kcal != null
    ? Math.round(measurement.bmr_kcal * 0.9)
    : null;
  if (recommendedKcal != null) {
    drawText(ctx, String(recommendedKcal), w * 0.88, h * 0.965, { size: 11, align: 'center', bold: true });
  }

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
