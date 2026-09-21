import React from 'react';
import { ResearchRunRecord } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Activity,
  Cpu,
  Database,
  Terminal,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Layers,
  Sparkles,
  Zap,
} from 'lucide-react';
import { formatSafeDate } from '@/lib/date';

interface ResearchTelemetryProps {
  run: ResearchRunRecord | null;
  isLoading: boolean;
  isPolling: boolean;
}

export function ResearchTelemetry({
  run,
  isLoading,
  isPolling,
}: ResearchTelemetryProps) {
  if (!run && !isLoading) {
    return (
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-sm">
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Live Research Run Telemetry
          </CardTitle>
        </CardHeader>
        <CardContent className="py-8 text-center text-xs text-muted-foreground">
          <Terminal className="h-6 w-6 mx-auto mb-2 text-muted-foreground opacity-50" />
          <p className="font-medium text-foreground">No active research run selected.</p>
          <p className="text-[11px] mt-1 text-muted-foreground">
            Launch a new campaign above or select a past run from the table below to inspect live telemetry.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading && !run) {
    return (
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm animate-pulse">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="h-5 w-48 bg-muted/40 rounded" />
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <div className="h-16 bg-muted/20 rounded" />
          <div className="h-20 bg-muted/20 rounded" />
        </CardContent>
      </Card>
    );
  }

  const formatTime = (iso?: string | null) => {
    return formatSafeDate(iso, 'HH:mm:ss', 'Pending...');
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return (
          <Badge variant="warning" className="gap-1.5 font-mono text-[10px]">
            <Clock className="h-3 w-3 animate-spin" />
            RUNNING
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="success" className="gap-1.5 font-mono text-[10px]">
            <CheckCircle2 className="h-3 w-3" />
            COMPLETED
          </Badge>
        );
      case 'partial':
        return (
          <Badge variant="warning" className="gap-1.5 font-mono text-[10px]">
            <AlertTriangle className="h-3 w-3" />
            PARTIAL
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1.5 font-mono text-[10px]">
            <AlertTriangle className="h-3 w-3" />
            FAILED
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="font-mono text-[10px]">
            {status.toUpperCase()}
          </Badge>
        );
    }
  };

  return (
    <Card className="border-border bg-card shadow-xs rounded-md">
      <CardHeader className="pb-3 border-b border-border">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium [font-family:var(--font-display)] text-foreground">
              Live Research Run Telemetry
            </CardTitle>
            {isPolling && (
              <span className="flex items-center gap-1.5 text-[10px] bg-[hsl(var(--info-bg))] text-[hsl(var(--info-fg))] border border-[hsl(var(--info-border))] px-2 py-0.5 rounded-sm font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--info))] motion-safe:animate-ping" />
                Polling Active (2.5s)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {run && getStatusBadge(run.status)}
            <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded-sm border border-border">
              ID: {run?.run_id}
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4 text-xs">
        {/* Metric Counters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5">
          <div className="p-2.5 rounded-md bg-secondary border border-border">
            <span className="text-[9px] uppercase font-mono text-muted-foreground block">
              Queries Formulated
            </span>
            <span className="text-lg font-semibold [font-family:var(--font-display)] tabular-nums text-foreground mt-0.5 block">
              {run?.queries_generated ?? 0}
            </span>
          </div>

          <div className="p-2.5 rounded-md bg-secondary border border-border">
            <span className="text-[9px] uppercase font-mono text-muted-foreground block">
              Discovered
            </span>
            <span className="text-lg font-semibold [font-family:var(--font-display)] tabular-nums text-foreground mt-0.5 block">
              {run?.businesses_found ?? 0}
            </span>
          </div>

          <div className="p-2.5 rounded-md bg-secondary border border-border">
            <span className="text-[9px] uppercase font-mono text-muted-foreground block">
              Triaged
            </span>
            <span className="text-lg font-semibold [font-family:var(--font-display)] tabular-nums text-foreground mt-0.5 block">
              {run?.businesses_triaged ?? 0}
            </span>
          </div>

          <div className="p-2.5 rounded-md bg-secondary border border-border">
            <span className="text-[9px] uppercase font-mono text-muted-foreground block">
              Deep Researched
            </span>
            <span className="text-lg font-semibold [font-family:var(--font-display)] tabular-nums text-foreground mt-0.5 block">
              {run?.businesses_researched ?? 0}
            </span>
          </div>

          <div className="p-2.5 rounded-md bg-secondary border border-border">
            <span className="text-[9px] uppercase font-mono text-muted-foreground block">
              Qualified Leads
            </span>
            <span className="text-lg font-semibold [font-family:var(--font-display)] tabular-nums text-[hsl(var(--success-fg))] mt-0.5 block">
              {run?.qualified_leads ?? 0}
            </span>
          </div>

          <div className="p-2.5 rounded-md bg-secondary border border-border">
            <span className="text-[9px] uppercase font-mono text-muted-foreground block">
              Tokens Used
            </span>
            <span className="text-lg font-semibold [font-family:var(--font-display)] tabular-nums text-foreground mt-0.5 block">
              {run?.total_tokens ?? 0}
            </span>
          </div>
        </div>

        {/* Timestamps & Tool Execution Audit */}
        <div className="p-3 rounded-md bg-secondary border border-border grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono tabular-nums text-muted-foreground">
          <div>
            <span>Started: </span>
            <span className="text-foreground">{formatTime(run?.started_at)}</span>
          </div>
          <div>
            <span>Completed: </span>
            <span className="text-foreground">{formatTime(run?.completed_at)}</span>
          </div>
          <div>
            <span>Tool Calls: </span>
            <span className="text-foreground">{run?.tool_calls ?? 0} (Apify: {run?.apify_calls ?? 0})</span>
          </div>
        </div>

        {/* Error / Limitation Alert Banner */}
        {run?.errors && run.errors.length > 0 && (
          <div className="p-3 rounded-md border border-[hsl(var(--warning-border))] bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning-fg))] space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium [font-family:var(--font-display)]">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Reported Limitations & Survived Evidence</span>
            </div>
            {run.errors.map((err, idx) => (
              <p key={idx} className="text-[11px] text-[hsl(var(--warning-fg))]/90 leading-tight">
                • {err.error || JSON.stringify(err)}
              </p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
