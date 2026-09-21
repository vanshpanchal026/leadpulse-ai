import React, { useState, useEffect } from 'react';
import { type LegacyReactTable as Table } from '@tanstack/react-table/legacy';
import { NormalizedLead } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OpportunityTier } from '@/lib/utils';
import {
  Search,
  X,
  SlidersHorizontal,
  RotateCcw,
  Check,
  ShieldCheck,
  Filter
} from 'lucide-react';

interface LeadsToolbarProps {
  table: Table<NormalizedLead>;
  globalFilter: string;
  setGlobalFilter: (val: string) => void;
  opportunityTierFilter: string;
  setOpportunityTierFilter: (val: string) => void;
  categoryFilter: string;
  setCategoryFilter: (val: string) => void;
  categories: string[];
  onResetFilters: () => void;
}

export function LeadsToolbar({
  table,
  globalFilter,
  setGlobalFilter,
  opportunityTierFilter,
  setOpportunityTierFilter,
  categoryFilter,
  setCategoryFilter,
  categories,
  onResetFilters,
}: LeadsToolbarProps) {
  const [searchInput, setSearchInput] = useState(globalFilter);
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);

  // Debounce search input by 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setGlobalFilter(searchInput);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput, setGlobalFilter]);

  const selectedRowCount = Object.keys(table.getState().rowSelection || {}).length;
  const totalRowCount = table.getFilteredRowModel().rows.length;

  const hasActiveFilters =
    Boolean(globalFilter) ||
    opportunityTierFilter !== 'all' ||
    categoryFilter !== 'all';

  return (
    <div className="space-y-3">
      {/* Primary Search & Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-1 items-center gap-2 flex-wrap">
          {/* Global Search Input */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search leads by name, vertical, location..."
              className="w-full h-8 pl-8 pr-8 rounded-md bg-muted/30 border border-input text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary transition-colors"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setGlobalFilter('');
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Opportunity Tier Dropdown Filter */}
          <select
            value={opportunityTierFilter}
            onChange={(e) => setOpportunityTierFilter(e.target.value)}
            className="h-8 px-2.5 rounded-md bg-muted/30 border border-input text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer transition-colors"
          >
            <option value="all">All Tiers</option>
            <option value="Immediate">Immediate (80–100)</option>
            <option value="High Potential">High Potential (60–79)</option>
            <option value="Medium">Medium (40–59)</option>
            <option value="Low">Low (&lt;40)</option>
          </select>

          {/* Category / Vertical Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-8 px-2.5 rounded-md bg-muted/30 border border-input text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary cursor-pointer max-w-[180px] transition-colors"
          >
            <option value="all">All Verticals</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Reset Filters Button */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchInput('');
                onResetFilters();
              }}
              className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset Filters
            </Button>
          )}
        </div>

        {/* Column Visibility Menu */}
        <div className="relative shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsColumnMenuOpen((prev) => !prev)}
            className="h-8 text-xs flex items-center gap-1.5"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Columns</span>
          </Button>

          {isColumnMenuOpen && (
            <div className="absolute right-0 mt-1.5 w-48 rounded-md border border-border bg-card/95 p-2 shadow-lg z-20 space-y-1 text-xs animate-in fade-in-50 duration-150">
              <div className="px-2 py-1 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
                Toggle Columns
              </div>
              <div className="max-h-56 overflow-y-auto py-1 space-y-1">
                {table
                  .getAllLeafColumns()
                  .filter((col) => col.getCanHide())
                  .map((col) => (
                    <label
                      key={col.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer capitalize text-xs text-foreground"
                    >
                      <input
                        type="checkbox"
                        checked={col.getIsVisible()}
                        onChange={col.getToggleVisibilityHandler()}
                        className="h-3.5 w-3.5 rounded border-border accent-primary cursor-pointer"
                      />
                      <span>{col.id.replace(/([A-Z])/g, ' $1')}</span>
                    </label>
                  ))}
              </div>
              <div className="border-t border-border/60 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsColumnMenuOpen(false)}
                  className="w-full h-7 text-[11px] justify-center"
                >
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Row Selection & Safety Invariant Pill */}
      {selectedRowCount > 0 && (
        <div className="flex items-center justify-between p-2.5 rounded-md bg-primary/10 border border-primary/20 text-xs">
          <div className="flex items-center gap-2">
            <Badge variant="default" className="text-[10px]">
              {selectedRowCount} of {totalRowCount} selected
            </Badge>
            <span className="text-muted-foreground text-[11px]">
              Selection is UI/state only.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-[11px] text-[hsl(var(--success-fg))] font-mono">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Zero auto-send; human gate enforced</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => table.toggleAllRowsSelected(false)}
              className="h-6 text-[11px] px-2 text-muted-foreground hover:text-foreground"
            >
              Deselect All
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
