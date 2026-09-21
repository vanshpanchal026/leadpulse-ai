import React, { useState, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  SafetyBoundaryCard,
  CampaignForm,
  ResearchTelemetry,
  SpecialistStatusGrid,
  ResearchResultSummary,
  ResearchRunsTable,
  useResearchRunsQuery,
  useResearchRunQuery,
  useCreateResearchRunMutation,
  CampaignFormData,
} from '@/features/research';

export function ResearchPage() {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  // Queries & Mutations
  const {
    data: runsData,
    isLoading: isRunsLoading,
    refetch: refetchRuns,
  } = useResearchRunsQuery(15);

  const {
    data: activeRun,
    isLoading: isActiveRunLoading,
  } = useResearchRunQuery(selectedRunId);

  const createMutation = useCreateResearchRunMutation();

  // If no run selected yet, automatically select the most recent one when data loads
  useEffect(() => {
    if (!selectedRunId && runsData?.items && runsData.items.length > 0) {
      setSelectedRunId(runsData.items[0].run_id);
    }
  }, [runsData, selectedRunId]);

  const isCurrentRunActive =
    activeRun?.status === 'running' || activeRun?.status === 'pending';
  const isBusy = createMutation.isPending || isCurrentRunActive;

  const handleStartCampaign = async (formData: CampaignFormData) => {
    toast.info('Initiating Research Campaign...', {
      description: `Dispatching Search Strategist for ${formData.location} (${formData.vertical})...`,
    });

    try {
      const newRun = await createMutation.mutateAsync(formData);
      setSelectedRunId(newRun.run_id);
      toast.success('Campaign Pipeline Started', {
        description: `Run ID: ${newRun.run_id}. Live telemetry active.`,
      });
    } catch (err: any) {
      console.error('Campaign launch error:', err);
      toast.error('Failed to Start Campaign', {
        description:
          err.message || 'Could not connect to Python AI Worker on port 8000.',
      });
    }
  };

  return (
    <div className="space-y-6 w-full pb-12">
      <PageHeader
        title="Research Campaign Control Center"
        description="Autonomous multi-agent research pipeline. Orchestrate Search Strategist discovery, pre-filtering, and parallel specialist analysis."
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Research Engine' },
        ]}
        badge={
          <Badge variant="secondary" className="text-xs">
            Automated Crawler Swarm
          </Badge>
        }
      />

      {/* Non-Negotiable Safety Boundary */}
      <SafetyBoundaryCard />

      {/* Main Campaign Configuration & Telemetry Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Campaign Configuration Form */}
        <div className="lg:col-span-5 space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground px-0.5">
            Configuration
          </div>
          <CampaignForm
            onSubmit={handleStartCampaign}
            isRunning={isBusy}
          />
        </div>

        {/* Right: Live Research Run Telemetry */}
        <div className="lg:col-span-7 space-y-2">
          <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground px-0.5">
            Live Telemetry
          </div>
          <ResearchTelemetry
            run={activeRun ?? null}
            isLoading={isActiveRunLoading}
            isPolling={isCurrentRunActive}
          />
        </div>
      </div>

      {/* Specialist Execution Grid */}
      <SpecialistStatusGrid
        run={activeRun ?? null}
        isRunning={isCurrentRunActive}
      />

      {/* Research Result Summary (shows on completed or partial run) */}
      {activeRun && (activeRun.status === 'completed' || activeRun.status === 'partial') && (
        <ResearchResultSummary run={activeRun} />
      )}

      {/* Recent Research Runs Audit Table */}
      <ResearchRunsTable
        runs={runsData?.items || []}
        selectedRunId={selectedRunId}
        onSelectRun={(id) => setSelectedRunId(id)}
        isLoading={isRunsLoading}
        onRefresh={() => refetchRuns()}
      />
    </div>
  );
}
