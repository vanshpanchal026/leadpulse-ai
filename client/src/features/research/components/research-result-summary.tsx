import React from 'react';
import { Link } from 'react-router-dom';
import { ResearchRunRecord } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  Building2,
  Sparkles,
} from 'lucide-react';

interface ResultSummaryProps {
  run: ResearchRunRecord | null;
}

export function ResearchResultSummary({ run }: ResultSummaryProps) {
  if (!run) return null;

  const isComplete = run.status === 'completed' || run.status === 'partial';
  if (!isComplete) return null;

  const conversionRate =
    run.businesses_found > 0
      ? Math.round((run.qualified_leads / run.businesses_found) * 100)
      : 0;

  return (
    <Card className="border-border bg-card shadow-xs rounded-md">
      <CardHeader className="pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium [font-family:var(--font-display)] flex items-center gap-2 text-foreground">
            <CheckCircle2 className="h-4 w-4 text-[hsl(var(--success-fg))]" />
            Research Campaign Summary & Conversion
          </CardTitle>
          <Badge variant="success" className="font-mono text-[10px]">
            {run.status.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4 text-xs">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-md bg-secondary border border-border">
            <span className="text-[10px] text-muted-foreground uppercase font-mono block">
              Discovered Candidates
            </span>
            <span className="text-xl font-semibold [font-family:var(--font-display)] tabular-nums text-foreground mt-0.5 block">
              {run.businesses_found}
            </span>
          </div>

          <div className="p-3 rounded-md bg-secondary border border-border">
            <span className="text-[10px] text-muted-foreground uppercase font-mono block">
              Pre-Filtered / Duplicates
            </span>
            <span className="text-xl font-semibold [font-family:var(--font-display)] tabular-nums text-foreground mt-0.5 block">
              {run.businesses_filtered}
            </span>
          </div>

          <div className="p-3 rounded-md bg-secondary border border-border">
            <span className="text-[10px] text-muted-foreground uppercase font-mono block">
              Specialist Researched
            </span>
            <span className="text-xl font-semibold [font-family:var(--font-display)] tabular-nums text-foreground mt-0.5 block">
              {run.businesses_researched}
            </span>
          </div>

          <div className="p-3 rounded-md bg-secondary border border-border">
            <span className="text-[10px] text-muted-foreground uppercase font-mono block">
              High-Fit Qualified Leads
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-xl font-semibold [font-family:var(--font-display)] tabular-nums text-[hsl(var(--success-fg))]">
                {run.qualified_leads}
              </span>
              <span className="text-xs font-mono text-muted-foreground tabular-nums">
                ({conversionRate}% yield)
              </span>
            </div>
          </div>
        </div>

        <div className="p-3.5 rounded-md bg-secondary border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="font-medium text-foreground text-xs flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Qualified Leads Ready for Intelligence Review</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              All researched records are persisted to Supabase and queryable in the Leads Intelligence Workspace.
            </p>
          </div>

          <Button asChild size="sm" className="gap-1.5 text-xs shrink-0 font-medium active:scale-[0.99] active:translate-y-px">
            <Link to="/leads">
              <span>View In Leads Workspace</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
