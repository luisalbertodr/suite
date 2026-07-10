import type { CommandBoardStats } from '@/lib/dashboardCommandBoard';

function eur(value: number): string {
  return `€${value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function num(value: number): string {
  return value.toLocaleString('es-ES', { maximumFractionDigits: 2 });
}

type TripleRow = {
  label: string;
  total: number | string;
  bonos: number | string;
  other: number | string;
  emphasize?: boolean;
};

function StatsTable({ rows }: { rows: TripleRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-2 pr-3 font-medium" />
            <th className="py-2 px-2 font-medium text-right">Total</th>
            <th className="py-2 px-2 font-medium text-right">Serie Bonos</th>
            <th className="py-2 pl-2 font-medium text-right">Otras Series</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-border/60 last:border-0">
              <td className="py-2 pr-3 text-muted-foreground">{row.label}</td>
              <td
                className={`py-2 px-2 text-right tabular-nums ${row.emphasize ? 'font-semibold text-foreground' : ''}`}
              >
                {row.total}
              </td>
              <td className="py-2 px-2 text-right tabular-nums">{row.bonos}</td>
              <td className="py-2 pl-2 text-right tabular-nums">{row.other}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SideBlock({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: string }[];
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-4">
      <h4 className="mb-3 text-sm font-semibold text-foreground">{title}</h4>
      <dl className="space-y-2 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start justify-between gap-3">
            <dt className="text-muted-foreground">{row.label}</dt>
            <dd className="text-right font-medium tabular-nums text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

type Props = {
  data: CommandBoardStats;
};

export function DashboardCommandBoard({ data }: Props) {
  const { sales, clients, reservations, cash, purchases, profit } = data;
  const employeeSales = sales.employeeSales ?? [];

  const salesRows: TripleRow[] = [
    {
      label: 'Nº de Tickets',
      total: num(sales.tickets.total),
      bonos: num(sales.tickets.bonos),
      other: num(sales.tickets.other),
    },
    {
      label: 'Total Facturado',
      total: eur(sales.invoiced.total),
      bonos: eur(sales.invoiced.bonos),
      other: eur(sales.invoiced.other),
      emphasize: true,
    },
    {
      label: 'Promedio de Importe por Ticket',
      total: eur(sales.avgTicket.total),
      bonos: eur(sales.avgTicket.bonos),
      other: eur(sales.avgTicket.other),
    },
    {
      label: 'Total Facturado en Servicios',
      total: eur(sales.services.amount),
      bonos: '—',
      other: '—',
    },
    {
      label: 'Nº Total de Servicios Facturados',
      total: num(sales.services.count),
      bonos: '—',
      other: '—',
    },
    {
      label: 'Total Facturado en Productos',
      total: eur(sales.products.amount),
      bonos: '—',
      other: '—',
    },
    {
      label: 'Nº Total de Productos Facturados',
      total: num(sales.products.count),
      bonos: '—',
      other: '—',
    },
    {
      label: 'Total Deudas',
      total: eur(sales.debts),
      bonos: '—',
      other: '—',
    },
  ];

  const clientRows = [
    {
      label: 'Nº Clientes Nuevos',
      total: num(clients.new.total),
      women: num(clients.new.women),
      men: num(clients.new.men),
      children: num(clients.new.children),
    },
    {
      label: 'Nº Total de Clientes del Periodo',
      total: num(clients.periodActive),
      women: '—',
      men: '—',
      children: '—',
    },
    {
      label: 'Nº Total de Clientes',
      total: num(clients.total),
      women: '—',
      men: '—',
      children: '—',
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <h3 className="mb-4 text-base font-semibold text-foreground">Ventas</h3>
          <StatsTable rows={salesRows} />
          <div className="mt-5">
            <h4 className="mb-3 text-sm font-semibold text-foreground">Facturación por empleada</h4>
            {employeeSales.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Empleada</th>
                      <th className="py-2 px-2 font-medium text-right">Tickets</th>
                      <th className="py-2 pl-2 font-medium text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeSales.map((row) => (
                      <tr key={row.name} className="border-b border-border/60 last:border-0">
                        <td className="py-2 pr-3 text-foreground">{row.name}</td>
                        <td className="py-2 px-2 text-right tabular-nums">{num(row.tickets)}</td>
                        <td className="py-2 pl-2 text-right tabular-nums font-medium">{eur(row.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin datos de empleadas en este periodo.</p>
            )}
          </div>
          <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <p>
              <span className="text-muted-foreground">Artículo más Vendido: </span>
              <span className="font-medium">{sales.topArticle.name}</span>
              <span className="tabular-nums text-muted-foreground"> ({eur(sales.topArticle.amount)})</span>
            </p>
            <p>
              <span className="text-muted-foreground">Bono más Vendido: </span>
              <span className="font-medium">{sales.topBono.name}</span>
              <span className="tabular-nums text-muted-foreground"> ({eur(sales.topBono.amount)})</span>
            </p>
            <p>
              <span className="text-muted-foreground">Mejor Cliente: </span>
              <span className="font-medium">{sales.topCustomer.name}</span>
              <span className="tabular-nums text-muted-foreground"> ({eur(sales.topCustomer.amount)})</span>
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <SideBlock
            title="Reservas"
            rows={[
              { label: 'Número de Reservas Programadas', value: num(reservations.scheduled) },
              { label: 'Número de Horas Programadas', value: num(reservations.scheduledHours) },
              { label: 'Número de Reservas Facturadas', value: num(reservations.billed) },
              { label: 'Número de Horas Facturadas', value: num(reservations.billedHours) },
            ]}
          />
          <SideBlock
            title="Movimientos de Caja"
            rows={[
              { label: 'Total Entradas de Caja', value: eur(cash.in) },
              { label: 'Total Salidas de Caja', value: eur(cash.out) },
            ]}
          />
          <SideBlock
            title="Compras"
            rows={[
              { label: 'Total Facturas de Compra', value: eur(purchases.total) },
              { label: 'Total Deudas en Compras', value: eur(purchases.debts) },
            ]}
          />
          <SideBlock
            title="Beneficios"
            rows={[{ label: 'Beneficio Neto (Ventas − Compras)', value: eur(profit.net) }]}
          />
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h3 className="mb-4 text-base font-semibold text-foreground">Clientes</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3 font-medium" />
                <th className="py-2 px-2 font-medium text-right">Total</th>
                <th className="py-2 px-2 font-medium text-right">Mujeres</th>
                <th className="py-2 px-2 font-medium text-right">Hombres</th>
                <th className="py-2 pl-2 font-medium text-right">Niños</th>
              </tr>
            </thead>
            <tbody>
              {clientRows.map((row) => (
                <tr key={row.label} className="border-b border-border/60 last:border-0">
                  <td className="py-2 pr-3 text-muted-foreground">{row.label}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{row.total}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{row.women}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{row.men}</td>
                  <td className="py-2 pl-2 text-right tabular-nums">{row.children}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
