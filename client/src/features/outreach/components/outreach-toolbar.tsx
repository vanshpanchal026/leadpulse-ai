import React from 'react';
import { CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  FileEdit,
  FileQuestion,
  ArrowUpDown,
  RefreshCw,
  Building2,
} from 'lucide-react';
import { OutreachFilterStatus } from '../types';

interface OutreachToolbarProps {
  filterStatus: OutreachFilterStatus;
  onFilterStatusChange: (status: OutreachFilterStatus) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  tierFilter: string;
  onTierFilterChange: (tier: string) => void;
  sortOrder: 'desc' | 'asc';
  onToggleSortOrder: () => void;
  counts: {
    all: number;
    pending_review: number;
    approved: number;
    rejected: number;
    needs_revision: number;
    missing_draft: number;
  };
  totalFiltered: number;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}

export function OutreachToolbar({
  filterStatus,
  onFilterStatusChange,
  searchQuery,
  onSearchQueryChange,
  tierFilter,
  onTierFilterChange,
  sortOrder,
  onToggleSortOrder,
  counts,
  totalFiltered,
  isRefreshing = false,
  onRefresh,
}: OutreachToolbarProps) {
  return (
    <div className="space-y-3 font-sans">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">
            Outreach Review Queue
          </span>
          <Badge variant="outline" className="font-mono text-xs">
            {totalFiltered} {totalFiltered === 1 ? 'Lead' : 'Leads'}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="h-7 text-xs font-mono text-muted-foreground hover:text-foreground gap-1 px-2"
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleSortOrder}
            className="h-7 text-xs font-mono text-muted-foreground hover:text-foreground gap-1 px-2"
          >
            <ArrowUpDown className="h-3 w-3" />
            <span>Score: {sortOrder === 'desc' ? 'High → Low' : 'Low → High'}</span>
          </Button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
        <button
          onClick={() => onFilterStatusChange('all')}
          className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
            filterStatus === 'all'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          All ({counts.all})
        </button>

        <button
          onClick={() => onFilterStatusChange('pending_review')}
          className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
            filterStatus === 'pending_review'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <Clock className="h-3 w-3" />
          Pending Review ({counts.pending_review})
        </button>

        <button
          onClick={() => onFilterStatusChange('approved')}
          className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
            filterStatus === 'approved'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <CheckCircle2 className="h-3 w-3" />
          Approved ({counts.approved})
        </button>

        <button
          onClick={() => onFilterStatusChange('needs_revision')}
          className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
            filterStatus === 'needs_revision'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <FileEdit className="h-3 w-3" />
          Needs Revision ({counts.needs_revision})
        </button>

        <button
          onClick={() => onFilterStatusChange('rejected')}
          className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
            filterStatus === 'rejected'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <XCircle className="h-3 w-3" />
          Rejected ({counts.rejected})
        </button>

        <button
          onClick={() => onFilterStatusChange('missing_draft')}
          className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${
            filterStatus === 'missing_draft'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
        >
          <FileQuestion className="h-3 w-3" />
          Missing Draft ({counts.missing_draft})
        </button>
      </div>

      {/* Search & Tier Filter Bar */}
      <div className="flex items-center gap-2 pt-1">
        <div className="relative flex-1">
          <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            placeholder="Filter by business name, city, service..."
            aria-label="Filter outreach queue"
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-background border border-input rounded-md text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary font-sans"
          />
        </div>

        <select
          value={tierFilter}
          onChange={(e) => onTierFilterChange(e.target.value)}
          aria-label="Filter by Tier"
          className="px-2.5 py-1.5 text-xs bg-background border border-input rounded-md text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary font-mono transition-colors"
        >
          <option value="all">All Tiers</option>
          <option value="immediate">Immediate (80–100)</option>
          <option value="high">High Potential (60–79)</option>
          <option value="medium">Medium (40–59)</option>
          <option value="low">Low (0–39)</option>
        </select>
      </div>
    </div>
  );
}
