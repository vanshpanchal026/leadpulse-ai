import React from 'react';
import { type LegacyReactTable as Table } from '@tanstack/react-table/legacy';
import { NormalizedLead } from '../types';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';

interface LeadsPaginationProps {
  table: Table<NormalizedLead>;
}

export function LeadsPagination({ table }: LeadsPaginationProps) {
  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const pageCount = table.getPageCount();
  const totalRows = table.getFilteredRowModel().rows.length;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <span>Show</span>
        <select
          value={pageSize}
          onChange={(e) => table.setPageSize(Number(e.target.value))}
          className="h-7 px-2 rounded-md bg-muted/30 border border-input text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer transition-colors"
        >
          {[10, 25, 50, 100].map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
        <span>per page</span>
        <span className="text-muted-foreground/60">&bull;</span>
        <span className="tabular-nums">
          Showing{' '}
          <strong className="text-foreground font-semibold">
            {totalRows > 0 ? pageIndex * pageSize + 1 : 0}
          </strong>{' '}
          to{' '}
          <strong className="text-foreground font-semibold">
            {Math.min((pageIndex + 1) * pageSize, totalRows)}
          </strong>{' '}
          of <strong className="text-foreground font-semibold">{totalRows}</strong> leads
        </span>
      </div>

      <div className="flex items-center gap-1.5 self-end sm:self-auto">
        <span className="mr-2 font-mono text-[11px] tabular-nums">
          Page {totalRows > 0 ? pageIndex + 1 : 0} of {pageCount}
        </span>

        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
          aria-label="First page"
        >
          <ChevronsLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          aria-label="Next page"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => table.setPageIndex(pageCount - 1)}
          disabled={!table.getCanNextPage()}
          aria-label="Last page"
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
