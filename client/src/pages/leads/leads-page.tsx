import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useLeadsQuery } from '@/features/leads';
import { LeadsTable } from '@/features/leads';
import { exportLeadsToExcel } from '@/features/analytics';
import { toast } from 'sonner';
import {
  Users,
  TrendingUp,
  Flame,
  ShieldCheck,
  RefreshCw,
  FlaskConical,
  Database,
  FileSpreadsheet,
} from 'lucide-react';

export function LeadsPage() {
  const { data: leads = [], isLoading, isError, error, refetch, isFetching } = useLeadsQuery();
  const [selectedService, setSelectedService] = useState<string>('all');

  // Service Counts & Filtering
  const serviceCounts = useMemo(() => {
    return {
      all: leads.length,
      website_development: leads.filter((l) => l.recommendedService === 'website_development').length,
      booking_automation: leads.filter((l) => l.recommendedService === 'booking_automation').length,
      whatsapp_automation: leads.filter((l) => l.recommendedService === 'whatsapp_automation').length,
      lead_automation: leads.filter((l) => l.recommendedService === 'lead_automation').length,
      ai_agents: leads.filter((l) => l.recommendedService === 'ai_agents').length,
      crm_workflow_automation: leads.filter((l) => l.recommendedService === 'crm_workflow_automation').length,
      business_automation: leads.filter((l) => l.recommendedService === 'business_automation').length,
    };
  }, [leads]);

  const filteredLeads = useMemo(() => {
    if (selectedService === 'all') return leads;
    return leads.filter((l) => (l.recommendedService || '').toLowerCase() === selectedService.toLowerCase());
  }, [leads, selectedService]);

  // Metrics summary
  const metrics = useMemo(() => {
    let immediate = 0;
    let high = 0;
    let withAds = 0;

    filteredLeads.forEach((l) => {
      if (l.opportunityScore >= 80) immediate++;
      else if (l.opportunityScore >= 60) high++;

      if (l.hasActiveAds) withAds++;
    });

    return {
      total: filteredLeads.length,
      immediate,
      high,
      withAds,
    };
  }, [filteredLeads]);

  const handleExcelExport = () => {
    if (leads.length === 0) {
      toast.error('No lead data available to export');
      return;
    }
    const result = exportLeadsToExcel(leads, 'leadpulse_leads_directory');
    if (result.success) {
      toast.success(`Exported ${result.rowCount} leads to ${result.filename}`);
    } else {
      toast.error('Failed to export leads to Excel');
    }
  };

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        title="Leads Intelligence Workspace"
        description="High-density candidate directory enriched by Multi-Agent Specialist Swarm and Opportunity Agent."
        // Table rows and view actions route directly to individual dossiers at /leads/:leadId
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Leads Intelligence', href: '/leads' }]}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExcelExport}
              className="h-8 text-xs gap-1.5 font-medium"
              title="Export leads to Excel (.xlsx)"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Export Excel</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-8 text-xs font-medium"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} />
              {isFetching ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button asChild size="sm" className="h-8 text-xs font-medium">
              <Link to="/research" className="flex items-center gap-1.5">
                <FlaskConical className="h-3.5 w-3.5" />
                <span>New Campaign</span>
              </Link>
            </Button>
          </div>
        }
      />

      {/* Top Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border shadow-xs rounded-md">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-medium tracking-wider text-muted-foreground">Total Discovered</CardDescription>
            <CardTitle className="text-2xl font-semibold [font-family:var(--font-display)] tabular-nums flex items-center justify-between text-foreground">
              <span>{isLoading ? '...' : metrics.total}</span>
              <span className="p-2 rounded-sm bg-secondary border border-border text-muted-foreground">
                <Users className="h-4 w-4" />
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            <span className="text-foreground font-medium tabular-nums">100%</span> validated records
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-xs rounded-md">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-medium tracking-wider text-muted-foreground">Immediate Priority (≥80)</CardDescription>
            <CardTitle className="text-2xl font-semibold [font-family:var(--font-display)] tabular-nums flex items-center justify-between text-foreground">
              <span>{isLoading ? '...' : metrics.immediate}</span>
              <span className="p-2 rounded-sm bg-secondary border border-border text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            Highest conversion friction + maturity
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-xs rounded-md">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-medium tracking-wider text-muted-foreground">High Potential (60–79)</CardDescription>
            <CardTitle className="text-2xl font-semibold [font-family:var(--font-display)] tabular-nums flex items-center justify-between text-foreground">
              <span>{isLoading ? '...' : metrics.high}</span>
              <span className="p-2 rounded-sm bg-secondary border border-border text-muted-foreground">
                <TrendingUp className="h-4 w-4" />
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            Strong candidates ready for specialist audit
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-xs rounded-md">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase font-medium tracking-wider text-muted-foreground">Active Meta Ads</CardDescription>
            <CardTitle className="text-2xl font-semibold [font-family:var(--font-display)] tabular-nums flex items-center justify-between text-foreground">
              <span>{isLoading ? '...' : metrics.withAds}</span>
              <span className="p-2 rounded-sm bg-[hsl(var(--warning-bg))] border border-[hsl(var(--warning-border))] text-[hsl(var(--warning-fg))]">
                <Flame className="h-4 w-4" />
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-xs text-muted-foreground">
            Verified ad spend in Meta Ad Library
          </CardContent>
        </Card>
      </div>

      {/* 7 Canonical Services Filter Bar */}
      <div className="flex items-center gap-1.5 flex-wrap p-1.5 rounded-md border border-border bg-card shadow-xs">
        <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider px-2 mr-0.5">
          Service:
        </span>
        {[
          { id: 'all', label: 'All Services', count: serviceCounts.all },
          { id: 'website_development', label: 'Website Dev', count: serviceCounts.website_development },
          { id: 'booking_automation', label: 'Online Booking', count: serviceCounts.booking_automation },
          { id: 'whatsapp_automation', label: 'Inquiry Capture', count: serviceCounts.whatsapp_automation },
          { id: 'lead_automation', label: 'Speed-to-Lead', count: serviceCounts.lead_automation },
          { id: 'ai_agents', label: 'Inquiry Assistant', count: serviceCounts.ai_agents },
          { id: 'crm_workflow_automation', label: 'CRM Sync', count: serviceCounts.crm_workflow_automation },
          { id: 'business_automation', label: 'Business Ops', count: serviceCounts.business_automation },
        ].map((svc) => {
          const isSel = selectedService === svc.id;
          return (
            <button
              key={svc.id}
              onClick={() => setSelectedService(svc.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-[border-color,background-color,color] cursor-pointer flex items-center gap-1.5 border ${
                isSel
                  ? 'bg-[hsl(var(--info-bg))] text-[hsl(var(--info-fg))] border-[hsl(var(--info-border))]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary border-transparent'
              }`}
            >
              <span>{svc.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-sm tabular-nums font-mono ${
                isSel
                  ? 'bg-[hsl(var(--info-fg))]/15 text-[hsl(var(--info-fg))]'
                  : 'bg-secondary text-muted-foreground border border-border'
              }`}>
                {svc.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Leads Grid Table Component */}
      <LeadsTable
        leads={filteredLeads}
        isLoading={isLoading}
        isError={isError}
        error={error as Error}
        onRetry={() => refetch()}
      />
    </div>
  );
}
