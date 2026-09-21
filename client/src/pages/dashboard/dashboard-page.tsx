import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLeadsQuery } from '@/features/leads';
import { useOutreachRecordsQuery } from '@/features/outreach';
import { useResearchRunsQuery } from '@/features/research';
import {
  ScoreDistributionChart,
  ServiceDistributionChart,
  GeographicDistributionChart,
  ResearchFunnelChart,
  ResearchTelemetryCard,
  PipelineStageVisualizer,
  RecentOpportunitiesTable,
  exportLeadsToExcel,
} from '@/features/analytics';
import {
  Users,
  FlaskConical,
  Send,
  ShieldCheck,
  TrendingUp,
  Cpu,
  ArrowRight,
  Sparkles,
  RefreshCw,
  FileSpreadsheet,
  CheckCircle2,
  BarChart3,
  PieChart,
  Globe2,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { LiveThinkingHud } from '@/components/agent/live-thinking-hud';

export function DashboardPage() {
  // Parallel data fetching using React Query client
  const leadsQuery = useLeadsQuery();
  const outreachQuery = useOutreachRecordsQuery();
  const runsQuery = useResearchRunsQuery(10);

  const leads = leadsQuery.data || [];
  const outreachRecords = outreachQuery.data || [];
  const runs = runsQuery.data?.items || [];
  const isFetching = leadsQuery.isFetching || outreachQuery.isFetching || runsQuery.isFetching;

  const stats = useMemo(() => {
    const totalDiscovered = leads.length;
    const qualifiedLeads = leads.filter((l) => {
      const score = (l.opportunityScore ?? 0) <= 10 ? (l.opportunityScore ?? 0) * 10 : (l.opportunityScore ?? 0);
      return score >= 60;
    }).length;
    const immediate = leads.filter((l) => {
      const score = (l.opportunityScore ?? 0) <= 10 ? (l.opportunityScore ?? 0) * 10 : (l.opportunityScore ?? 0);
      return score >= 80;
    }).length;

    const researchInProgress = leads.filter(
      (l) => l.researchStatus === 'partial'
    ).length;

    const researchCompleted = leads.filter(
      (l) => l.researchStatus === 'complete'
    ).length;

    const pendingOutreach =
      outreachRecords.filter((r) => r.approval_status === 'awaiting_human_approval').length ||
      leads.filter((l) => l.outreachStatus === 'awaiting_human_approval' || l.outreachStatus === 'needs_review').length;

    const outreachApproved =
      outreachRecords.filter((r) => r.approval_status === 'approved').length ||
      leads.filter((l) => l.outreachStatus === 'approved').length;

    const enrichedPct = totalDiscovered > 0 ? Math.round((researchCompleted / totalDiscovered) * 100) : 0;

    return {
      totalDiscovered,
      qualifiedLeads,
      immediate,
      researchInProgress,
      researchCompleted,
      pendingOutreach,
      outreachApproved,
      enrichedPct,
    };
  }, [leads, outreachRecords]);

  const handleRefresh = () => {
    leadsQuery.refetch();
    outreachQuery.refetch();
    runsQuery.refetch();
    toast.success('Live dashboard telemetry refreshed');
  };

  const handleExcelExport = () => {
    if (leads.length === 0) {
      toast.error('No lead data available for export');
      return;
    }
    const result = exportLeadsToExcel(leads, 'leadpulse_campaign_intelligence');
    if (result.success) {
      toast.success(`Exported ${result.rowCount} leads to ${result.filename}`);
    } else {
      toast.error('Failed to generate Excel export');
    }
  };

  if (leadsQuery.isError && leads.length === 0) {
    return (
      <div className="space-y-6 w-full">
        <PageHeader
          title="Campaign Command Center"
          description="Autonomous multi-agent research pipeline orchestrating niche search, specialist audits, and human-gated outreach."
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Dashboard' }]}
          badge={<Badge variant="destructive" className="text-xs">Backend Offline</Badge>}
        />
        <Card className="border-[hsl(var(--destructive-border))] bg-[hsl(var(--destructive-bg))] p-12 text-center space-y-4">
          <AlertCircle className="h-10 w-10 text-destructive mx-auto" />
          <h3 className="text-base font-medium text-foreground [font-family:var(--font-display)]">Dashboard Telemetry Offline</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {leadsQuery.error instanceof Error ? leadsQuery.error.message : 'Unable to connect to local API or Supabase database. Please verify local services.'}
          </p>
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button onClick={handleRefresh} size="sm" className="gap-1.5 font-medium" aria-label="Retry connection">
              <RefreshCw className="h-3.5 w-3.5" />
              Retry Connection
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* 
        NON-NEGOTIABLE SAFETY INVARIANT:
        external_send_executed = false
        The system enforces zero automated messaging. A human operator reviews, edits, and approves drafts.
      */}
      {/* Hero Control Bar */}
      <PageHeader
        title="Campaign Command Center"
        description="Autonomous multi-agent research pipeline orchestrating niche discovery, specialist audits, and human-gated outreach."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Dashboard' }]}
        badge={
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border border-[hsl(var(--success-border))] bg-[hsl(var(--success-bg))] text-[hsl(var(--success-fg))] text-xs font-medium">
            <span className="relative flex h-2 w-2">
              <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-[hsl(var(--success))] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[hsl(var(--success))]"></span>
            </span>
            <span>3 Active Specialists Running</span>
          </div>
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExcelExport}
              className="h-8 gap-1.5 text-xs font-medium"
              title="Export all leads to Excel (.xlsx)"
              aria-label="Export all leads to Excel (.xlsx)"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Export Leads (.xlsx)</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isFetching}
              className="h-8 gap-1.5 text-xs font-medium"
              title="Refresh telemetry data"
              aria-label="Refresh telemetry data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'motion-safe:animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-medium">
              <Link to="/leads">
                <Users className="h-3.5 w-3.5" />
                <span>View Leads</span>
              </Link>
            </Button>
            <Button asChild size="sm" className="h-8 gap-1.5 text-xs font-medium shadow-xs">
              <Link to="/research">
                <FlaskConical className="h-3.5 w-3.5" />
                <span>+ New Campaign</span>
              </Link>
            </Button>
          </div>
        }
      />

      {/* Real-Time AI Agent Swarm & Thinking Stream Telemetry HUD */}
      <LiveThinkingHud />

      {/* 4 Executive Metric Cards (Desktop 4-column) */}
      <div className="grid grid-cols-4 gap-4">
        {/* Card 1: Total Prospects Discovered */}
        <Link to="/leads" className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
          <Card className="p-4 border-border bg-card shadow-xs group-hover:border-[hsl(var(--border-strong))] group-hover:shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono tracking-[0.08em] text-muted-foreground font-medium">
                Total Prospects
              </span>
              <div className="w-8 h-8 rounded-md bg-secondary text-muted-foreground flex items-center justify-center border border-border">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-semibold tracking-tight tabular-nums [font-family:var(--font-display)] text-foreground mt-2">
              {leadsQuery.isLoading ? '...' : stats.totalDiscovered}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2 font-medium">
              <span className="text-[hsl(var(--success-fg))] font-medium">{stats.enrichedPct}% Enriched</span>
              <span>•</span>
              <span>{stats.researchCompleted} verified dossiers</span>
            </div>
          </Card>
        </Link>

        {/* Card 2: High-Intent Opportunities */}
        <Link to="/leads" className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
          <Card className="p-4 border-border bg-card shadow-xs group-hover:border-[hsl(var(--border-strong))] group-hover:shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono tracking-[0.08em] text-muted-foreground font-medium">
                High-Intent Leads
              </span>
              <div className="w-8 h-8 rounded-md bg-secondary text-muted-foreground flex items-center justify-center border border-border">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-semibold tracking-tight tabular-nums [font-family:var(--font-display)] text-foreground mt-2">
              {leadsQuery.isLoading ? '...' : stats.immediate}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2 font-medium">
              <span className="font-medium text-foreground">Score ≥ 80/100</span>
              <span>•</span>
              <span>{stats.qualifiedLeads} qualified (≥60)</span>
            </div>
          </Card>
        </Link>

        {/* Card 3: Awaiting Operator Review */}
        <Link to="/outreach" className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
          <Card className="p-4 border-border bg-card shadow-xs group-hover:border-[hsl(var(--border-strong))] group-hover:shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono tracking-[0.08em] text-muted-foreground font-medium">
                Awaiting Review
              </span>
              <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center border border-border">
                <ShieldCheck className="h-4 w-4 text-[hsl(var(--warning))]" />
              </div>
            </div>
            <div className="text-3xl font-semibold tracking-tight tabular-nums [font-family:var(--font-display)] text-[hsl(var(--warning))] mt-2">
              {outreachQuery.isLoading ? '...' : stats.pendingOutreach}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--warning-fg))] mt-2 font-medium">
              <span>Human review boundary active</span>
            </div>
          </Card>
        </Link>

        {/* Card 4: Approved for Dispatch */}
        <Link to="/outreach" className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
          <Card className="p-4 border-border bg-card shadow-xs group-hover:border-[hsl(var(--border-strong))] group-hover:shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-mono tracking-[0.08em] text-muted-foreground font-medium">
                Approved for Send
              </span>
              <div className="w-8 h-8 rounded-md bg-secondary text-muted-foreground flex items-center justify-center border border-border">
                <Send className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-semibold tracking-tight tabular-nums [font-family:var(--font-display)] text-foreground mt-2">
              {outreachQuery.isLoading ? '...' : stats.outreachApproved}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--success))]" />
              <span>WhatsApp manual send ready</span>
            </div>
          </Card>
        </Link>
      </div>

      {/* Research Pipeline Topology Stage Visualizer */}
      <PipelineStageVisualizer leads={leads} runs={runs} />

      {/* 2 Balanced Visualizations (Side by Side) */}
      <div className="grid grid-cols-2 gap-4">
        {/* Opportunity Score Distribution */}
        <Card className="bg-card border-border shadow-xs">
          <CardHeader className="pb-2 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <span>Opportunity Score Distribution</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Breakdown by commercial friction, booking maturity, and readiness.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-mono">
                Tiers (0–100)
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <ScoreDistributionChart leads={leads} />
          </CardContent>
        </Card>

        {/* Recommended Service Opportunities */}
        <Card className="bg-card border-border shadow-xs">
          <CardHeader className="pb-2 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <PieChart className="h-4 w-4 text-muted-foreground" />
                  <span>Recommended Automation Services</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Synthesized client solutions based on identified booking bottlenecks.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-mono">
                Services
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <ServiceDistributionChart leads={leads} />
          </CardContent>
        </Card>

        {/* Research Conversion Yield Funnel */}
        <Card className="bg-card border-border shadow-xs">
          <CardHeader className="pb-2 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  <span>Research Conversion Funnel</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Sequential qualification drop-offs from raw discoveries to approved pitches.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-mono">
                Funnel
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <ResearchFunnelChart leads={leads} runs={runs} />
          </CardContent>
        </Card>

        {/* Geographic Micro-Market Breakdown */}
        <Card className="bg-card border-border shadow-xs">
          <CardHeader className="pb-2 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Globe2 className="h-4 w-4 text-muted-foreground" />
                  <span>Geographic Distribution (Delhi NCR)</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Lead concentration and average opportunity score across territory nodes.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-mono">
                Territory
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <GeographicDistributionChart leads={leads} />
          </CardContent>
        </Card>
      </div>

      {/* Research Performance Telemetry */}
      <ResearchTelemetryCard runs={runs} />

      {/* Recent High-Value Opportunities Table */}
      <RecentOpportunitiesTable leads={leads} limit={5} />

      {/* Multi-Agent Swarm Architecture Blueprint */}
      <Card className="border-border bg-card shadow-xs">
        <CardHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium">LeadPulse Multi-Agent Swarm Architecture</CardTitle>
              <CardDescription className="text-xs">
                Deterministic control boundaries enclosing specialized LLM reasoning agents.
              </CardDescription>
            </div>
            <Badge variant="success" className="text-xs">Swarm Ready</Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-4 gap-3">
            <div className="p-3.5 rounded-md border border-border bg-secondary space-y-1.5">
              <div className="flex items-center gap-2 font-mono text-xs font-medium text-foreground">
                <FlaskConical className="h-3.5 w-3.5 text-muted-foreground" />
                1. Discovery & Search
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Search Strategist autonomously builds targeted local queries for high-ticket service verticals.
              </p>
            </div>

            <div className="p-3.5 rounded-md border border-border bg-secondary space-y-1.5">
              <div className="flex items-center gap-2 font-mono text-xs font-medium text-foreground">
                <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                2. Triage & Specialists
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Fast cost-optimized triage routes candidates to parallel Website, Meta Ads, and Maps specialists.
              </p>
            </div>

            <div className="p-3.5 rounded-md border border-border bg-secondary space-y-1.5">
              <div className="flex items-center gap-2 font-mono text-xs font-medium text-foreground">
                <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                3. Opportunity Synthesis
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Opportunity Agent scores commercial maturity and synthesizes high-conversion pitch angles.
              </p>
            </div>

            <div className="p-3.5 rounded-md border border-border bg-secondary space-y-1.5">
              <div className="flex items-center gap-2 font-mono text-xs font-medium text-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
                4. Human Review Gate
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Anti-spam checks enforce quality. Operators review and dispatch all outreach manually.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t border-border justify-between">
          <span className="text-xs text-muted-foreground font-mono">
            Safety Invariant: Human-Only Send Mode Active
          </span>
          <Button asChild variant="ghost" size="sm" className="text-xs font-medium">
            <Link to="/research" className="flex items-center gap-1.5">
              <span>Configure Research Swarm</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
