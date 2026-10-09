import React, { useMemo, useRef } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';
import { ArrowDown, ArrowUp, ArrowUpDown, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VerifactuStatus } from '@/components/VerifactuStatus';
import { cn } from '@/lib/utils';

export type FacturaListRow = {
  id: string;
  number: string;
  issue_date: string;
  due_date: string;
  total_amount: number | null;
  status: string;
  is_corrective?: boolean;
  corrective_reason?: string | null;
  verifactu_status?: string;
  verifactu_csv?: string;
  verifactu_qr_code?: string;
  verifactu_sent_at?: string;
  verifactu_response_message?: string;
  customers?: { name?: string | null; tax_id?: string | null } | null;
};

type Props = {
  invoices: FacturaListRow[];
  onOpen: (invoice: FacturaListRow) => void;
  statusClassName: (status: string) => string;
};

function statusLabel(status: string): string {
  if (status === 'paid') return 'Pagada';
  if (status === 'overdue') return 'Vencida';
  if (status === 'pending') return 'Pendiente';
  return status;
}

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <ArrowUp className="ml-1 inline h-3.5 w-3.5" />;
  if (sorted === 'desc') return <ArrowDown className="ml-1 inline h-3.5 w-3.5" />;
  return <ArrowUpDown className="ml-1 inline h-3.5 w-3.5 opacity-40" />;
}

const ROW_HEIGHT = 52;

export const FacturasInvoiceTable: React.FC<Props> = ({
  invoices,
  onOpen,
  statusClassName,
}) => {
  const [sorting, setSorting] = React.useState<SortingState>([
    { id: 'issue_date', desc: true },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const columns = useMemo<ColumnDef<FacturaListRow>[]>(
    () => [
      {
        accessorKey: 'number',
        header: 'Número',
        size: 140,
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5 font-medium">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{row.original.number}</span>
            {row.original.is_corrective ? (
              <Badge variant="outline" className="shrink-0 text-[10px]">
                Rect.
              </Badge>
            ) : null}
          </div>
        ),
      },
      {
        id: 'customer',
        accessorFn: (r) => r.customers?.name ?? '',
        header: 'Cliente',
        size: 220,
        cell: ({ getValue }) => (
          <span className="truncate text-muted-foreground">
            {(getValue<string>() || 'Cliente sin ficha')}
          </span>
        ),
      },
      {
        accessorKey: 'issue_date',
        header: 'Fecha',
        size: 110,
        cell: ({ getValue }) => {
          const v = getValue<string | null>();
          if (!v) return '—';
          const d = new Date(v);
          return Number.isFinite(d.getTime()) ? format(d, 'dd/MM/yyyy') : '—';
        },
      },
      {
        accessorKey: 'due_date',
        header: 'Vencimiento',
        size: 110,
        cell: ({ getValue }) => {
          const v = getValue<string | null>();
          if (!v) return '—';
          const d = new Date(v);
          return Number.isFinite(d.getTime()) ? format(d, 'dd/MM/yyyy') : '—';
        },
      },
      {
        accessorKey: 'status',
        header: 'Estado',
        size: 110,
        cell: ({ getValue }) => {
          const status = getValue<string>();
          return (
            <Badge className={statusClassName(status)}>{statusLabel(status)}</Badge>
          );
        },
      },
      {
        accessorKey: 'total_amount',
        header: 'Importe',
        size: 110,
        cell: ({ getValue }) => {
          const n = Number(getValue<number | null>() ?? 0);
          return (
            <span className="block text-right font-semibold tabular-nums">
              {n.toFixed(2)} €
            </span>
          );
        },
      },
      {
        id: 'verifactu',
        header: 'Verifactu',
        size: 120,
        enableSorting: false,
        cell: ({ row }) => <VerifactuStatus invoice={row.original} />,
      },
      {
        id: 'actions',
        header: '',
        size: 110,
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onOpen(row.original);
            }}
          >
            Ver detalles
          </Button>
        ),
      },
    ],
    [onOpen, statusClassName],
  );

  const table = useReactTable({
    data: invoices,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.id,
  });

  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
    getItemKey: (index) => rows[index]?.id ?? index,
  });

  if (invoices.length === 0) return null;

  return (
    <div className="rounded-md border bg-background">
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[900px] border-b bg-muted/40 text-xs font-medium text-muted-foreground"
          style={{
            gridTemplateColumns: table
              .getFlatHeaders()
              .map((h) => `${h.getSize()}px`)
              .join(' '),
          }}
        >
          {table.getFlatHeaders().map((header) => {
            const canSort = header.column.getCanSort();
            const sorted = header.column.getIsSorted();
            return (
              <button
                key={header.id}
                type="button"
                disabled={!canSort}
                className={cn(
                  'flex items-center px-3 py-2.5 text-left',
                  canSort && 'hover:bg-muted/70 cursor-pointer',
                  !canSort && 'cursor-default',
                )}
                onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
                {canSort ? <SortIcon sorted={sorted} /> : null}
              </button>
            );
          })}
        </div>

        <div
          ref={scrollRef}
          className="relative min-w-[900px] overflow-auto"
          style={{ height: Math.min(520, Math.max(ROW_HEIGHT * 6, rows.length * ROW_HEIGHT + 8)) }}
        >
          <div
            className="relative w-full"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((item) => {
              const row = rows[item.index];
              if (!row) return null;
              return (
                <div
                  key={row.id}
                  role="row"
                  data-index={item.index}
                  className="absolute left-0 grid w-full cursor-pointer border-b border-border/60 hover:bg-muted/30"
                  style={{
                    height: item.size,
                    transform: `translateY(${item.start}px)`,
                    gridTemplateColumns: row
                      .getVisibleCells()
                      .map((c) => `${c.column.getSize()}px`)
                      .join(' '),
                  }}
                  onClick={() => onOpen(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <div
                      key={cell.id}
                      className="flex items-center overflow-hidden px-3 text-sm"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
