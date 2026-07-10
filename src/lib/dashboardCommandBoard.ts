import { supabase } from '@/lib/supabase';
import { repairStyleText } from '@/lib/styleTextEncoding';

export type CommandBoardColumnStats = {
  total: number;
  bonos: number;
  other: number;
};

export type CommandBoardAmountCount = {
  amount: number;
  count: number;
};

export type CommandBoardTopItem = {
  name: string;
  amount: number;
};

export type CommandBoardEmployeeSale = {
  name: string;
  amount: number;
  tickets: number;
};

export type CommandBoardStats = {
  period: { from: string; to: string };
  sales: {
    tickets: CommandBoardColumnStats;
    invoiced: CommandBoardColumnStats;
    avgTicket: CommandBoardColumnStats;
    services: CommandBoardAmountCount;
    products: CommandBoardAmountCount;
    debts: number;
    employeeSales: CommandBoardEmployeeSale[];
    topArticle: CommandBoardTopItem;
    topBono: CommandBoardTopItem;
    topCustomer: CommandBoardTopItem;
  };
  clients: {
    new: { total: number; women: number; men: number; children: number };
    periodActive: number;
    total: number;
  };
  reservations: {
    scheduled: number;
    scheduledHours: number;
    billed: number;
    billedHours: number;
  };
  cash: { in: number; out: number };
  purchases: { total: number; debts: number };
  profit: { net: number };
};

function num(value: unknown): number {
  return Number(value ?? 0);
}

function columnStats(raw: Record<string, unknown> | undefined): CommandBoardColumnStats {
  return {
    total: num(raw?.total),
    bonos: num(raw?.bonos),
    other: num(raw?.other),
  };
}

function topItem(raw: Record<string, unknown> | undefined): CommandBoardTopItem {
  return {
    name: repairStyleText(String(raw?.name ?? '—')) || '—',
    amount: num(raw?.amount),
  };
}

function employeeSales(raw: unknown): CommandBoardEmployeeSale[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((row) => {
    const item = (row ?? {}) as Record<string, unknown>;
    return {
      name: repairStyleText(String(item.name ?? '—')) || '—',
      amount: num(item.amount),
      tickets: num(item.tickets),
    };
  });
}

export function normalizeCommandBoardStats(
  data: CommandBoardStats | null | undefined,
): CommandBoardStats | null {
  if (!data?.sales) return data ?? null;
  if (Array.isArray(data.sales.employeeSales)) return data;
  return {
    ...data,
    sales: {
      ...data.sales,
      employeeSales: [],
    },
  };
}

export function parseCommandBoardStats(raw: unknown): CommandBoardStats | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const sales = (data.sales ?? {}) as Record<string, unknown>;
  const clients = (data.clients ?? {}) as Record<string, unknown>;
  const reservations = (data.reservations ?? {}) as Record<string, unknown>;
  const period = (data.period ?? {}) as Record<string, unknown>;
  const cash = (data.cash ?? {}) as Record<string, unknown>;
  const purchases = (data.purchases ?? {}) as Record<string, unknown>;
  const profit = (data.profit ?? {}) as Record<string, unknown>;
  const services = (sales.services ?? {}) as Record<string, unknown>;
  const products = (sales.products ?? {}) as Record<string, unknown>;
  const newClients = (clients.new ?? {}) as Record<string, unknown>;

  return normalizeCommandBoardStats({
    period: {
      from: String(period.from ?? ''),
      to: String(period.to ?? ''),
    },
    sales: {
      tickets: columnStats(sales.tickets as Record<string, unknown>),
      invoiced: columnStats(sales.invoiced as Record<string, unknown>),
      avgTicket: columnStats(sales.avgTicket as Record<string, unknown>),
      services: { amount: num(services.amount), count: num(services.count) },
      products: { amount: num(products.amount), count: num(products.count) },
      debts: num(sales.debts),
      employeeSales: employeeSales(sales.employeeSales),
      topArticle: topItem(sales.topArticle as Record<string, unknown>),
      topBono: topItem(sales.topBono as Record<string, unknown>),
      topCustomer: topItem(sales.topCustomer as Record<string, unknown>),
    },
    clients: {
      new: {
        total: num(newClients.total),
        women: num(newClients.women),
        men: num(newClients.men),
        children: num(newClients.children),
      },
      periodActive: num(clients.periodActive),
      total: num(clients.total),
    },
    reservations: {
      scheduled: num(reservations.scheduled),
      scheduledHours: num(reservations.scheduledHours),
      billed: num(reservations.billed),
      billedHours: num(reservations.billedHours),
    },
    cash: { in: num(cash.in), out: num(cash.out) },
    purchases: { total: num(purchases.total), debts: num(purchases.debts) },
    profit: { net: num(profit.net) },
  });
}

export async function fetchDashboardCommandBoardStats(opts: {
  companyId: string;
  catalogCompanyId: string;
  fromDate: string;
  toDate: string;
}): Promise<CommandBoardStats> {
  const { data, error } = await supabase.rpc('dashboard_command_board_stats', {
    p_company_id: opts.companyId,
    p_catalog_company_id: opts.catalogCompanyId,
    p_from_date: opts.fromDate,
    p_to_date: opts.toDate,
  });
  if (error) throw error;
  const parsed = parseCommandBoardStats(data);
  if (!parsed) throw new Error('Respuesta inválida del cuadro de mandos');
  return parsed;
}

export function currentMonthRange(today = new Date()): { from: string; to: string } {
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return { from: `${y}-${m}-01`, to: `${y}-${m}-${d}` };
}
