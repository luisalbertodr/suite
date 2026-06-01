import type {
  TuPartnerLeadItem,
  TuPartnerLeadNote,
  TuPartnerLeadsPayload,
} from '@/hooks/useMarketingLeads';
import { parseLooseDate } from '@/hooks/useMarketingLeads';

/**
 * Parser CSV RFC 4180 compatible:
 * - Soporta campos entrecomillados con saltos de línea y comas internas.
 * - Soporta comillas escapadas con doble-comilla ("").
 * - Devuelve filas como string[].
 */
export const parseCSV = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else if (c === '\r') {
        // skip CR
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
};

const normalizeHeader = (h: string): string =>
  (h || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const COLUMN_ALIASES: Record<string, string[]> = {
  name: ['nombre_del_cliente_potencial', 'opportunity_name', 'name', 'nombre'],
  contactName: ['nombre_del_contacto', 'contact_name', 'contactname', 'contacto'],
  phone: ['telefono', 'phone', 'phone_number', 'tel'],
  email: ['correo_electronico', 'email', 'mail', 'correo'],
  pipeline: ['secuencia', 'pipeline'],
  stage: ['fase', 'stage', 'etapa', 'columna', 'pipeline_stage'],
  monetaryValue: ['valor_del_cliente_potencial', 'monetary_value', 'value', 'valor', 'amount'],
  source: ['fuente', 'source', 'form_name', 'formulario'],
  assignedTo: ['asignado', 'assigned_to', 'assigneduser', 'owner'],
  createdAt: ['creado_el', 'created_at', 'createdat', 'fecha_creacion'],
  updatedAt: ['actualizado_el', 'updated_at', 'updatedat'],
  notes: ['notas', 'notes', 'observaciones'],
  tags: ['etiquetas', 'tags', 'labels'],
  status: ['estado', 'status'],
  opportunityId: ['id_de_oportunidad', 'opportunity_id', 'opportunityid', 'id'],
  contactId: ['id_de_contacto', 'contact_id', 'contactid'],
  url: ['url', 'enlace'],
};

const indexOfColumn = (normalizedHeaders: string[], key: string): number => {
  const candidates = COLUMN_ALIASES[key] || [key];
  for (const cand of candidates) {
    const i = normalizedHeaders.indexOf(cand);
    if (i >= 0) return i;
  }
  return -1;
};

const cleanText = (v: string | undefined): string => (v ?? '').trim();

const splitTags = (raw: string): string[] => {
  if (!raw) return [];
  return raw
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
};

/** Línea con fecha al inicio: "01/06/2025 - texto" o "2025-06-01: texto" */
const NOTE_LINE_WITH_DATE_RE =
  /^(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}|\d{4}[/.-]\d{1,2}[/.-]\d{1,2})(?:\s*[-–:]\s*|\s+)(.+)$/;

const splitNotes = (raw: string, leadCreatedAt: string | null): TuPartnerLeadNote[] => {
  if (!raw || !raw.trim()) return [];
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const seen = new Set<string>();
  const out: TuPartnerLeadNote[] = [];

  for (const line of lines) {
    const dated = line.match(NOTE_LINE_WITH_DATE_RE);
    let body = line;
    let createdAt: string | undefined;
    if (dated) {
      createdAt = parseLooseDate(dated[1]) ?? undefined;
      body = dated[2].trim();
    } else if (lines.length === 1 && leadCreatedAt) {
      createdAt = parseLooseDate(leadCreatedAt) ?? undefined;
    }
    if (!body) continue;
    const key = body.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ body, createdAt, kind: 'note' });
  }
  return out;
};

const toNumber = (raw: string): number | undefined => {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
};

export type CsvDetection =
  | { ok: true; payload: TuPartnerLeadsPayload; rows: number; headersMissing: string[] }
  | { ok: false; reason: string };

/**
 * Comprueba si el texto parece un CSV con cabeceras de exports de CRM (TuPartner/HighLevel/etc.).
 */
export const looksLikeCsv = (text: string): boolean => {
  const head = text.slice(0, 4096);
  if (!head) return false;
  // Heurística: línea 1 con varias comas + sin abrir { o [
  const trimmed = head.trimStart();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return false;
  const firstLine = head.split(/\r?\n/, 1)[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  return commaCount >= 3;
};

/**
 * Convierte un CSV (texto plano) en un TuPartnerLeadsPayload listo para
 * pasar por parseTuPartnerPayload y luego importTuPartner.
 */
export const convertCsvToTuPartner = (text: string): CsvDetection => {
  const rows = parseCSV(text);
  if (rows.length < 2) {
    return { ok: false, reason: 'El CSV no tiene filas de datos.' };
  }

  const header = rows[0];
  const normalized = header.map((h) => normalizeHeader(h));

  const idx = {
    name: indexOfColumn(normalized, 'name'),
    contactName: indexOfColumn(normalized, 'contactName'),
    phone: indexOfColumn(normalized, 'phone'),
    email: indexOfColumn(normalized, 'email'),
    stage: indexOfColumn(normalized, 'stage'),
    monetaryValue: indexOfColumn(normalized, 'monetaryValue'),
    source: indexOfColumn(normalized, 'source'),
    assignedTo: indexOfColumn(normalized, 'assignedTo'),
    createdAt: indexOfColumn(normalized, 'createdAt'),
    notes: indexOfColumn(normalized, 'notes'),
    tags: indexOfColumn(normalized, 'tags'),
    status: indexOfColumn(normalized, 'status'),
    opportunityId: indexOfColumn(normalized, 'opportunityId'),
    contactId: indexOfColumn(normalized, 'contactId'),
    url: indexOfColumn(normalized, 'url'),
  };

  const headersMissing: string[] = [];
  if (idx.stage < 0) headersMissing.push('fase / stage');
  if (idx.name < 0 && idx.contactName < 0) headersMissing.push('nombre');
  if (idx.phone < 0 && idx.email < 0) headersMissing.push('teléfono o email');

  if (idx.stage < 0) {
    return {
      ok: false,
      reason: `Faltan columnas obligatorias: ${headersMissing.join(', ')}. Comprueba que el CSV exportado incluye al menos la columna "fase".`,
    };
  }

  const stageOrder = new Map<string, number>();
  let nextStageIdx = 0;

  const leads: TuPartnerLeadItem[] = [];

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    if (!cells || cells.length === 0) continue;
    // Fila vacía
    const anyContent = cells.some((c) => (c ?? '').trim().length > 0);
    if (!anyContent) continue;

    const stage = cleanText(cells[idx.stage]) || 'Sin etapa';
    if (!stageOrder.has(stage)) stageOrder.set(stage, nextStageIdx++);

    const createdAt = idx.createdAt >= 0 ? cleanText(cells[idx.createdAt]) : '';
    const notesRaw = idx.notes >= 0 ? cells[idx.notes] ?? '' : '';
    const tagsRaw = idx.tags >= 0 ? cells[idx.tags] ?? '' : '';

    const name = idx.name >= 0 ? cleanText(cells[idx.name]) : '';
    const contactName = idx.contactName >= 0 ? cleanText(cells[idx.contactName]) : '';

    const lead: TuPartnerLeadItem = {
      stage,
      stageIndex: stageOrder.get(stage),
      position: leads.length,
      contactId: idx.contactId >= 0 ? cleanText(cells[idx.contactId]) || null : null,
      opportunityId: idx.opportunityId >= 0 ? cleanText(cells[idx.opportunityId]) || null : null,
      name: name || contactName || '(sin nombre)',
      contactName: contactName || name || '',
      phone: idx.phone >= 0 ? cleanText(cells[idx.phone]) : '',
      email: idx.email >= 0 ? cleanText(cells[idx.email]) || null : null,
      monetaryValue: idx.monetaryValue >= 0 ? toNumber(cells[idx.monetaryValue]) ?? 0 : 0,
      createdAt: createdAt || undefined,
      assignedTo: idx.assignedTo >= 0 ? cleanText(cells[idx.assignedTo]) : '',
      appointmentDate: null,
      status: idx.status >= 0 ? cleanText(cells[idx.status]) || null : null,
      url: idx.url >= 0 ? cleanText(cells[idx.url]) : '',
      tags: splitTags(tagsRaw),
      notes: splitNotes(notesRaw, createdAt || null),
    };

    leads.push(lead);
  }

  if (leads.length === 0) {
    return { ok: false, reason: 'El CSV no contiene filas con datos válidos.' };
  }

  const payload: TuPartnerLeadsPayload = {
    source: 'csv-import',
    exportDate: new Date().toISOString(),
    totalLeads: leads.length,
    leads,
  };

  return { ok: true, payload, rows: leads.length, headersMissing };
};
