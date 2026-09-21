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
  AlertCircle,
} from 'lucide-react';
import { OutreachApprovalStatus } from '../types';

interface OutreachApprovalGateProps {
  leadId: string;
  approvalStatus: OutreachApprovalStatus;
  draftMessage: string;
  isApproving?: boolean;
  isRejecting?: boolean;
  isRegenerating?: boolean;
  canApprove?: boolean;
  onApprove: (notes?: string) => Promise<void>;
  onReject: (reason?: string) => Promise<void>;
  onRegenerate: () => Promise<void>;
}

export function OutreachApprovalGate({
  leadId,
  approvalStatus,
  draftMessage,
  isApproving = false,
  isRejecting = false,
  isRegenerating = false,
  canApprove = true,
  onApprove,
  onReject,
  onRegenerate,
}: OutreachApprovalGateProps) {
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const handleCopy = () => {
    if (!draftMessage) {
      toast.error('No draft message to copy.');
      return;
    }
    navigator.clipboard?.writeText(draftMessage);
    toast.success('Message Copied for Manual Dispatch', {
      description: 'Copied to clipboard. Paste directly into WhatsApp Web or DM.',
    });
  };

  const handleApprove = async () => {
    try {
      await onApprove();
      toast.success('Draft Approved for Manual Send', {
        description: 'Approved for manual sending. external_send_executed = false.',
      });
    } catch (err: any) {
      toast.error('Approval failed', {
        description: err.message || 'Could not approve draft.',
      });
    }
  };

  const handleConfirmReject = async () => {
    try {
      await onReject(rejectReason || 'Rejected by operator');
      setShowRejectInput(false);
      setRejectReason('');
      toast.info('Draft Rejected by Operator');
    } catch (err: any) {
      toast.error('Rejection failed', {
        description: err.message || 'Could not reject draft.',
      });
    }
  };

  const handleRegenerate = async () => {
    try {
      await onRegenerate();
      toast.success('Regeneration Requested', {
        description: 'Outreach Agent synthesized a fresh draft.',
      });
    } catch (err: any) {
      toast.error('Regeneration failed', {
        description: err.message || 'Could not regenerate draft.',
      });
    }
  };

  return (
    <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-sm">
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
            Human Approval Gate & Dispatch Control
          </CardTitle>

          {/* Status Indicators */}
          <div className="flex items-center gap-2">
            {approvalStatus === 'approved' && (
              <Badge variant="success" className="gap-1 text-[10px] font-mono">
                <CheckCircle2 className="h-3 w-3" />
                Approved for manual sending
              </Badge>
            )}
            {approvalStatus === 'rejected' && (
              <Badge variant="destructive" className="gap-1 text-[10px] font-mono">
                <XCircle className="h-3 w-3" />
                Rejected by operator
              </Badge>
            )}
            {approvalStatus === 'awaiting_human_approval' && (
              <Badge variant="warning" className="gap-1 text-[10px] font-mono">
                <Clock className="h-3 w-3" />
                Awaiting Human Review
              </Badge>
            )}
            <Badge variant="outline" className="text-[9px] font-mono border-border text-muted-foreground">
              External send: Manual
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-3 pb-3 space-y-3">
        {/* Safety Boundary Notice */}
        <div className="flex items-start gap-2.5 p-2.5 rounded-md bg-[hsl(var(--success-bg))] border border-[hsl(var(--success-border))] text-[11px] text-[hsl(var(--success-fg))]">
          <Lock className="h-3.5 w-3.5 text-[hsl(var(--success-fg))] shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-[hsl(var(--success-fg))]">
              Safety Boundary: Approval does not send the message. External sending remains manual.
            </p>
            <p className="text-[hsl(var(--success-fg))]/80 font-mono text-[10px]">
              Strict Invariant: external_send_executed = false
            </p>
          </div>
        </div>

        {/* Optional Rejection reason input */}
        {showRejectInput && (
          <div className="p-3 rounded-md bg-[hsl(var(--destructive)/0.08)] border border-[hsl(var(--destructive)/0.3)] space-y-2">
            <label className="text-xs font-semibold text-destructive block">
              Rejection Reason (Optional):
            </label>
            <input
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Tone too informal, lead not in active expansion..."
              aria-label="Rejection Reason"
              className="w-full px-2.5 py-1.5 text-xs bg-background border border-input rounded-md text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-destructive font-sans"
            />
            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowRejectInput(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs"
                onClick={handleConfirmReject}
                disabled={isRejecting}
              >
                {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="border-t border-border/60 flex flex-wrap items-center justify-between gap-2.5 pt-3">
        <div className="flex items-center gap-2">
          {/* Copy Message */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            disabled={!draftMessage}
            className="h-8 gap-1.5 text-xs"
          >
            <Copy className="h-3.5 w-3.5" />
            Copy Message
          </Button>

          {/* Regenerate */}
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

          {/* Lead Dossier Link */}
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Link to={`/leads/${encodeURIComponent(leadId)}`}>
              <ExternalLink className="h-3.5 w-3.5" />
              Open Lead Dossier
            </Link>
          </Button>
        </div>

        {/* Primary Approval & Rejection Actions */}
        <div className="flex items-center gap-2">
          {approvalStatus !== 'rejected' && !showRejectInput && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRejectInput(true)}
              disabled={isRejecting}
              className="h-8 gap-1.5 text-xs border-[hsl(var(--destructive)/0.4)] text-destructive hover:bg-[hsl(var(--destructive)/0.1)]"
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject Draft
            </Button>
          )}

          <Button
            size="sm"
            onClick={handleApprove}
            disabled={isApproving || !canApprove || approvalStatus === 'approved'}
            className={`h-8 gap-1.5 text-xs font-medium ${
              approvalStatus === 'approved'
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-[hsl(var(--success))] hover:bg-[hsl(var(--success)/0.9)] text-white'
            }`}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {approvalStatus === 'approved'
              ? 'Approved'
              : isApproving
              ? 'Approving...'
              : 'Approve for Manual Send'}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
