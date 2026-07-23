/**
 * Export JPG MorphoScan — plantilla Renpho en blanco (740×1024).
 * Calibrado sobre public/morphoscan/morphoscan-report-template.png
 */

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import type { InbodyMeasurement } from '@/lib/inbodyMeasurements';
import { inbodySexLabel } from '@/lib/inbodyMeasurements';
import {
  buildMorphoScanReport,
  morphoEvalLabel,
  type MorphoScanDerivedReport,
} from '@/lib/morphoscanReport';
import { enrichMorphoScanSegmentals } from '@/lib/morphoscanSegmentals';

/** Cambiar al subir plantilla nueva para invalidar caché. */
export const MORPHOSCAN_REPORT_TEMPLATE_VERSION = '20260723i';
export const MORPHOSCAN_REPORT_TEMPLATE_URL = `/morphoscan/morphoscan-report-template.png?v=${MORPHOSCAN_REPORT_TEMPLATE_VERSION}`;

export const MORPHOSCAN_REPORT_TEMPLATE_READY = true;

const REF_W = 740;
const REF_H = 1024;
const FONT = 'Arial, Helvetica, sans-serif';
const FONT_SCALE = 1;
const fs = (base: number) => Math.round(base * FONT_SCALE);
/** Azul de barras Renpho (informe oficial). */
const RENPHO_BAR_BLUE = '#4B7BFF';
const RENPHO_SCORE_BLUE = '#6B9BFF';
/** Altura aproximada de una línea de texto en bloques laterales. */
const LINE = 20;

type RefRect = { x1: number; y1: number; x2: number; y2: number };
type SegmentKey = 'right_arm' | 'left_arm' | 'trunk' | 'right_leg' | 'left_leg';

/** Logo empresa — esquina superior izquierda. */
const LOGO: RefRect = { x1: 16, y1: 6, x2: 150, y2: 52 };

/**
 * Cabecera: se tapa «Identificación:» de la plantilla.
 * Nombre + sexo/edad/altura/fecha una línea más abajo; sexo/edad/altura −20 px X.
 */
const PATIENT = {
  clearId: { x1: 28, y1: 64, x2: 720, y2: 100 } as RefRect,
  name: { x: 34, y: 74 + LINE },
  sex: { x: 278 - 20, y: 74 + LINE },
  age: { x: 395 - 20, y: 74 + LINE },
  height: { x: 505 - 20, y: 74 + LINE },
  date: { x: 638 - 20, y: 74 + LINE },
} as const;

/** Filas composición (centros Y) + columnas Medida / Rango / Evaluación. */
const COMPOSITION_ROW_Y = [174, 198, 223, 247, 272, 296, 320] as const;
const COMPOSITION_COL = {
  measure: { x1: 155, x2: 245 },
  range: { x1: 250, x2: 335 },
  eval: { x1: 345, x2: 422 },
} as const;

/** Barras músculo/grasa: pista 155→419; valor = % del estándar Renpho. */
const MUSCLE_FAT_BAR = { x1: 155, x2: 419 };
const MUSCLE_FAT_ROWS = [
  { y: 412, scaleMin: 55, scaleMax: 205 },
  { y: 441, scaleMin: 70, scaleMax: 170 },
  { y: 472, scaleMin: 40, scaleMax: 520 },
] as const;

/** Obesidad: IMC y % grasa en escala absoluta. */
const OBESITY_BAR = { x1: 155, x2: 419 };
const OBESITY_ROWS = [
  { y: 561, scaleMin: 10, scaleMax: 55 },
  { y: 590, scaleMin: 8, scaleMax: 58 },
] as const;

const SCORE = { x: 517, y: 158 };

/** Objetivos: una línea más abajo. */
const GOALS = {
  valueX: 708,
  rows: [257 + LINE, 279 + LINE, 298 + LINE, 318 + LINE] as const,
};

/** Evaluación de obesidad: IMC, % grasa, evaluación. */
const OBESITY_EVAL = {
  valueX: 520 + 200 - 40 - 10,
  rows: (() => {
    const imc = 339 + 2 * LINE + 25 - 8;
    const evalY = 449 + 150 - 40 - 40 - 5;
    const pbf = Math.round((imc + (449 + 150 - 40 - 40)) / 2) - 10;
    return [imc, pbf, evalY] as const;
  })(),
};

/**
 * Gráfico tipo corporal — calibrado con la zona estándar de la plantilla:
 * IMC 18,5–25 × % grasa 18–28 → rectángulo (655,642)–(549,758)
 * = (x_der, y_sup, x_izq, y_inf).
 */
const BODY_TYPE_CHART = {
  x1: 549, // % grasa 18
  y1: 642, // IMC 25 (arriba)
  x2: 655, // % grasa 28
  y2: 758, // IMC 18,5 (abajo)
  pbfMin: 18,
  pbfMax: 28,
  bmiMin: 18.5,
  bmiMax: 25,
} as const;

const SEGMENT_FAT: Record<SegmentKey, { x: number; y: number }> = {
  left_arm: { x: 55, y: 655 },
  right_arm: { x: 185, y: 655 },
  /** Misma columna X que brazo/pierna izquierda. */
  trunk: { x: 55, y: 732 },
  left_leg: { x: 55, y: 805 },
  right_leg: { x: 185, y: 805 },
};

const SEGMENT_LEAN: Record<SegmentKey, { x: number; y: number }> = {
  left_arm: { x: 275, y: 655 },
  right_arm: { x: 405, y: 655 },
  trunk: { x: 275, y: 732 },
  left_leg: { x: 275, y: 805 },
  right_leg: { x: 405, y: 805 },
};

const SEGMENT_KEYS: SegmentKey[] = ['right_arm', 'left_arm', 'trunk', 'right_leg', 'left_leg'];

const IMPEDANCE = {
  rowY: [942 + 10, 966 + 10] as const,
  colX: [127, 193, 260, 327, 393] as const,
  cols: ['right_arm', 'left_arm', 'trunk', 'right_leg', 'left_leg'] as const,
};

/**
 * Otros indicadores — visceral bajada 7 px; el resto reparte el tramo hasta WHR.
 * Orden: visceral, BMR, FFM, subcutánea, SMI, edad metabólica, WHR.
 */
const OTHER = {
  valueX: 708,
  rows: (() => {
    const first = 861 + 7; // visceral
    const last = 986; // WHR
    const n = 7;
    const step = (last - first) / (n - 1);
    return Array.from({ length: n }, (_, i) => Math.round(first + i * step)) as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
  })(),
};

/** Leyenda bajo cada silueta segmental (masa / % vs estándar / estándar). */
const SEGMENT_LEGEND = {
  fat: { x: 120, y: 848 },
  lean: { x: 340, y: 848 },
  lineH: 11,
} as const;

export function morphoscanReportSessionKey(m: InbodyMeasurement): string {
  return `${m.id}-${MORPHOSCAN_REPORT_TEMPLATE_VERSION}`;
}

export function isMorphoScanReportTemplateReady(): boolean {
  return MORPHOSCAN_REPORT_TEMPLATE_READY;
}

export async function loadMorphoScanReportTemplate(_sessionKey?: string): Promise<HTMLImageElement> {
  if (!MORPHOSCAN_REPORT_TEMPLATE_READY) {
    throw new Error(
      'Plantilla MorphoScan pendiente. Sube el JPG/PNG en blanco a public/morphoscan/ y activa MORPHOSCAN_REPORT_TEMPLATE_READY.',
    );
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la plantilla MorphoScan'));
    img.src = MORPHOSCAN_REPORT_TEMPLATE_URL;
  });
}

export interface MorphoScanReportRenderOptions {
  customerName?: string;
  logo?: HTMLImageElement | null;
  logoUrl?: string | null;
}

function ensureHttpsAssetUrl(url: string): string {
  return url.startsWith('http://') ? url.replace(/^http:\/\//i, 'https://') : url;
}

export async function loadMorphoScanReportLogo(url?: string | null): Promise<HTMLImageElement | null> {
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

function fillRectRef(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  rect: RefRect,
  color: string,
) {
  const r = scaledRect(w, h, rect);
  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
}

function drawLogo(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  logo: HTMLImageElement | null | undefined,
) {
  const r = scaledRect(w, h, LOGO);
  // Fondo blanco por si la plantilla tiene marca Renpho residual
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.restore();
  if (logo?.naturalWidth) {
    const pad = Math.max(2, r.w * 0.04);
    const maxW = r.w - pad * 2;
    const maxH = r.h - pad * 2;
    const scale = Math.min(maxW / logo.naturalWidth, maxH / logo.naturalHeight);
    const drawW = logo.naturalWidth * scale;
    const drawH = logo.naturalHeight * scale;
    ctx.drawImage(logo, r.cx - drawW / 2, r.cy - drawH / 2, drawW, drawH);
    return;
  }
  drawText(ctx, 'Lipoout', r.cx, r.cy, {
    size: fs(14),
    bold: true,
    align: 'center',
    color: '#0f766e',
  });
}

function fmt(value: number | null | undefined, decimals = 1, suffix = ''): string {
  if (value == null || Number.isNaN(value)) return '';
  return `${value.toFixed(decimals).replace('.', ',')}${suffix}`;
}

function fmtRange(min: number | null | undefined, max: number | null | undefined, decimals = 1): string {
  if (min == null || max == null) return '';
  return `${min.toFixed(decimals).replace('.', ',')}-${max.toFixed(decimals).replace('.', ',')}`;
}

function fmtSigned(value: number | null | undefined, decimals = 1, suffix = ''): string {
  if (value == null || Number.isNaN(value)) return '';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals).replace('.', ',')}${suffix}`;
}

function clamp(n: number, a: number, b: number): number {
  return Math.min(b, Math.max(a, n));
}

function px(w: number, h: number, x: number, y: number): { x: number; y: number } {
  return { x: (x / REF_W) * w, y: (y / REF_H) * h };
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

function drawAt(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  xRef: number,
  yRef: number,
  text: string,
  opts?: Parameters<typeof drawText>[4],
) {
  const p = px(w, h, xRef, yRef);
  drawText(ctx, text, p.x, p.y, opts);
}

function drawInCol(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  col: RefRect,
  yRef: number,
  text: string,
  opts?: Parameters<typeof drawText>[4],
) {
  const left = px(w, h, col.x1, yRef);
  const right = px(w, h, col.x2, yRef);
  drawText(ctx, text, (left.x + right.x) / 2, left.y, { align: 'center', ...opts });
}

/** Barra rellena estilo Renpho + valor al final. */
function drawRenphoBar(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bar: { x1: number; x2: number },
  yRef: number,
  scaleValue: number | null,
  scaleMin: number,
  scaleMax: number,
  label: string,
) {
  if (scaleValue == null) return;
  const t = clamp((scaleValue - scaleMin) / (scaleMax - scaleMin), 0, 1);
  const left = px(w, h, bar.x1, yRef);
  const right = px(w, h, bar.x2, yRef);
  const tipX = left.x + t * (right.x - left.x);
  const barH = Math.max(5, px(w, h, 0, 7).y);
  ctx.save();
  ctx.fillStyle = RENPHO_BAR_BLUE;
  ctx.fillRect(left.x, left.y - barH / 2, Math.max(2, tipX - left.x), barH);
  ctx.restore();
  drawText(ctx, label, tipX + px(w, h, 4, 0).x, left.y, {
    size: fs(9),
    bold: true,
    color: RENPHO_BAR_BLUE,
    align: 'left',
  });
}

/** Valor como % del punto medio del rango estándar (escala Renpho músculo/grasa). */
function pctOfStandard(value: number | null, stdMin: number | null, stdMax: number | null): number | null {
  if (value == null || stdMin == null || stdMax == null) return null;
  const mid = (stdMin + stdMax) / 2;
  if (mid <= 0) return null;
  return (value / mid) * 100;
}

/** Índice de evaluación de obesidad Renpho-like (~85 = estándar). */
function obesityEvalIndex(bmi: number | null, pbf: number | null): number | null {
  if (bmi == null && pbf == null) return null;
  let score = 100;
  if (bmi != null) {
    if (bmi < 18.5) score -= (18.5 - bmi) * 8;
    else if (bmi > 25) score -= (bmi - 25) * 5;
  }
  if (pbf != null) {
    if (pbf < 18) score -= (18 - pbf) * 1.5;
    else if (pbf > 28) score -= (pbf - 28) * 1.5;
  }
  return Math.max(40, Math.min(100, Math.round(score)));
}

function sexShort(sex: string | null | undefined): string {
  const label = inbodySexLabel(sex);
  if (!label || label === '—') return '';
  if (/^f/i.test(String(sex)) || /mujer|female/i.test(label)) return 'Mujer';
  if (/^m/i.test(String(sex)) || /hombre|male/i.test(label)) return 'Hombre';
  return label;
}

function drawPatient(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  m: InbodyMeasurement,
  customerName?: string,
) {
  // Quitar «Identificación:» de la plantilla y poner el nombre de la clienta
  fillRectRef(ctx, w, h, PATIENT.clearId, '#f6f7fc');
  const name = (customerName || m.inbody_user_id || '').trim().slice(0, 36);
  const when = format(new Date(m.measured_at), "d MMM yyyy, HH:mm:ss", { locale: es });
  const opts = { size: fs(12), bold: true as const };
  drawAt(ctx, w, h, PATIENT.name.x, PATIENT.name.y, name, opts);
  drawAt(ctx, w, h, PATIENT.sex.x, PATIENT.sex.y, sexShort(m.sex), opts);
  drawAt(ctx, w, h, PATIENT.age.x, PATIENT.age.y, m.age_years != null ? `${m.age_years} años` : '', opts);
  drawAt(
    ctx,
    w,
    h,
    PATIENT.height.x,
    PATIENT.height.y,
    m.height_cm != null ? `${Number(m.height_cm).toFixed(1).replace('.', ',')}cm` : '',
    opts,
  );
  drawAt(ctx, w, h, PATIENT.date.x, PATIENT.date.y, when, opts);
}

function drawCompositionTable(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  report: MorphoScanDerivedReport,
) {
  report.compositionRows.forEach((row, i) => {
    const y = COMPOSITION_ROW_Y[i];
    if (y == null) return;
    drawInCol(ctx, w, h, COMPOSITION_COL.measure, y, fmt(row.value, row.decimals ?? 1), {
      size: fs(11),
      bold: true,
    });
    drawInCol(ctx, w, h, COMPOSITION_COL.range, y, fmtRange(row.rangeMin, row.rangeMax, row.decimals ?? 1), {
      size: fs(9),
    });
    const ev = morphoEvalLabel(row.eval);
    if (ev !== '—') {
      drawInCol(ctx, w, h, COMPOSITION_COL.eval, y, ev, { size: fs(10), bold: true });
    }
  });
}

function drawMuscleFatBars(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  report: MorphoScanDerivedReport,
) {
  const weightRow = report.compositionRows.find((r) => r.id === 'weight_kg');
  const smmRow = report.compositionRows.find((r) => r.id === 'smm_kg');
  const fatRow = report.compositionRows.find((r) => r.id === 'body_fat_kg');

  const items = [
    {
      row: MUSCLE_FAT_ROWS[0],
      pct: pctOfStandard(report.weight_kg, weightRow?.rangeMin ?? null, weightRow?.rangeMax ?? null),
      label: fmt(report.weight_kg, 2),
    },
    {
      row: MUSCLE_FAT_ROWS[1],
      pct: pctOfStandard(report.smm_kg, smmRow?.rangeMin ?? null, smmRow?.rangeMax ?? null),
      label: fmt(report.smm_kg, 2),
    },
    {
      row: MUSCLE_FAT_ROWS[2],
      pct: pctOfStandard(report.body_fat_kg, fatRow?.rangeMin ?? null, fatRow?.rangeMax ?? null),
      label: fmt(report.body_fat_kg, 2),
    },
  ];

  for (const item of items) {
    drawRenphoBar(
      ctx,
      w,
      h,
      MUSCLE_FAT_BAR,
      item.row.y,
      item.pct,
      item.row.scaleMin,
      item.row.scaleMax,
      item.label,
    );
  }
}

function drawObesityBars(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  report: MorphoScanDerivedReport,
) {
  drawRenphoBar(
    ctx,
    w,
    h,
    OBESITY_BAR,
    OBESITY_ROWS[0].y,
    report.bmi,
    OBESITY_ROWS[0].scaleMin,
    OBESITY_ROWS[0].scaleMax,
    fmt(report.bmi, 1),
  );
  drawRenphoBar(
    ctx,
    w,
    h,
    OBESITY_BAR,
    OBESITY_ROWS[1].y,
    report.pbf_pct,
    OBESITY_ROWS[1].scaleMin,
    OBESITY_ROWS[1].scaleMax,
    fmt(report.pbf_pct, 1),
  );
}

function drawScoreGoalsObesityEval(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  report: MorphoScanDerivedReport,
) {
  if (report.body_score != null) {
    drawAt(ctx, w, h, SCORE.x, SCORE.y, String(report.body_score), {
      size: fs(32),
      bold: true,
      align: 'right',
      color: RENPHO_SCORE_BLUE,
    });
  }

  const goalVals = [
    fmt(report.target_weight_kg, 2, ' kg'),
    fmtSigned(report.weight_control_kg, 2, ' kg'),
    fmtSigned(report.fat_control_kg, 2, ' kg'),
    fmtSigned(report.muscle_control_kg, 2, ' kg'),
  ];
  GOALS.rows.forEach((y, i) => {
    drawAt(ctx, w, h, GOALS.valueX, y, goalVals[i] ?? '', {
      size: fs(11),
      bold: true,
      align: 'right',
    });
  });

  const evalIdx = obesityEvalIndex(report.bmi, report.pbf_pct);
  const evalVals = [
    fmt(report.bmi, 1),
    report.pbf_pct != null ? `${fmt(report.pbf_pct, 1)} %` : '',
    evalIdx != null ? `${evalIdx} %` : '',
  ];
  OBESITY_EVAL.rows.forEach((y, i) => {
    drawAt(ctx, w, h, OBESITY_EVAL.valueX, y, evalVals[i] ?? '', {
      size: fs(12),
      bold: true,
      align: 'left',
    });
  });
}
function drawBodyTypeDot(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  bmi: number | null,
  pbf: number | null,
) {
  if (bmi == null || pbf == null) return;
  const c = BODY_TYPE_CHART;
  // Extrapolación lineal desde la zona estándar (sin clamp) para puntos fuera del cuadro.
  const tx = (pbf - c.pbfMin) / (c.pbfMax - c.pbfMin);
  const ty = (bmi - c.bmiMin) / (c.bmiMax - c.bmiMin);
  const x = px(w, h, c.x1 + tx * (c.x2 - c.x1), 0).x;
  const y = px(w, h, 0, c.y2 - ty * (c.y2 - c.y1)).y;
  const r = Math.max(4, px(w, h, 0, 5).y);
  ctx.save();
  ctx.fillStyle = RENPHO_BAR_BLUE;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawSegmentalLegend(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cx: number,
  y: number,
) {
  const lines = [
    { text: 'Masa (kg)', color: '#111827', bold: true },
    { text: '% vs estándar', color: '#2563eb', bold: false },
    { text: 'Estándar (kg)', color: '#059669', bold: false },
  ] as const;
  lines.forEach((line, i) => {
    drawAt(ctx, w, h, cx, y + i * SEGMENT_LEGEND.lineH, line.text, {
      size: fs(6.5),
      bold: line.bold,
      align: 'center',
      color: line.color,
    });
  });
}

function drawSegmentals(ctx: CanvasRenderingContext2D, w: number, h: number, m: InbodyMeasurement) {
  for (const key of SEGMENT_KEYS) {
    const fat = m.segmental_fat?.[key];
    const lean = m.segmental_lean?.[key];
    const fatPos = SEGMENT_FAT[key];
    const leanPos = SEGMENT_LEAN[key];

    // Formato Renpho: masa kg / % vs estándar / valor estándar kg
    if (fat?.kg != null) {
      drawAt(ctx, w, h, fatPos.x, fatPos.y, fmt(fat.kg, 2), {
        size: fs(8),
        bold: true,
        align: 'center',
      });
      const fatPct = fat.eval_pct ?? fat.pct;
      if (fatPct != null) {
        drawAt(ctx, w, h, fatPos.x, fatPos.y + 11, fmt(fatPct, 1, '%'), {
          size: fs(7),
          align: 'center',
          color: '#2563eb',
        });
      }
      if (fat.standard_kg != null) {
        drawAt(ctx, w, h, fatPos.x, fatPos.y + 22, fmt(fat.standard_kg, 2), {
          size: fs(7),
          align: 'center',
          color: '#059669',
        });
      }
    }

    if (lean?.kg != null) {
      drawAt(ctx, w, h, leanPos.x, leanPos.y, fmt(lean.kg, 2), {
        size: fs(8),
        bold: true,
        align: 'center',
      });
      const leanPct = lean.eval_pct ?? lean.pct;
      if (leanPct != null) {
        drawAt(ctx, w, h, leanPos.x, leanPos.y + 11, fmt(leanPct, 1, '%'), {
          size: fs(7),
          align: 'center',
          color: '#2563eb',
        });
      }
      if (lean.standard_kg != null) {
        drawAt(ctx, w, h, leanPos.x, leanPos.y + 22, fmt(lean.standard_kg, 2), {
          size: fs(7),
          align: 'center',
          color: '#059669',
        });
      }
    }
  }

  drawSegmentalLegend(ctx, w, h, SEGMENT_LEGEND.fat.x, SEGMENT_LEGEND.fat.y);
  drawSegmentalLegend(ctx, w, h, SEGMENT_LEGEND.lean.x, SEGMENT_LEGEND.lean.y);
}

function drawImpedance(ctx: CanvasRenderingContext2D, w: number, h: number, m: InbodyMeasurement) {
  const freqs = ['20khz', '100khz'] as const;
  freqs.forEach((freq, ri) => {
    const row = m.impedance?.[freq];
    if (!row) return;
    const y = IMPEDANCE.rowY[ri];
    IMPEDANCE.cols.forEach((key, ci) => {
      const val = row[key];
      if (val == null) return;
      drawAt(ctx, w, h, IMPEDANCE.colX[ci], y, fmt(val, 1), {
        size: fs(9),
        bold: true,
        align: 'center',
      });
    });
  });
}

function drawOtherIndicators(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  report: MorphoScanDerivedReport,
  m: InbodyMeasurement,
) {
  const vals = [
    fmt(report.visceral_fat_index ?? m.visceral_fat_index, 0) || '—',
    fmt(report.bmr_kcal ?? m.bmr_kcal, 0, ' kcal') || '—',
    fmt(report.ffm_kg, 1, ' kg') || '—',
    fmt(report.subcutaneous_fat_pct ?? m.subcutaneous_fat_pct, 1, '%') || '—',
    report.smi != null ? `${fmt(report.smi, 1)} kg/m²` : '—',
    fmt(report.metabolic_age ?? m.metabolic_age, 0) || '—',
    // WHR (Proporción cintura-cadera)
    report.whr != null || m.whr != null ? fmt(report.whr ?? m.whr, 2) : '—',
  ];
  OTHER.rows.forEach((y, i) => {
    drawAt(ctx, w, h, OTHER.valueX, y, vals[i] ?? '—', {
      size: fs(10),
      bold: true,
      align: 'right',
    });
  });
}

export function renderMorphoScanReportCanvas(
  template: HTMLImageElement,
  measurement: InbodyMeasurement,
  options: MorphoScanReportRenderOptions = {},
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const w = template.naturalWidth || REF_W;
  const h = template.naturalHeight || REF_H;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D no disponible');

  ctx.drawImage(template, 0, 0, w, h);

  const m = enrichMorphoScanSegmentals(measurement);
  const report = buildMorphoScanReport(m);
  drawLogo(ctx, w, h, options.logo);
  drawPatient(ctx, w, h, m, options.customerName);
  drawCompositionTable(ctx, w, h, report);
  drawMuscleFatBars(ctx, w, h, report);
  drawObesityBars(ctx, w, h, report);
  drawScoreGoalsObesityEval(ctx, w, h, report);
  drawBodyTypeDot(ctx, w, h, report.bmi, report.pbf_pct);
  drawSegmentals(ctx, w, h, m);
  drawImpedance(ctx, w, h, m);
  drawOtherIndicators(ctx, w, h, report, m);

  return canvas;
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

export function morphoscanReportFilename(measurement: InbodyMeasurement, customerName?: string): string {
  const date = measurement.measured_at.slice(0, 10);
  const slug = (customerName || measurement.inbody_user_id || 'cliente')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `morphoscan-${slug}-${date}.jpg`;
}

export async function downloadMorphoScanReport(
  measurement: InbodyMeasurement,
  customerName?: string,
  options: MorphoScanReportRenderOptions = {},
): Promise<void> {
  const [template, logo] = await Promise.all([
    loadMorphoScanReportTemplate(morphoscanReportSessionKey(measurement)),
    options.logo
      ? Promise.resolve(options.logo)
      : loadMorphoScanReportLogo(options.logoUrl),
  ]);
  const canvas = renderMorphoScanReportCanvas(template, measurement, {
    customerName,
    logo,
  });
  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
  triggerBlobDownload(blob, morphoscanReportFilename(measurement, customerName));
}

export async function shareMorphoScanReport(
  measurement: InbodyMeasurement,
  customerName?: string,
  options: MorphoScanReportRenderOptions = {},
): Promise<'shared' | 'downloaded'> {
  const [template, logo] = await Promise.all([
    loadMorphoScanReportTemplate(morphoscanReportSessionKey(measurement)),
    options.logo
      ? Promise.resolve(options.logo)
      : loadMorphoScanReportLogo(options.logoUrl),
  ]);
  const canvas = renderMorphoScanReportCanvas(template, measurement, {
    customerName,
    logo,
  });
  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
  const file = new File([blob], morphoscanReportFilename(measurement, customerName), {
    type: 'image/jpeg',
  });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: 'Informe MorphoScan' });
    return 'shared';
  }
  triggerBlobDownload(blob, morphoscanReportFilename(measurement, customerName));
  return 'downloaded';
}
