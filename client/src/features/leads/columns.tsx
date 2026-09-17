import React from 'react';
import { Link } from 'react-router-dom';
import { type LegacyColumnDef as ColumnDef } from '@tanstack/react-table/legacy';
import { NormalizedLead } from './types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getOpportunityScoreColor } from '@/lib/utils';
import {
  ArrowUpDown,
  ExternalLink,
  MapPin,
  Flame,
  Globe,
  Phone,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Eye,
} from 'lucide-react';

export const leadColumns: ColumnDef<NormalizedLead>[] = [
  // 1. Selection Checkbox
  {
    id: 'select',
    header: ({ table }) => (
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-border text-primary focus:ring-primary/40 cursor-pointer accent-primary"
        checked={table.getIsAllPageRowsSelected()}
        onChange={(e) => table.toggleAllPageRowsSelected(!!e.target.checked)}
        aria-label="Select all leads on this page"
      />
    ),
    cell: ({ row }) => (
      <input
        type="checkbox"
        className="h-4 w-4 rounded border-border text-primary focus:ring-primary/40 cursor-pointer accent-primary"
        checked={row.getIsSelected()}
        onChange={(e) => row.toggleSelected(!!e.target.checked)}
        aria-label={`Select ${row.original.name}`}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },

  // 2. Business / Lead Name
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 h-8 px-2 text-xs font-medium text-foreground hover:text-foreground hover:bg-secondary"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        <span>Business Name</span>
        <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => {
      const lead = row.original;
      return (
        <div className="space-y-1 min-w-[200px] max-w-[260px]">
          <Link
            to={`/leads/${lead.id}`}
            className="font-medium text-xs text-foreground hover:text-[hsl(var(--primary))] transition-colors block truncate"
            title={lead.name}
          >
            {lead.name}
          </Link>
          <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-muted-foreground">
            <span className="capitalize px-1.5 py-0.5 rounded-sm bg-secondary border border-border font-mono">
              {lead.sourcePlatform.replace('_', ' ')}
            </span>
            {lead.rating && (
              <span className="text-[hsl(var(--warning-fg))] font-medium tabular-nums">
                ★ {lead.rating.toFixed(1)}
                {lead.reviewCount > 0 && ` (${lead.reviewCount})`}
              </span>
            )}
          </div>
        </div>
      );
    },
  },

  // 3. Category / Vertical
  {
    accessorKey: 'category',
    header: 'Vertical',
    cell: ({ row }) => (
      <div className="max-w-[140px] truncate text-xs text-muted-foreground font-medium">
        <Badge variant="outline" className="text-[10px] truncate max-w-full font-normal">
          {row.original.category}
        </Badge>
      </div>
    ),
  },

  // 4. Location
  {
    accessorKey: 'location',
    header: 'Location',
    cell: ({ row }) => {
      const loc = row.original.location;
      return (
        <div className="flex items-center gap-1 text-xs text-muted-foreground max-w-[150px] truncate" title={loc}>
          <MapPin className="h-3 w-3 text-muted-foreground/70 shrink-0" />
          <span className="truncate">{loc}</span>
        </div>
      );
    },
  },

  // 5. Opportunity Score & Tier
  {
    accessorKey: 'opportunityScore',
    header: ({ column }) => (
      <Button
        variant="ghost"
        size="sm"
        className="-ml-2 h-8 px-2 text-xs font-medium text-foreground hover:text-foreground hover:bg-secondary"
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        <span>Opportunity</span>
        <ArrowUpDown className="ml-1 h-3 w-3" />
      </Button>
    ),
    cell: ({ row }) => {
      const score = row.original.opportunityScore;
      const scoreInfo = getOpportunityScoreColor(score);
      return (
        <div className="flex items-center gap-2">
          <div
            className={`px-2 py-0.5 rounded-sm border text-xs font-semibold [font-family:var(--font-display)] tabular-nums ${scoreInfo.bgClass} ${scoreInfo.borderClass} ${scoreInfo.textClass}`}
          >
            {score}/100
          </div>
          <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
            {scoreInfo.label}
          </span>
        </div>
      );
    },
  },

  // 6. Evidence & Research Status
  {
    id: 'evidence',
    header: 'Evidence & Research',
    cell: ({ row }) => {
      const lead = row.original;
      const confPercent = Math.round(lead.confidenceScore * 100);

      return (
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            {lead.observedCount > 0 && (
              <Badge variant="observed" className="text-[11px] px-1.5 py-0.5">
                {lead.observedCount} Verified
              </Badge>
            )}
            {lead.inferredCount > 0 && (
              <Badge variant="inferred" className="text-[11px] px-1.5 py-0.5">
                {lead.inferredCount} Inferred
              </Badge>
            )}
            {lead.unknownCount > 0 && (
              <Badge variant="unknown" className="text-[11px] px-1.5 py-0.5">
                {lead.unknownCount} Unknown
              </Badge>
            )}
            {lead.evidence.length === 0 && (
              <span className="text-muted-foreground font-mono text-xs">No evidence</span>
            )}
          </div>
          {confPercent > 0 && (
            <div className="text-xs text-muted-foreground font-mono tabular-nums">
              Conf: <span className="text-foreground font-medium tabular-nums">{confPercent}%</span>
            </div>
          )}
        </div>
      );
    },
  },

  // 7. Marketing Activity (Active Meta Ads)
  {
    accessorKey: 'hasActiveAds',
    header: 'Marketing Activity',
    cell: ({ row }) => {
      const hasAds = row.original.hasActiveAds;
      return hasAds ? (
        <span className="inline-flex items-center gap-1 bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning-fg))] border border-[hsl(var(--warning-border))] rounded-sm px-1.5 py-0.5 text-[10px] font-medium">
          <Flame className="h-3 w-3 text-[hsl(var(--warning-fg))]" />
          <span>Active Meta Ads</span>
        </span>
      ) : (
        <span className="text-xs text-muted-foreground font-mono">Organic</span>
      );
    },
  },

  // 8. Digital Channels & Contact
  {
    id: 'channels',
    header: 'Channels',
    cell: ({ row }) => {
      const lead = row.original;
      return (
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {lead.websiteUrl ? (
            <a
              href={lead.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded-sm hover:bg-secondary hover:text-foreground transition-colors"
              title={`Website: ${lead.websiteUrl}`}
            >
              <Globe className="h-3.5 w-3.5" />
            </a>
          ) : (
            <span className="opacity-25 p-1">
              <Globe className="h-3.5 w-3.5" />
            </span>
          )}

          {lead.googleMapsUrl && (
            <a
              href={lead.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1 rounded-sm hover:bg-secondary hover:text-foreground transition-colors"
              title="View on Google Maps"
            >
              <MapPin className="h-3.5 w-3.5" />
            </a>
          )}

          {lead.phone && (
            <span className="p-1" title={`Phone: ${lead.phone}`}>
              <Phone className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      );
    },
  },

  // 9. Recommended Service
  {
    accessorKey: 'recommendedService',
    header: 'Recommended Service',
    cell: ({ row }) => (
      <div className="text-xs text-foreground font-medium max-w-[160px] truncate" title={row.original.recommendedService}>
        {row.original.recommendedService.replace(/_/g, ' ')}
      </div>
    ),
  },

  // 10. Actions
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <div className="flex items-center justify-end">
        <Button asChild size="sm" variant="outline" className="h-7 text-xs px-2.5 font-medium gap-1.5 hover:bg-secondary hover:text-foreground">
          <Link to={`/leads/${row.original.id}`}>
            <Eye className="h-3.5 w-3.5" />
            <span>View Profile</span>
          </Link>
        </Button>
      </div>
    ),
    enableSorting: false,
    enableHiding: false,
  },
];
