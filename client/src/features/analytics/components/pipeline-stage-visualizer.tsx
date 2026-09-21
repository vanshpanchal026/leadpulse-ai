import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NormalizedLead } from '@/features/leads/types';
import { ResearchRunRecord } from '@/features/research/types';
import {
  Search,
  Filter,
  Layers,
  Cpu,
  Sparkles,
  ShieldCheck,
  PlusCircle,
  ArrowRight,
} from 'lucide-react';

interface PipelineStageVisualizerProps {
  leads: NormalizedLead[];
  runs?: ResearchRunRecord[];
}

export function PipelineStageVisualizer({ leads, runs = [] }: PipelineStageVisualizerProps) {
  // Empty State Onboarding Card
  if (leads.length === 0) {
    return (
      <Card className="bg-card border-border shadow-xs p-6 md:p-8 rounded-md">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-sm bg-[hsl(var(--info-bg))] text-[hsl(var(--info-fg))] border border-[hsl(var(--info-border))] text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Pipeline Ready for Discovery</span>
            </div>
            <h3 className="text-lg font-medium [font-family:var(--font-display)] text-foreground">
              No leads in pipeline yet
            </h3>
            <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
              Launch a new research campaign to discover and qualify high-intent local prospects with our automated multi-agent crawler swarm.
            </p>
          </div>
          <Button asChild size="lg" className="shrink-0 gap-2 font-medium">
            <Link to="/research">
              <PlusCircle className="h-4 w-4" />
              <span>Start Research Campaign</span>
            </Link>
          </Button>
        </div>
      </Card>
    );
  }

  const stageStats = useMemo(() => {
    const totalDiscovered = leads.length;
    const filtered = leads.filter((l) => l.researchStatus !== 'pending').length;
    const deepResearched = leads.filter(
      (l) => l.researchStatus === 'complete' || l.researchStatus === 'partial'
    ).length;
    const qualified = leads.filter((l) => (l.opportunityScore ?? 0) >= 60).length;
    const awaitingApproval = leads.filter(
      (l) => l.outreachStatus === 'awaiting_human_approval' || l.outreachStatus === 'needs_review'
    ).length;
    const approved = leads.filter((l) => l.outreachStatus === 'approved').length;

    return [
      {
        id: 'discovered',
        label: 'Discovered',
        count: totalDiscovered,
        sub: 'Google Maps & Web',
        icon: Search,
      },
      {
        id: 'filtered',
        label: 'Filtered',
        count: filtered,
        sub: 'Deterministic Triage',
        icon: Filter,
      },
      {
        id: 'researched',
        label: 'Deep Researched',
        count: deepResearched,
        sub: 'Website, Ads & Maps',
        icon: Cpu,
      },
      {
        id: 'qualified',
        label: 'Qualified (≥60)',
        count: qualified,
        sub: 'High Opportunity',
        icon: Sparkles,
      },
      {
        id: 'awaiting',
        label: 'Awaiting Review',
        count: awaitingApproval,
        sub: 'Human Gate Active',
        icon: ShieldCheck,
      },
      {
        id: 'approved',
        label: 'Approved for Dispatch',
        count: approved,
        sub: 'Ready for Manual Send',
        icon: ArrowRight,
      },
    ];
  }, [leads]);

  return (
    <Card className="bg-card border-border shadow-xs rounded-md">
      <CardHeader className="pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-medium [font-family:var(--font-display)] text-foreground">
              Research Pipeline Progression
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Live transition flow from initial discovery to operator approval.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-xs tabular-nums">
            {leads.length} Total Prospects
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {stageStats.map((stage, idx) => {
            const Icon = stage.icon;
            return (
              <div
                key={stage.id}
                className="p-3.5 rounded-md border border-border bg-secondary flex flex-col justify-between transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="p-1.5 rounded-sm bg-card border border-border text-muted-foreground">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground font-medium">
                      0{idx + 1}
                    </span>
                  </div>
                  <div className="text-2xl font-semibold [font-family:var(--font-display)] tabular-nums text-foreground tracking-tight">
                    {stage.count}
                  </div>
                  <div className="text-xs font-medium text-foreground mt-1 truncate">
                    {stage.label}
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground mt-2 truncate">
                  {stage.sub}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
