import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Clock, CheckCircle2, XCircle, FileEdit, FileQuestion, Flame, Sparkles } from 'lucide-react';
import { OutreachItem, OutreachFilterStatus } from '../types';
import { OutreachToolbar } from './outreach-toolbar';
import { OutreachEmptyState } from './outreach-empty-state';
import { validateDraftQuality } from '../schema';
import { getOpportunityScoreColor } from '@/lib/utils';

interface OutreachQueueProps {
  items: OutreachItem[];
  selectedId: string | null;
  onSelectLead: (id: string) => void;
  isRefreshing?: boolean;
  onRefresh?: () => void;
}

export function OutreachQueue({
  items,
  selectedId,
  onSelectLead,
  isRefreshing = false,
  onRefresh,
}: OutreachQueueProps) {
  const [filterStatus, setFilterStatus] = useState<OutreachFilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Tab counts
  const counts = useMemo(() => {
    return {
      all: items.length,
      pending_review: items.filter(
        (i) => i.approvalStatus === 'awaiting_human_approval' && i.hasDraft
      ).length,
      approved: items.filter((i) => i.approvalStatus === 'approved').length,
      rejected: items.filter((i) => i.approvalStatus === 'rejected').length,
      needs_revision: items.filter((i) => i.approvalStatus === 'needs_revision').length,
      missing_draft: items.filter((i) => !i.hasDraft).length,
    };
  }, [items]);

  // Filtered and sorted items
  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        // Status filter (supports pending_review / needs_review)
        if (filterStatus === 'pending_review' || (filterStatus as string) === 'needs_review') {
          if (item.approvalStatus !== 'awaiting_human_approval' || !item.hasDraft)
            return false;
        } else if (filterStatus === 'approved') {
          if (item.approvalStatus !== 'approved') return false;
        } else if (filterStatus === 'rejected') {
          if (item.approvalStatus !== 'rejected') return false;
        } else if (filterStatus === 'needs_revision') {
          if (item.approvalStatus !== 'needs_revision') return false;
        } else if (filterStatus === 'missing_draft') {
          if (item.hasDraft) return false;
        }

        // Tier filter
        if (tierFilter !== 'all') {
          if (tierFilter === 'immediate' && item.opportunityTier !== 'Immediate') return false;
          if (tierFilter === 'high' && item.opportunityTier !== 'High Potential') return false;
          if (tierFilter === 'medium' && item.opportunityTier !== 'Medium') return false;
          if (tierFilter === 'low' && item.opportunityTier !== 'Low') return false;
        }

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = item.businessName.toLowerCase().includes(q);
          const matchLoc = item.location.toLowerCase().includes(q);
          const matchService = item.recommendedService.toLowerCase().includes(q);
          const matchProblem = item.primaryProblem.toLowerCase().includes(q);
          const matchPhone = item.phone ? item.phone.includes(q) : false;
          if (!matchName && !matchLoc && !matchService && !matchProblem && !matchPhone)
            return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortOrder === 'desc') {
          return b.opportunityScore - a.opportunityScore;
        } else {
          return a.opportunityScore - b.opportunityScore;
        }
      });
  }, [items, filterStatus, tierFilter, searchQuery, sortOrder]);

  return (
    <Card className="border-border bg-card shadow-xs rounded-md flex flex-col h-full font-sans">
      <CardHeader className="pb-3 border-b border-border">
        <h2 className="sr-only">Outreach Approval Queue</h2>
        <OutreachToolbar
          filterStatus={filterStatus}
          onFilterStatusChange={setFilterStatus}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          tierFilter={tierFilter}
          onTierFilterChange={setTierFilter}
          sortOrder={sortOrder}
          onToggleSortOrder={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
          counts={counts}
          totalFiltered={filteredItems.length}
          isRefreshing={isRefreshing}
          onRefresh={onRefresh}
        />
      </CardHeader>

      <CardContent className="p-0 flex-1 overflow-y-auto divide-y divide-border max-h-[720px]">
        {filteredItems.length === 0 ? (
          <div className="p-6">
            <OutreachEmptyState
              title="No leads in queue"
              description="No outreach drafts match your selected filter criteria. Try selecting 'All' or clearing your search keywords."
              icon="filter"
            />
          </div>
        ) : (
          filteredItems.map((item) => {
            const isSelected = item.id === selectedId;
            const scoreInfo = getOpportunityScoreColor(item.opportunityScore);
            const quality = item.hasDraft
              ? validateDraftQuality(item.draftMessage, item.businessName)
              : null;

            return (
              <div
                key={item.id}
                onClick={() => onSelectLead(item.id)}
                className={`p-3.5 cursor-pointer transition-colors flex items-start justify-between gap-3 ${
                  isSelected
                    ? 'bg-secondary/80 border-l-2 border-l-[hsl(var(--primary))]'
                    : 'border-l-2 border-l-transparent hover:bg-secondary/40'
                }`}
              >
                <div className="space-y-2 min-w-0 flex-1 text-xs">
                  {/* Row 1: Name, Score badge, Review Priority */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm text-foreground truncate">
                      {item.businessName}
                    </span>
                    <div
                      className={`px-2 py-0.5 rounded-sm border text-xs font-semibold [font-family:var(--font-display)] tabular-nums ${scoreInfo.bgClass} ${scoreInfo.borderClass} ${scoreInfo.textClass}`}
                    >
                      {item.opportunityScore > 10 ? item.opportunityScore : item.opportunityScore * 10}/100
                    </div>

                    {item.reviewPriority === 'high' && (
                      <Badge variant="info" className="text-[10px] px-1.5 py-0.5 font-mono">
                        High Priority
                      </Badge>
                    )}
                  </div>

                  {/* Row 2: Location, Service, Primary Problem */}
                  <div className="text-xs text-muted-foreground font-mono truncate">
                    <span>{item.location || 'NCR'}</span>
                    <span className="mx-1.5">•</span>
                    <span className="text-foreground font-medium">{item.recommendedService}</span>
                  </div>

                  <p className="text-xs text-foreground line-clamp-1">
                    <span className="text-muted-foreground font-medium">Problem: </span>
                    {item.primaryProblem}
                  </p>

                  {/* Row 3: Snippet quote */}
                  {item.hasDraft && (
                    <p className="text-xs text-muted-foreground line-clamp-1 italic bg-secondary px-2.5 py-1 rounded-sm border border-border font-sans">
                      &ldquo;{item.draftMessage}&rdquo;
                    </p>
                  )}

                  {/* Row 4: Status Badges, Updated timestamp, Quality status */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs font-mono">
                    {/* Approval Status Badge */}
                    {item.approvalStatus === 'approved' && (
                      <Badge variant="success" className="px-2 py-0.5 text-xs">
                        Approved
                      </Badge>
                    )}
                    {item.approvalStatus === 'rejected' && (
                      <Badge variant="destructive" className="px-2 py-0.5 text-xs">
                        Disqualified
                      </Badge>
                    )}
                    {item.approvalStatus === 'needs_revision' && (
                      <Badge variant="warning" className="px-2 py-0.5 text-xs">
                        Needs Revision
                      </Badge>
                    )}
                    {item.approvalStatus === 'awaiting_human_approval' && item.hasDraft && (
                      <Badge variant="secondary" className="px-2 py-0.5 text-xs">
                        Pending Review
                      </Badge>
                    )}
                    {!item.hasDraft && (
                      <Badge variant="secondary" className="px-2 py-0.5 text-xs">
                        Missing Draft
                      </Badge>
                    )}

                    {/* Pre-Send Quality Badge */}
                    {quality && (
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant={
                            quality.level === 'PASS'
                              ? 'success'
                              : quality.level === 'WARNING'
                              ? 'warning'
                              : 'destructive'
                          }
                          className="px-1.5 py-0.5 text-[10px]"
                        >
                          {quality.level}
                        </Badge>
                        <span className="text-muted-foreground tabular-nums text-[10px]">
                          {quality.characterCount} ch
                        </span>
                      </div>
                    )}

                    {/* Timestamp */}
                    <span className="text-muted-foreground ml-auto truncate text-xs tabular-nums">
                      {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : 'Active'}
                    </span>
                  </div>
                </div>

                <ChevronRight
                  className={`h-4 w-4 shrink-0 mt-2 transition-transform ${
                    isSelected ? 'text-foreground translate-x-0.5' : 'text-muted-foreground/40'
                  }`}
                />
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
