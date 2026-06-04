import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';

export type CashSessionStatus = 'open' | 'closed' | 'cancelled';

export type CashSessionRow = {
  id: string;
  company_id: string;
  session_date: string;
  status: CashSessionStatus;
  opening_cash: number;
  expected_cash: number;
  expected_card: number;
  counted_cash: number | null;
  counted_card: number | null;
  withdrawn_cash: number;
  closing_cash: number | null;
  cash_difference: number | null;
  card_difference: number | null;
  notes: string | null;
};

export function formatCashMoney(value: number | null | undefined): string {
  return `${Number(value ?? 0).toFixed(2)} €`;
}

export function formatSessionDateLabel(sessionDate: string): string {
  try {
    return format(parseISO(sessionDate), 'dd/MM/yyyy', { locale: es });
  } catch {
    return sessionDate;
  }
}

export function cashSessionStatusLabel(status: CashSessionStatus): string {
  switch (status) {
    case 'open':
      return 'Abierta';
    case 'closed':
      return 'Cerrada';
    case 'cancelled':
      return 'Cancelada';
    default:
      return status;
  }
}

export function formatDifference(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  const prefix = n > 0 ? '+' : '';
  return `${prefix}${n.toFixed(2)} €`;
}

/** Detalle de importes (sin fecha ni estado). */
export function formatCashSessionDetailLine(s: CashSessionRow): string {
  const parts = [
    `Apertura ${formatCashMoney(s.opening_cash)}`,
    `Ef. esp. ${formatCashMoney(s.expected_cash)}`,
    `Tarjeta esp. ${formatCashMoney(s.expected_card)}`,
  ];
  if (s.status === 'closed') {
    parts.push(`Desc. ef. ${formatDifference(s.cash_difference)}`);
    parts.push(`Desc. tarj. ${formatDifference(s.card_difference)}`);
    parts.push(`Cierre ${formatCashMoney(s.closing_cash)}`);
  } else if (Number(s.withdrawn_cash) > 0) {
    parts.push(`Retiradas ${formatCashMoney(s.withdrawn_cash)}`);
  }
  return parts.join(' · ');
}

/** Una línea resumen completa para historial. */
export function formatCashSessionSummaryLine(s: CashSessionRow): string {
  return [
    formatSessionDateLabel(s.session_date),
    cashSessionStatusLabel(s.status),
    formatCashSessionDetailLine(s),
  ].join(' · ');
}
