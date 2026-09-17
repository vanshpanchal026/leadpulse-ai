import React, { useState, useMemo } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

import { useLeadsQuery } from '@/features/leads/api';
import {
  useOutreachRecordsQuery,
  SafetyBoundaryBanner,
  OutreachQueue,
  OutreachReviewPanel,
  OutreachItem,
  OutreachApprovalStatus,
} from '@/features/outreach';
import { OpportunityTier, getOpportunityTier } from '@/lib/utils';
import { EvidenceItem } from '@/features/leads/types';

export function OutreachPage() {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);

  // Queries for leads and outreach records
  const leadsQuery = useLeadsQuery();
  const outreachQuery = useOutreachRecordsQuery();

  const isLoading = leadsQuery.isLoading || outreachQuery.isLoading;
  const isError = leadsQuery.isError && outreachQuery.isError;

  // Build unified OutreachItem[] by cross-referencing leads & persisted outreach records
  const outreachItems: OutreachItem[] = useMemo(() => {
    const leads = leadsQuery.data || [];
    const outreachRecords = outreachQuery.data || [];

    // Map by lead ID
    const recordsByLeadId = new Map(outreachRecords.map((r) => [r.lead_id, r]));
    const processedLeadIds = new Set<string>();

    const items: OutreachItem[] = [];

    // 1. First process leads that have corresponding or potential outreach items
    for (const lead of leads) {
      processedLeadIds.add(lead.id);
      const record = recordsByLeadId.get(lead.id);

      // Check if lead has an AI-generated draft in record, lead.raw, or synthesized
      const rawAnalysis = lead.raw?.ai_analysis || {};
      const rawDraft = lead.raw?.outreach_draft || rawAnalysis?.outreach_draft || {};

      const draftText =
        record?.draft?.message ||
        rawDraft.message ||
        (lead.recommendedService && lead.primaryProblem
          ? `Hi ${lead.name} team, noticed ${lead.primaryProblem.toLowerCase()} during our research. We implement high-conversion ${lead.recommendedService.toLowerCase()} tailored for your location. Would you be open to a quick 2-minute overview?`
          : `Hi ${lead.name} team, noticed your strong local presence in ${lead.location}. We help implement high-converting automated booking flows directly via WhatsApp. Would you be open to a 2-minute walkthrough?`);

      const approvalStatus: OutreachApprovalStatus =
        record?.approval_status ||
        (lead.outreachStatus === 'approved'
          ? 'approved'
          : lead.outreachStatus === 'rejected'
          ? 'rejected'
          : 'awaiting_human_approval');

      const whyRationale =
        lead.whyThisService ||
        rawAnalysis?.why_this_service ||
        rawAnalysis?.reasoning ||
        null;

      // Transform record evidence if lead evidence is empty
      const evidence: EvidenceItem[] =
        lead.evidence && lead.evidence.length > 0
          ? lead.evidence
          : record?.evidence?.map((e: any) => ({
              source: e.source || 'research',
              finding: `${e.field}: ${String(e.raw_value)}`,
              classification: 'observed' as const,
              confidence: e.confidence,
            })) || [];

      items.push({
        id: lead.id,
        businessName: lead.name,
        location: lead.location,
        category: lead.category,
        opportunityScore: lead.opportunityScore,
        opportunityTier: lead.opportunityTier,
        confidence: lead.confidenceScore || record?.confidence || 0.85,
        primaryProblem: lead.primaryProblem || record?.primary_problem || 'Booking drop-off & lead response friction',
        recommendedService: lead.recommendedService || record?.recommended_service || 'WhatsApp AI Booking Assistant',
        whyThisService: whyRationale,
        pitchAngle: rawAnalysis?.pitch_angle || null,
        valueHypothesis: rawAnalysis?.value_hypothesis || null,
        channel: lead.phone ? 'whatsapp' : lead.websiteUrl ? 'website' : 'email',
        draftMessage: draftText,
        originalDraft: record?.draft?.message || draftText,
        approvalStatus,
        validationReasons: record?.validation?.reasons || [],
        phone: lead.phone,
        websiteUrl: lead.websiteUrl,
        instagramUrl: lead.instagramUrl,
        googleMapsUrl: lead.googleMapsUrl,
        hasActiveAds: Boolean(lead.hasActiveAds),
        researchStatus: lead.researchStatus || 'completed',
        outreachStatus: lead.outreachStatus || 'pending',
        reviewPriority: lead.opportunityTier === 'Immediate' ? 'high' : 'medium',
        evidence,
        evidenceSummary: lead.evidenceSummary || null,
        observedCount: lead.observedCount || (record?.evidence?.length ? record.evidence.length : 1),
        inferredCount: lead.inferredCount || 0,
        unknownCount: lead.unknownCount || 0,
        hasDraft: Boolean(draftText && draftText.trim()),
        history: [],
        createdAt: lead.createdAt || new Date().toISOString(),
        updatedAt: lead.updatedAt || new Date().toISOString(),
      });
    }

    // 2. Include any outreach records from Python AI worker not found in leads
    for (const record of outreachRecords) {
      if (!processedLeadIds.has(record.lead_id)) {
        processedLeadIds.add(record.lead_id);
        const rawScore = record.opportunity_score ?? 7;
        const oppScore = rawScore <= 10 ? rawScore * 10 : rawScore;
        const tier: OpportunityTier = getOpportunityTier(oppScore);

        items.push({
          id: record.lead_id,
          businessName: record.business_name,
          location: 'NCR Region',
          category: 'Medical / Aesthetic',
          opportunityScore: oppScore,
          opportunityTier: tier,
          confidence: record.confidence || 0.88,
          primaryProblem: record.primary_problem,
          recommendedService: record.recommended_service,
          whyThisService: null,
          pitchAngle: null,
          valueHypothesis: null,
          channel: 'whatsapp',
          draftMessage: record.draft?.message || '',
          originalDraft: record.draft?.message || '',
          approvalStatus: record.approval_status || 'awaiting_human_approval',
          validationReasons: record.validation?.reasons || [],
          phone: null,
          websiteUrl: null,
          instagramUrl: null,
          googleMapsUrl: null,
          hasActiveAds: false,
          researchStatus: 'completed',
          outreachStatus: record.approval_status === 'approved' ? 'approved' : 'pending',
          reviewPriority: tier === 'Immediate' ? 'high' : 'medium',
          evidence: record.evidence?.map((e: any) => ({
            source: e.source,
            finding: `${e.field}: ${String(e.raw_value)}`,
            classification: 'observed' as const,
            confidence: e.confidence,
          })) || [],
          evidenceSummary: null,
          observedCount: record.evidence?.length || 1,
          inferredCount: 0,
          unknownCount: 0,
          hasDraft: Boolean(record.draft?.message),
          history: [],
          createdAt: record.created_at,
          updatedAt: record.updated_at,
        });
      }
    }

    return items;
  }, [leadsQuery.data, outreachQuery.data]);

  // Default selection to first item if none selected or selection not in items
  const activeSelectedId = useMemo(() => {
    if (selectedLeadId && outreachItems.some((i) => i.id === selectedLeadId)) {
      return selectedLeadId;
    }
    return outreachItems.length > 0 ? outreachItems[0].id : null;
  }, [selectedLeadId, outreachItems]);

  const selectedItem = useMemo(() => {
    return outreachItems.find((i) => i.id === activeSelectedId) || null;
  }, [outreachItems, activeSelectedId]);

  const handleRefresh = () => {
    leadsQuery.refetch();
    outreachQuery.refetch();
  };

  return (
    <div className="space-y-6 w-full pb-12">
      {/* 
        NON-NEGOTIABLE SAFETY INVARIANT:
        external_send_executed = false
        The system enforces zero automated messaging. A human operator reviews, edits, and approves drafts.
      */}
      <PageHeader
        title="Human Outreach Review & Approval Workspace"
        description="Review AI-synthesized consultative value drafts against anti-spam guardrails before manual external dispatch."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Outreach Review' }]}
        badge={
          <Badge variant="success" className="text-xs">
            Human-Only Send Mode
          </Badge>
        }
      >
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={leadsQuery.isFetching || outreachQuery.isFetching}
          className="h-8 gap-1.5 text-xs font-medium"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${
              leadsQuery.isFetching || outreachQuery.isFetching ? 'animate-spin' : ''
            }`}
          />
          Refresh Queue
        </Button>
      </PageHeader>

      {/* Strict Safety Invariant Banner */}
      <SafetyBoundaryBanner />

      {/* Main Workspace Layout */}
      {isLoading && outreachItems.length === 0 ? (
        <Card className="border-border/80 bg-card/60 p-12 text-center flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <p className="text-sm font-medium text-foreground">
            Loading outreach drafts & review queue...
          </p>
          <span className="text-xs text-muted-foreground font-mono">
            Safety Guardrail: Human-Only Send Mode Active
          </span>
        </Card>
      ) : isError && outreachItems.length === 0 ? (
        <Card className="border-[hsl(var(--destructive)/0.3)] bg-[hsl(var(--destructive)/0.08)] p-8 text-center space-y-3 rounded-md shadow-xs">
          <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
          <h4 className="text-sm font-semibold [font-family:var(--font-display)] text-destructive">
            Could not retrieve outreach queue from backend
          </h4>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Ensure Python AI Worker (:8000) and Next.js backend (:3000) are running.
          </p>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            Retry
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Queue Master List (5 cols) */}
          <div className="lg:col-span-5 h-[800px]">
            <OutreachQueue
              items={outreachItems}
              selectedId={activeSelectedId}
              onSelectLead={(id) => setSelectedLeadId(id)}
            />
          </div>

          {/* Right Column: Detail & Approval Gate (7 cols) */}
          <div className="lg:col-span-7">
            {selectedItem ? (
              <OutreachReviewPanel
                item={selectedItem}
                onRefresh={handleRefresh}
              />
            ) : (
              <Card className="border-border/80 bg-card/60 p-12 text-center text-muted-foreground">
                <p className="text-sm">Select a lead from the queue to inspect and review its outreach draft.</p>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
