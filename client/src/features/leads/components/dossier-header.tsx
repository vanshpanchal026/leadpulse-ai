import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { NormalizedLead } from '../types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getOpportunityScoreColor, formatPercent } from '@/lib/utils';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Building2,
  Share2,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
} from 'lucide-react';

interface DossierHeaderProps {
  lead: NormalizedLead;
  prevLeadId?: string | null;
  nextLeadId?: string | null;
  currentIndex?: number;
  totalLeads?: number;
}

export function DossierHeader({
  lead,
  prevLeadId,
  nextLeadId,
  currentIndex,
  totalLeads,
}: DossierHeaderProps) {
  const navigate = useNavigate();
  const rawScore = lead.opportunityScore ?? 0;
  const oppScore = rawScore <= 10 ? rawScore * 10 : rawScore;
  const scoreColors = getOpportunityScoreColor(oppScore);

  const getStatusBadge = () => {
    switch (lead.researchStatus) {
      case 'complete':
        return (
          <Badge variant="success" className="gap-1 text-xs">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Research Complete
          </Badge>
        );
      case 'partial':
        return (
          <Badge variant="warning" className="gap-1 text-xs">
            <Clock className="h-3.5 w-3.5" />
            Partial Research
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1 text-xs">
            <AlertTriangle className="h-3.5 w-3.5" />
            Research Failed
          </Badge>
        );
      case 'pending':
      default:
        return (
          <Badge variant="secondary" className="gap-1 text-xs">
            <Clock className="h-3.5 w-3.5" />
            Research Pending
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Top action & navigation bar with breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium">
            <Link to="/leads">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Leads
            </Link>
          </Button>

          {/* Breadcrumbs trail */}
          <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">
              Home
            </Link>
            <span>/</span>
            <Link to="/leads" className="hover:text-foreground transition-colors">
              Leads
            </Link>
            <span>/</span>
            <span className="font-semibold text-foreground truncate max-w-[200px]">
              {lead.name}
            </span>
          </nav>

          {totalLeads && totalLeads > 0 && typeof currentIndex === 'number' && currentIndex >= 0 && (
            <span className="text-xs text-muted-foreground font-mono ml-1">
              ({currentIndex + 1} of {totalLeads})
            </span>
          )}
        </div>

        {/* Prev / Next lead navigation */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1 font-medium"
            disabled={!prevLeadId}
            onClick={() => prevLeadId && navigate(`/leads/${prevLeadId}`)}
            title={prevLeadId ? 'Navigate to previous lead' : 'No previous lead'}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1 font-medium"
            disabled={!nextLeadId}
            onClick={() => nextLeadId && navigate(`/leads/${nextLeadId}`)}
            title={nextLeadId ? 'Navigate to next lead' : 'No next lead'}
          >
            Next
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Main Identity Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-5 rounded-md border border-border shadow-xs">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold [font-family:var(--font-display)] tracking-tight text-foreground">
              {lead.name}
            </h1>
            {getStatusBadge()}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium text-foreground">{lead.category}</span>
            </div>
            <div className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{lead.location}</span>
            </div>
            <div className="font-mono text-xs text-muted-foreground">
              ID: {lead.id}
            </div>
          </div>
        </div>

        {/* Score & Tier Indicators */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Opportunity Score Indicator */}
          <div className={`flex flex-col items-center justify-center px-4 py-2 rounded-md border ${scoreColors.bgClass} ${scoreColors.borderClass}`}>
            <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">
              Opportunity Score
            </span>
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-semibold [font-family:var(--font-display)] tabular-nums ${scoreColors.textClass}`}>
                {oppScore}
              </span>
              <span className="text-xs text-muted-foreground font-mono">/100</span>
            </div>
          </div>

          {/* Tier & Confidence Badges */}
          <div className="flex flex-col gap-1.5 justify-center">
            <Badge
              variant="outline"
              className={`text-xs px-2.5 py-1 font-medium justify-center ${scoreColors.borderClass} ${scoreColors.textClass}`}
            >
              {lead.opportunityTier} Priority
            </Badge>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary px-2.5 py-1 rounded-sm border border-border">
              <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Confidence:</span>
              <span className="font-mono font-medium text-foreground tabular-nums">
                {formatPercent(lead.confidenceScore)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
