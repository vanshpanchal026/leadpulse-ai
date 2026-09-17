import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  useLegacyTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type LegacyReactTable as Table,
} from '@tanstack/react-table/legacy';
import { flexRender } from '@tanstack/react-table';
import { NormalizedLead } from '../types';
import { leadColumns } from '../columns';
import { LeadsToolbar } from './leads-toolbar';
import { LeadsPagination } from './leads-pagination';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Layers, FlaskConical } from 'lucide-react';

interface LeadsTableProps {
  leads: NormalizedLead[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  onRetry: () => void;
}

export function LeadsTable({
  leads,
  isLoading,
  isError,
  error,
  onRetry,
}: LeadsTableProps) {
  const navigate = useNavigate();

  // Table State
  const [sorting, setSorting] = useState<any[]>([]);
  const [columnVisibility, setColumnVisibility] = useState<any>({});
  const [rowSelection, setRowSelection] = useState<any>({});
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });

  // Filter States
  const [globalFilter, setGlobalFilter] = useState('');
  const [opportunityTierFilter, setOpportunityTierFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Derive distinct categories from leads
  const categories = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      if (l.category && l.category !== 'Uncategorized') {
        set.add(l.category);
      }
    });
    return Array.from(set).sort();
  }, [leads]);

  // Client-side filtering across tier, category, and search query
  const filteredData = useMemo(() => {
    return leads.filter((lead) => {
      // 1. Opportunity Tier Filter
      if (opportunityTierFilter !== 'all' && lead.opportunityTier !== opportunityTierFilter) {
        return false;
      }

      // 2. Category Filter
      if (categoryFilter !== 'all' && lead.category !== categoryFilter) {
        return false;
      }

      // 3. Search Query Filter
      if (globalFilter.trim()) {
        const query = globalFilter.toLowerCase().trim();
        const matchName = lead.name.toLowerCase().includes(query);
        const matchCategory = lead.category.toLowerCase().includes(query);
        const matchLocation = lead.location.toLowerCase().includes(query);
        const matchService = lead.recommendedService.toLowerCase().includes(query);
        const matchProblem = lead.primaryProblem?.toLowerCase().includes(query) || false;

        if (!matchName && !matchCategory && !matchLocation && !matchService && !matchProblem) {
          return false;
        }
      }

      return true;
    });
  }, [leads, opportunityTierFilter, categoryFilter, globalFilter]);

  const resetFilters = () => {
    setGlobalFilter('');
    setOpportunityTierFilter('all');
    setCategoryFilter('all');
  };

  const table = useLegacyTable({
    data: filteredData,
    columns: leadColumns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // Handle row click (navigates to lead detail, avoiding clicks on interactive inputs/buttons)
  const handleRowClick = (leadId: string, e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'BUTTON' ||
      target.tagName === 'A' ||
      target.closest('a') ||
      target.closest('button') ||
      target.closest('input')
    ) {
      return;
    }
    navigate(`/leads/${leadId}`);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <LeadsToolbar
        table={table}
        globalFilter={globalFilter}
        setGlobalFilter={setGlobalFilter}
        opportunityTierFilter={opportunityTierFilter}
        setOpportunityTierFilter={setOpportunityTierFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        categories={categories}
        onResetFilters={resetFilters}
      />

      {/* Main Table Container */}
      <div className="rounded-lg border border-border/80 bg-card/60 shadow-xs overflow-hidden">
        <div className="overflow-x-auto min-h-[300px]">
          <table className="w-full text-left border-collapse">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  className="border-b border-border/80 bg-muted/40 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
                >
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="p-3 select-none">
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>

            <tbody className="divide-y divide-border/50 text-xs">
              {/* Loading State */}
              {isLoading && (
                <>
                  {[...Array(6)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="p-3">
                        <div className="h-4 w-4 bg-muted/60 rounded" />
                      </td>
                      <td className="p-3">
                        <div className="space-y-1.5">
                          <div className="h-3.5 w-40 bg-muted/60 rounded" />
                          <div className="h-2.5 w-20 bg-muted/40 rounded" />
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="h-4 w-24 bg-muted/50 rounded-full" />
                      </td>
                      <td className="p-3">
                        <div className="h-3 w-28 bg-muted/40 rounded" />
                      </td>
                      <td className="p-3">
                        <div className="h-5 w-12 bg-muted/60 rounded" />
                      </td>
                      <td className="p-3">
                        <div className="h-4 w-16 bg-muted/50 rounded" />
                      </td>
                      <td className="p-3">
                        <div className="h-4 w-20 bg-muted/50 rounded" />
                      </td>
                      <td className="p-3">
                        <div className="h-4 w-16 bg-muted/40 rounded" />
                      </td>
                      <td className="p-3">
                        <div className="h-3.5 w-28 bg-muted/50 rounded" />
                      </td>
                      <td className="p-3">
                        <div className="h-7 w-16 bg-muted/50 rounded" />
                      </td>
                    </tr>
                  ))}
                </>
              )}

              {/* Error State */}
              {!isLoading && isError && (
                <tr>
                  <td colSpan={leadColumns.length} className="p-8 text-center">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                        <AlertCircle className="h-5 w-5" />
                      </div>
                      <h4 className="text-sm font-semibold text-foreground">
                        Failed to Load Leads Dataset
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {error?.message || 'An unexpected error occurred while communicating with /api/leads.'}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onRetry}
                        className="mt-2"
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        Retry Connection
                      </Button>
                    </div>
                  </td>
                </tr>
              )}

              {/* Empty State: Zero Leads in Database */}
              {!isLoading && !isError && leads.length === 0 && (
                <tr>
                  <td colSpan={leadColumns.length} className="p-12 text-center">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <FlaskConical className="h-5 w-5" />
                      </div>
                      <h4 className="text-sm font-semibold text-foreground">
                        No Leads Discovered Yet
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Your pipeline is currently empty. Run your first multi-agent campaign to discover and qualify high-value local prospects.
                      </p>
                      <Button asChild size="sm" className="mt-1 gap-1.5">
                        <Link to="/research">
                          <FlaskConical className="h-3.5 w-3.5" />
                          Launch Research Campaign
                        </Link>
                      </Button>
                    </div>
                  </td>
                </tr>
              )}

              {/* Empty State: Filter Returned Zero Rows */}
              {!isLoading && !isError && leads.length > 0 && table.getRowModel().rows.length === 0 && (
                <tr>
                  <td colSpan={leadColumns.length} className="p-12 text-center">
                    <div className="max-w-sm mx-auto space-y-3">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Layers className="h-5 w-5" />
                      </div>
                      <h4 className="text-sm font-semibold text-foreground">
                        No Matching Leads Found
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        No candidates match your current search criteria or active filters.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetFilters}
                        className="mt-1"
                      >
                        Reset All Filters
                      </Button>
                    </div>
                  </td>
                </tr>
              )}

              {/* Standard Table Rows */}
              {!isLoading &&
                !isError &&
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={(e) => handleRowClick(row.original.id, e)}
                    className={`transition-colors cursor-pointer group ${
                      row.getIsSelected()
                        ? 'bg-primary/10 hover:bg-primary/15'
                        : 'hover:bg-muted/40'
                    }`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="p-3 align-middle">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      {!isLoading && !isError && filteredData.length > 0 && (
        <LeadsPagination table={table} />
      )}
    </div>
  );
}
