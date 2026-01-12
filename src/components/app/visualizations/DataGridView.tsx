import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, BarChart3 } from 'lucide-react';
import type { DataBundle } from '@/types';

interface Props {
  bundle: DataBundle;
  onBackToProfile?: () => void;
}

export function DataGridView({ bundle, onBackToProfile }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  // Transform bundle data into table format
  const data = useMemo(() => {
    return bundle.source.parsedData;
  }, [bundle]);

  // Create columns from bundle columns
  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    // Add row ID column first
    const rowIdColumn: ColumnDef<Record<string, unknown>> = {
      id: '_rowId',
      header: () => <span className="font-medium text-zinc-500">#</span>,
      cell: ({ row }) => (
        <span className="text-zinc-500 font-mono text-xs">{row.index + 1}</span>
      ),
      size: 60,
      enableSorting: false,
    };

    // Add data columns
    const dataColumns: ColumnDef<Record<string, unknown>>[] = bundle.source.columns.map((col) => ({
      accessorKey: col,
      header: ({ column }: { column: any }) => {
        return (
          <button
            className="flex items-center gap-1 font-medium hover:text-emerald-400 transition-colors"
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          >
            {col}
            {column.getIsSorted() === 'asc' ? (
              <ArrowUp className="w-3 h-3" />
            ) : column.getIsSorted() === 'desc' ? (
              <ArrowDown className="w-3 h-3" />
            ) : (
              <ArrowUpDown className="w-3 h-3 opacity-50" />
            )}
          </button>
        );
      },
      cell: ({ getValue }: { getValue: () => unknown }) => {
        const value = getValue();
        if (value === null || value === undefined || value === '') {
          return <span className="text-zinc-600 italic">null</span>;
        }
        return <span className="text-zinc-300">{String(value)}</span>;
      },
    }));

    return [rowIdColumn, ...dataColumns];
  }, [bundle.source.columns]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-4">
          {onBackToProfile && (
            <Button
              size="sm"
              variant="outline"
              onClick={onBackToProfile}
              className="h-8 gap-1.5 border-zinc-700 hover:bg-zinc-800"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Back to Profile
            </Button>
          )}
          <span className="text-sm text-zinc-400">
            {table.getFilteredRowModel().rows.length.toLocaleString()} rows × {bundle.source.columns.length} columns
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Search all columns..."
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-9 w-64 bg-zinc-800 border-zinc-700"
          />
        </div>
      </div>

      {/* Data Grid */}
      <ScrollArea className="flex-1">
        <div className="relative">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-zinc-900">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-xs text-zinc-400 border-b border-zinc-800 bg-zinc-900"
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, i) => (
                <tr
                  key={row.id}
                  className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${
                    i % 2 === 0 ? 'bg-zinc-900/50' : 'bg-zinc-950/50'
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-2 text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {table.getFilteredRowModel().rows.length === 0 && (
            <div className="text-center py-12 text-zinc-500">No data matches your search</div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
