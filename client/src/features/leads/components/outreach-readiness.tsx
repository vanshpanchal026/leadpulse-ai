import React from 'react';
import { Link } from 'react-router-dom';
import { NormalizedLead } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Send,
  Copy,
  ShieldAlert,
  Lock,
  ArrowRight,
  MessageSquare,
  ExternalLink,
} from 'lucide-react';

interface OutreachReadinessProps {
  lead: NormalizedLead;
}

export function OutreachReadiness({ lead }: OutreachReadinessProps) {
  // Extract or synthesize pitch text grounded in lead's factual data
  const draftText =
    lead.raw?.outreach_draft?.pitch_text ||
    lead.raw?.outreach_draft?.message ||
    `Hi ${lead.name} team, noticed your clinic in ${lead.location} has ${lead.reviewCount > 0 ? `${lead.reviewCount} reviews` : 'high local demand'}, but ${lead.primaryProblem || 'consultation booking can be accelerated'}. We build custom AI booking workflows that confirm patient consultations directly via WhatsApp. Would you be open to a quick 2-minute demo?`;

  const angle =
    lead.raw?.outreach_draft?.angle ||
    (lead.recommendedService ? `High-conversion ${lead.recommendedService} tailored for ${lead.category}` : 'Conversion optimization & WhatsApp automation');

  const charCount = draftText.length;
  const sentenceCount = (draftText.match(/[.!?]+/g) || []).length;

  const handleCopyDraft = () => {
    navigator.clipboard?.writeText(draftText);
    toast.success('Pitch Copied to Clipboard', {
      description: 'Draft pitch is ready to paste into WhatsApp Web or your outreach client.',
    });
  };

  const cleanPhone = (lead.phone || '').replace(/[^0-9+]/g, '');
  const whatsAppUrl = cleanPhone
    ? `https://web.whatsapp.com/send?phone=${cleanPhone.replace('+', '')}&text=${encodeURIComponent(draftText)}`
    : null;

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="pb-3 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              Outreach Readiness & Review Boundary
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Anti-spam verified outreach proposal requiring explicit human review before transmission.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs font-mono">
              Status: {lead.outreachStatus.toUpperCase()}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Strict Human Approval Policy Invariant Banner */}
        <div className="p-3.5 rounded-md border border-[hsl(var(--warning-border))] bg-[hsl(var(--warning-bg))] flex items-start gap-3">
          <ShieldAlert className="h-4 w-4 text-[hsl(var(--warning-fg))] shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[hsl(var(--warning-fg))]">
                Human Review Boundary Active
              </span>
              <Badge variant="warning" className="text-xs">
                Human-Only Send Mode
              </Badge>
            </div>
            <p className="text-[hsl(var(--warning-fg))]/90 leading-relaxed text-xs">
              Operator approval required before any message leaves the platform. Automated bulk messaging is permanently blocked by safety invariants.
            </p>
          </div>
        </div>

        {/* Pitch Angle */}
        <div className="p-3.5 rounded-md bg-muted/30 border border-border text-xs">
          <span className="text-xs uppercase font-mono tracking-wider text-muted-foreground block mb-1">
            Outreach Angle & Value Hypothesis
          </span>
          <p className="font-medium text-foreground text-sm">{angle}</p>
        </div>

        {/* Generated Pitch Draft */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-foreground flex items-center gap-1.5 text-sm">
              <MessageSquare className="h-4 w-4 text-primary" />
              Verified Pitch Draft
            </span>
            <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground tabular-nums">
              <span>{charCount} chars</span>
              <span>•</span>
              <span>{sentenceCount} sentences</span>
            </div>
          </div>

          <div className="p-4 rounded-md bg-background border border-border font-sans text-sm text-foreground leading-relaxed break-words whitespace-pre-wrap selection:bg-primary/20">
            {draftText}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={handleCopyDraft} className="gap-1.5 text-xs font-medium">
              <Copy className="h-3.5 w-3.5" />
              Copy Pitch
            </Button>
            {whatsAppUrl && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs font-medium"
                onClick={() => window.open(whatsAppUrl, '_blank', 'noopener,noreferrer')}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Open WhatsApp Web
              </Button>
            )}
            <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs font-medium">
              <Link to="/outreach">
                <span>Review in Outreach Workspace</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
            <Lock className="h-3.5 w-3.5 text-[hsl(var(--success-fg))]" />
            <span>Safety Gate Enforced</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
