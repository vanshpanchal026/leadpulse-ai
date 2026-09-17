import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLeadDetail } from '../api';
import { EvidenceItem } from '../types';
import { DossierHeader } from './dossier-header';
import { IntelligenceSummary } from './intelligence-summary';
import { DigitalPresence } from './digital-presence';
import { EvidenceSection } from './evidence-section';
import { EvidenceDrawer } from './evidence-drawer';
import { ResearchReport } from './research-report';
import { OutreachReadiness } from './outreach-readiness';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  Search,
  Sparkles,
} from 'lucide-react';

interface LeadDossierProps {
  leadId: string;
}

export function LeadDossier({ leadId }: LeadDossierProps) {
  const {
    lead,
    prevLeadId,
    nextLeadId,
    currentIndex,
    totalLeads,
    isLoading,
    isError,
    error,
    refetch,
  } = useLeadDetail(leadId);

  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceItem | null>(null);

  // 1. Loading Skeleton State
  if (isLoading) {
    return (
      <div className="space-y-6 w-full animate-pulse">
        {/* Header Skeleton */}
        <div className="space-y-4">
          <div className="flex justify-between items-center pb-4 border-b border-border/60">
            <div className="h-8 w-28 bg-muted/40 rounded" />
            <div className="h-8 w-36 bg-muted/40 rounded" />
          </div>
          <div className="h-28 bg-card/60 border border-border/60 rounded-xl p-5" />
        </div>

        {/* Executive Summary Skeleton */}
        <div className="h-36 bg-card/60 border border-border/60 rounded-xl" />

        {/* Digital Footprint Skeleton */}
        <div className="h-28 bg-card/60 border border-border/60 rounded-xl" />

        {/* Evidence Grid Skeleton */}
        <div className="h-56 bg-card/60 border border-border/60 rounded-xl" />
      </div>
    );
  }

  // 2. Error with Retry State
  if (isError) {
    return (
      <div className="max-w-2xl mx-auto py-12">
        <Card className="border-destructive/40 bg-destructive/10">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2 text-base">
              <AlertCircle className="h-5 w-5" />
              Failed to Load Lead Dossier
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <p className="text-muted-foreground">
              {error instanceof Error ? error.message : 'An error occurred while fetching lead details.'}
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => refetch()} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link to="/leads">
                  <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                  Back to Leads
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 3. Lead Not Found State
  if (!lead) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <Card className="border-border/80 bg-card/60 p-8 space-y-4">
          <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mx-auto text-muted-foreground">
            <Search className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold [font-family:var(--font-display)] text-foreground">Lead Record Not Found</h2>
            <p className="text-xs text-muted-foreground">
              No matching business record was found for ID: <span className="font-mono text-zinc-300">{leadId}</span>.
            </p>
          </div>
          <div className="pt-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/leads">
                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                Return to Leads Intelligence Workspace
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // 4. Complete Lead Dossier View
  return (
    <div className="space-y-6 w-full pb-12">
      {/* Header & Identity */}
      <DossierHeader
        lead={lead}
        prevLeadId={prevLeadId}
        nextLeadId={nextLeadId}
        currentIndex={currentIndex}
        totalLeads={totalLeads}
      />

      {/* Executive Intelligence Summary */}
      <IntelligenceSummary lead={lead} />

      {/* Digital Presence & Footprint */}
      <DigitalPresence lead={lead} />

      {/* Grounded Multi-Agent Evidence Section */}
      <EvidenceSection
        lead={lead}
        onSelectEvidence={(item) => setSelectedEvidence(item)}
      />

      {/* Deep Specialist Research Report */}
      <ResearchReport leadId={lead.id} />

      {/* Outreach Readiness & Human Approval Boundary */}
      <OutreachReadiness lead={lead} />

      {/* Slide-out Specialist Evidence Drawer */}
      <EvidenceDrawer
        item={selectedEvidence}
        onClose={() => setSelectedEvidence(null)}
      />
    </div>
  );
}
