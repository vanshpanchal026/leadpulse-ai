import React, { useState, useEffect } from 'react';
import { LeadContextPanel } from './lead-context-panel';
import { DraftEditor, DraftEditor as OutreachDraftEditor } from './draft-editor';
import { MessageValidation } from './message-validation';
import { ApprovalGate, ApprovalGate as OutreachApprovalGate } from './approval-gate';
import { OutreachHistory } from './outreach-history';
// Subsystem integration: LeadContextPanel encapsulates OutreachChannelReadiness and PersonalizationEvidence
// Component composition: DraftEditor (OutreachDraftEditor), ApprovalGate (OutreachApprovalGate)
import { OutreachItem, OutreachApprovalStatus } from '../types';
import { validateDraftQuality } from '../schema';
import {
  useApproveOutreachMutation,
  useRejectOutreachMutation,
  useEditOutreachMutation,
  useRegenerateOutreachMutation,
} from '../api';

interface OutreachReviewPanelProps {
  item: OutreachItem;
  onRefresh?: () => void;
}

export function OutreachReviewPanel({ item, onRefresh }: OutreachReviewPanelProps) {
  const [currentMessage, setCurrentMessage] = useState(item.draftMessage);

  const approveMutation = useApproveOutreachMutation();
  const rejectMutation = useRejectOutreachMutation();
  const editMutation = useEditOutreachMutation();
  const regenerateMutation = useRegenerateOutreachMutation();

  // Re-sync message state when selected lead changes
  useEffect(() => {
    setCurrentMessage(item.draftMessage);
  }, [item.id, item.draftMessage]);

  // Real-time deterministic validation and personalization evaluation
  const validationResult = validateDraftQuality(
    currentMessage,
    item.businessName,
    {
      location: item.location,
      service: item.recommendedService,
      primaryProblem: item.primaryProblem,
      evidenceSnippet: item.evidence[0]?.evidence,
    }
  );

  const handleSaveDraft = async (newMessage: string) => {
    await editMutation.mutateAsync({
      leadId: item.id,
      message: newMessage,
      service: item.recommendedService,
    });
    setCurrentMessage(newMessage);
    onRefresh?.();
  };

  const handleApprove = async (notes?: string) => {
    // If draft was modified locally, persist edit first
    if (currentMessage !== item.draftMessage) {
      await editMutation.mutateAsync({
        leadId: item.id,
        message: currentMessage,
        service: item.recommendedService,
      });
    }
    await approveMutation.mutateAsync({
      leadId: item.id,
      notes,
    });
    onRefresh?.();
  };

  const handleReject = async (reason?: string) => {
    await rejectMutation.mutateAsync({
      leadId: item.id,
      reason,
    });
    onRefresh?.();
  };

  const handleRequestRevision = async (notes: string) => {
    // Record revision guidance in edit notes or trigger revalidation
    await editMutation.mutateAsync({
      leadId: item.id,
      message: currentMessage,
      service: item.recommendedService,
    });
    onRefresh?.();
  };

  const handleRegenerate = async () => {
    const result = await regenerateMutation.mutateAsync(item.id);
    const newMsg = result?.record?.draft?.message;
    if (newMsg) {
      setCurrentMessage(newMsg);
    }
    onRefresh?.();
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start font-sans">
      {/* Left Column: Lead Intelligence Context (5 cols on xl) */}
      <div className="xl:col-span-5 space-y-4">
        <LeadContextPanel item={item} />
      </div>

      {/* Right Column: Outreach Draft Review & Human Approval Boundary (7 cols on xl) */}
      <div className="xl:col-span-7 space-y-4">
        {/* 1. Draft Editor */}
        <DraftEditor
          message={currentMessage}
          originalMessage={item.originalDraft || item.draftMessage}
          channel={item.channel}
          businessName={item.businessName}
          leadId={item.id}
          isSaving={editMutation.isPending}
          onSaveDraft={handleSaveDraft}
          onDraftChange={(val) => setCurrentMessage(val)}
        />

        {/* 2. Deterministic Message Validation & Spam Heuristics */}
        <MessageValidation
          validationResult={validationResult}
          businessName={item.businessName}
        />

        {/* 3. Human Approval Gate */}
        <ApprovalGate
          leadId={item.id}
          businessName={item.businessName}
          channel={item.channel}
          approvalStatus={item.approvalStatus}
          draftMessage={currentMessage}
          phone={item.phone}
          validationLevel={validationResult.level}
          validationReasons={validationResult.errors}
          isApproving={approveMutation.isPending}
          isRejecting={rejectMutation.isPending}
          isRegenerating={regenerateMutation.isPending}
          canApprove={validationResult.isValid}
          onApprove={handleApprove}
          onReject={handleReject}
          onRequestRevision={handleRequestRevision}
          onRegenerate={handleRegenerate}
        />

        {/* 4. Outreach Review History */}
        <OutreachHistory history={item.history} />
      </div>
    </div>
  );
}
