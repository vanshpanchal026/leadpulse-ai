import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Copy,
  ExternalLink,
  ShieldCheck,
  Lock,
  Clock,
  AlertTriangle,
  FileEdit,
  Phone,
  Eye,
} from 'lucide-react';
import { OutreachApprovalStatus, OutreachQualityLevel } from '../types';

interface ApprovalGateProps {
  leadId: string;
  businessName: string;
  channel: string;
  approvalStatus: OutreachApprovalStatus;
  draftMessage: string;
  phone: string | null;
  validationLevel: OutreachQualityLevel;
  validationReasons?: string[];
  isApproving?: boolean;
  isRejecting?: boolean;
  isRegenerating?: boolean;
  canApprove?: boolean;
  onApprove: (notes?: string) => Promise<void>;
  onReject: (reason?: string) => Promise<void>;
  onRequestRevision: (notes: string) => Promise<void>;
  onRegenerate: () => Promise<void>;
}

const REJECTION_REASONS = [
  'Poor personalization',
  'Incorrect evidence',
  'Weak value proposition',
  'Too generic',
  'Incorrect service',
  'Other',
];

export function ApprovalGate({
  leadId,
  businessName,
  channel,
  approvalStatus,
  draftMessage,
  phone,
  validationLevel,
  validationReasons = [],
  isApproving = false,
  isRejecting = false,
  isRegenerating = false,
  canApprove = true,
  onApprove,
  onReject,
  onRequestRevision,
  onRegenerate,
}: ApprovalGateProps) {
  // Modal / drawer states
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);

  // Form states
  const [selectedRejectReason, setSelectedRejectReason] = useState(REJECTION_REASONS[0]);
  const [rejectNotes, setRejectNotes] = useState('');
  const [revisionNotes, setRevisionNotes] = useState('');

  const handleCopy = () => {
    if (!draftMessage) {
      toast.error('No draft message to copy.');
      return;
    }
    navigator.clipboard?.writeText(draftMessage);
    toast.success('Message Copied for Manual Dispatch', {
      description: 'Copied to clipboard. Ready for manual dispatch into messaging client.',
    });
  };

  const handleConfirmApproval = async () => {
    try {
      await onApprove('Approved by human operator after review');
      setShowConfirmModal(false);
      toast.success('Draft Approved for Manual Send', {
        description: 'Approval recorded. external_send_executed = false. External sending remains manual.',
      });
    } catch (err: any) {
      toast.error('Approval failed', {
        description: err.message || 'Could not record draft approval.',
      });
    }
  };

  const handleConfirmRejection = async () => {
    try {
      const fullReason = rejectNotes.trim()
        ? `${selectedRejectReason}: ${rejectNotes.trim()}`
        : selectedRejectReason;
      await onReject(fullReason);
      setShowRejectModal(false);
      setRejectNotes('');
      toast.info('Draft Marked as Rejected', {
        description: `Reason: ${selectedRejectReason}`,
      });
    } catch (err: any) {
      toast.error('Rejection failed', {
        description: err.message || 'Could not record draft rejection.',
      });
    }
  };

  const handleConfirmRevision = async () => {
    if (!revisionNotes.trim()) {
      toast.error('Please provide revision guidance notes.');
      return;
    }
    try {
      await onRequestRevision(revisionNotes.trim());
      setShowRevisionModal(false);
      setRevisionNotes('');
      toast.warning('Revision Requested', {
        description: 'Revision notes recorded in workspace state.',
      });
    } catch (err: any) {
      toast.error('Failed to request revision', {
        description: err.message || 'Could not submit revision notes.',
      });
    }
  };

  const handleRegenerate = async () => {
    try {
      await onRegenerate();
      toast.success('Regeneration Complete', {
        description: 'Outreach Agent synthesized a fresh candidate pitch.',
      });
    } catch (err: any) {
      toast.error('Regeneration failed', {
        description: err.message || 'Could not regenerate outreach draft.',
      });
    }
  };

  // WhatsApp manual URL (user-triggered browser redirect)
  const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : null;
  const whatsappUrl = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(draftMessage)}`
    : null;

  return (
    <Card className="border-border bg-card shadow-xs font-sans rounded-md">
      <CardHeader className="pb-3 border-b border-border">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-xs font-medium [font-family:var(--font-display)] uppercase tracking-wider flex items-center gap-1.5 text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            Human Approval Gate
          </CardTitle>

          <div className="flex items-center gap-2">
            {approvalStatus === 'approved' && (
              <Badge variant="success" className="gap-1 text-xs font-mono">
                <CheckCircle2 className="h-3 w-3" />
                Approved
              </Badge>
            )}
            {approvalStatus === 'rejected' && (
              <Badge variant="destructive" className="gap-1 text-xs font-mono">
                <XCircle className="h-3 w-3" />
                Disqualified
              </Badge>
            )}
            {approvalStatus === 'needs_revision' && (
              <Badge variant="warning" className="gap-1 text-xs font-mono">
                <FileEdit className="h-3 w-3" />
                Needs Revision
              </Badge>
            )}
            {approvalStatus === 'awaiting_human_approval' && (
              <Badge variant="warning" className="gap-1 text-xs font-mono">
                <Clock className="h-3 w-3" />
                Pending Review
              </Badge>
            )}
            <Badge variant="success" className="text-xs font-mono">
              Human-Only Send Mode
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-3 pb-3 space-y-3">
        {/* Prominent Mandatory Human Approval Invariant */}
        <div className="p-3.5 rounded-md bg-[hsl(var(--warning-bg))] border border-[hsl(var(--warning-border))] text-[hsl(var(--warning-fg))] space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-medium [font-family:var(--font-display)]">
            <Lock className="h-4 w-4 text-[hsl(var(--warning-fg))] shrink-0" />
            <span>HUMAN APPROVAL REQUIRED</span>
          </div>
          <p className="text-xs text-[hsl(var(--warning-fg))]/90 leading-relaxed">
            No external communication is sent automatically. Every outbound message requires human review, validation confirmation, and manual dispatch.
          </p>
          <div className="pt-1 flex items-center gap-2 font-mono text-xs text-[hsl(var(--warning-fg))]">
            <span className="font-semibold">Safety Guardrail:</span>
            <span>Zero automated dispatch permitted by architecture.</span>
          </div>
        </div>

        {/* Action Workflow Hierarchy Notice */}
        <div className="flex items-center justify-between text-xs font-mono text-muted-foreground px-1">
          <span>Flow: Draft → Review → Validate → Operator Approval → Manual Send</span>
          <span className="text-foreground font-medium">100% Operator Controlled</span>
        </div>
      </CardContent>

      <CardFooter className="border-t border-border flex flex-wrap items-center justify-between gap-2.5 pt-3">
        {/* Secondary Utility Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={!draftMessage}
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy Pitch
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className={`h-3.5 w-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
            {isRegenerating ? 'Regenerating...' : 'Regenerate Draft'}
          </Button>

          {/* User-Triggered Manual WhatsApp Link */}
          {whatsappUrl ? (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-8 gap-1.5 text-xs text-foreground border-border hover:bg-secondary font-medium"
            >
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Open WhatsApp Web in new tab with pre-filled message"
              >
                <Phone className="h-3.5 w-3.5" />
                <span>Open WhatsApp Web</span>
                <ExternalLink className="h-3 w-3 ml-0.5 opacity-70" />
              </a>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              disabled
              title="Phone number missing or unverified for WhatsApp handoff"
              className="h-8 gap-1.5 text-xs text-muted-foreground/50 border-border cursor-not-allowed"
            >
              <Phone className="h-3.5 w-3.5" />
              <span>No Phone</span>
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            asChild
            className="h-8 gap-1.5 text-xs font-medium"
          >
            <Link to={`/leads/${encodeURIComponent(leadId)}`}>
              <Eye className="h-3.5 w-3.5" />
              <span>View Profile</span>
            </Link>
          </Button>
        </div>

        {/* Primary Approval / Reject / Revision Triggers */}
        <div className="flex items-center gap-2 flex-wrap">
          {approvalStatus !== 'needs_revision' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRevisionModal(true)}
              className="h-8 gap-1.5 text-xs border-[hsl(var(--warning-border))] text-[hsl(var(--warning-fg))] hover:bg-[hsl(var(--warning-bg))] font-medium"
            >
              <FileEdit className="h-3.5 w-3.5" />
              Ask for Re-write
            </Button>
          )}

          {approvalStatus !== 'rejected' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRejectModal(true)}
              disabled={isRejecting}
              className="h-8 gap-1.5 text-xs border-[hsl(var(--destructive-border))] text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive-bg))] font-medium"
            >
              <XCircle className="h-3.5 w-3.5" />
              Disqualify Lead
            </Button>
          )}

          <Button
            size="sm"
            onClick={() => setShowConfirmModal(true)}
            disabled={isApproving || !canApprove || approvalStatus === 'approved' || validationLevel === 'BLOCKED' || validationLevel === 'BLOCK'}
            className={`h-8 gap-1.5 text-xs font-medium shadow-xs active:scale-[0.99] active:translate-y-px ${
              approvalStatus === 'approved'
                ? 'bg-[hsl(var(--success))] text-white cursor-not-allowed opacity-80'
                : 'bg-[hsl(var(--success))] hover:opacity-90 text-white'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {approvalStatus === 'approved'
              ? 'Approved'
              : isApproving
              ? 'Approving...'
              : 'Approve Draft'}
          </Button>
        </div>
      </CardFooter>

      {/* 1. Explicit Approval Confirmation Dialog */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border/80 rounded-lg shadow-xl max-w-lg w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div className="space-y-0.5">
                <h3 className="text-sm font-medium [font-family:var(--font-display)] text-foreground flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-[hsl(var(--success-fg))]" />
                  Confirm Human Approval
                </h3>
                <p className="text-xs text-muted-foreground">
                  Review the summary below before approving this draft for manual dispatch.
                </p>
              </div>
              <button
                onClick={() => setShowConfirmModal(false)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2 p-2.5 rounded bg-muted/20 border border-border/50">
                <div>
                  <span className="text-[10px] text-muted-foreground block">Lead:</span>
                  <span className="font-semibold text-foreground">{businessName}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Channel:</span>
                  <span className="font-semibold text-foreground capitalize">{channel}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Validation:</span>
                  <Badge variant={validationLevel === 'PASS' ? 'success' : 'warning'} className="text-[8px] font-mono">
                    {validationLevel}
                  </Badge>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">Length:</span>
                  <span className="font-mono text-zinc-300">{draftMessage.length} characters</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground uppercase font-mono block">
                  Approved Message Content:
                </span>
                <p className="p-3 rounded-md bg-muted/40 border border-border/80 text-foreground text-xs leading-relaxed italic">
                  &ldquo;{draftMessage}&rdquo;
                </p>
              </div>

              <div className="p-2.5 rounded-md bg-[hsl(var(--success-bg))] border border-[hsl(var(--success-border))] text-[11px] text-[hsl(var(--success-fg))] flex items-start gap-2">
                <Lock className="h-3.5 w-3.5 text-[hsl(var(--success-fg))] shrink-0 mt-0.5" />
                <span>
                  Safety Confirmation: Approval updates workspace state only. No message is sent. external_send_executed remains strictly false.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border/60 pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowConfirmModal(false)}
                disabled={isApproving}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmApproval}
                disabled={isApproving}
                className="h-8 gap-1 text-xs font-medium bg-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.9)] text-white"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {isApproving ? 'Recording...' : 'Confirm Approval'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Rejection Reason Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border/80 rounded-lg shadow-xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div className="space-y-0.5">
                <h3 className="text-sm font-medium [font-family:var(--font-display)] text-[hsl(var(--destructive))] flex items-center gap-1.5">
                  <XCircle className="h-4 w-4" />
                  Reject Outreach Draft
                </h3>
                <p className="text-xs text-muted-foreground">
                  Select a reason to explain why this draft is disqualified.
                </p>
              </div>
              <button
                onClick={() => setShowRejectModal(false)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-foreground block">
                  Rejection Reason:
                </label>
                <select
                  value={selectedRejectReason}
                  onChange={(e) => setSelectedRejectReason(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-secondary border border-border rounded-md text-foreground text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive font-sans"
                >
                  {REJECTION_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-foreground block">
                  Additional Operator Notes (Optional):
                </label>
                <textarea
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  placeholder="Explain specific feedback (e.g. Needs higher focus on Meta Ad disconnect)..."
                  rows={3}
                  className="w-full p-2.5 bg-secondary border border-border rounded-md text-foreground text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive font-sans"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRejectModal(false)}
                disabled={isRejecting}
                className="h-8 text-xs font-medium"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleConfirmRejection}
                disabled={isRejecting}
                className="h-8 gap-1 text-xs font-medium"
              >
                <XCircle className="h-3.5 w-3.5" />
                {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Revision Guidance Modal */}
      {showRevisionModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-md shadow-xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150 font-sans">
            <div className="flex items-start justify-between border-b border-border pb-3">
              <div className="space-y-0.5">
                <h3 className="text-sm font-medium [font-family:var(--font-display)] text-[hsl(var(--warning-fg))] flex items-center gap-1.5">
                  <FileEdit className="h-4 w-4 text-[hsl(var(--warning-fg))]" />
                  Request Draft Revision
                </h3>
                <p className="text-xs text-muted-foreground">
                  Provide guidance for re-drafting without discarding lead research.
                </p>
              </div>
              <button
                onClick={() => setShowRevisionModal(false)}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-foreground block">
                  Reviewer Guidance / Revision Instructions:
                </label>
                <textarea
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  placeholder="e.g. Tone too formal; reference the 140 Google reviews directly in first sentence..."
                  rows={4}
                  className="w-full p-2.5 bg-secondary border border-border rounded-md text-foreground text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(var(--warning))] font-sans"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowRevisionModal(false)}
                className="h-8 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirmRevision}
                className="h-8 gap-1 text-xs font-medium bg-[hsl(var(--warning))] hover:bg-[hsl(var(--warning)/0.9)] text-white"
              >
                <FileEdit className="h-3.5 w-3.5" />
                Submit Revision Request
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
