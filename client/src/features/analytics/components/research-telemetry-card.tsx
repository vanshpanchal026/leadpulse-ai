import React, { useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ResearchRunRecord } from '@/features/research/types';
import { computeResearchTelemetry } from '../export-utils';
import { Terminal, Globe2, Sparkles, Activity, CheckCircle2 } from 'lucide-react';

interface ResearchTelemetryCardProps {
  runs?: ResearchRunRecord[];
}

export function ResearchTelemetryCard({ runs = [] }: ResearchTelemetryCardProps) {
  const telemetry = useMemo(() => computeResearchTelemetry(runs), [runs]);

  return (
    <Card className="bg-card border-border shadow-xs">
      <CardHeader className="pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium [font-family:var(--font-display)] flex items-center gap-2">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <span>Research Performance & Telemetry</span>
            </CardTitle>
            <CardDescription className="text-xs">
              Deterministic runtime resource usage across Python AI worker swarms.
            </CardDescription>
          </div>
          <Badge variant="success" className="text-[10px] font-mono font-medium">
            Online & Synced
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-4 gap-3">
          <div className="p-3 rounded-md bg-secondary border border-border">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Total Tokens</span>
            </div>
            <div className="text-2xl font-semibold tracking-tight tabular-nums [font-family:var(--font-display)] text-foreground">
              {telemetry.totalTokens.toLocaleString()}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Prompt + Completion</div>
          </div>

          <div className="p-3 rounded-md bg-secondary border border-border">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Tool Calls</span>
            </div>
            <div className="text-2xl font-semibold tracking-tight tabular-nums [font-family:var(--font-display)] text-foreground">
              {telemetry.totalToolCalls}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Specialist invocations</div>
          </div>

          <div className="p-3 rounded-md bg-secondary border border-border">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Apify Calls</span>
            </div>
            <div className="text-2xl font-semibold tracking-tight tabular-nums [font-family:var(--font-display)] text-foreground">
              {telemetry.totalApifyCalls}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Maps + Ads + Scrapes</div>
          </div>

          <div className="p-3 rounded-md bg-secondary border border-border">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
              <span>Success Rate</span>
            </div>
            <div className="text-2xl font-semibold tracking-tight tabular-nums [font-family:var(--font-display)] text-foreground">
              {telemetry.totalRuns > 0
                ? `${Math.round(((telemetry.totalRuns - telemetry.failedRuns) / telemetry.totalRuns) * 100)}%`
                : '100%'}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
              {telemetry.completedRuns} completed / {telemetry.totalRuns} runs
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
