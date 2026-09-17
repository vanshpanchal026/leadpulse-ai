import React from 'react';
import { NormalizedLead } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  AlertCircle,
  Target,
  HelpCircle,
  Activity,
  Send,
  CheckCircle2,
} from 'lucide-react';

interface IntelligenceSummaryProps {
  lead: NormalizedLead;
}

export function IntelligenceSummary({ lead }: IntelligenceSummaryProps) {
  const primaryProblem = lead.primaryProblem?.trim() || 'Unknown';
  const recommendedService = lead.recommendedService?.trim() || 'Unknown';
  const whyThisService = lead.whyThisService?.trim() || 'Unknown';

  const getPriorityBadge = () => {
    switch (lead.researchPriority) {
      case 'high':
        return (
          <Badge variant="destructive" className="uppercase font-mono text-[10px]">
            High Priority
          </Badge>
        );
      case 'medium':
        return (
          <Badge variant="warning" className="uppercase font-mono text-[10px]">
            Medium Priority
          </Badge>
        );
      case 'low':
      default:
        return (
          <Badge variant="secondary" className="uppercase font-mono text-[10px]">
            Low Priority
          </Badge>
        );
    }
  };

  return (
    <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-sm">
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Executive Intelligence Summary
          </CardTitle>
          <div className="flex items-center gap-2">
            {getPriorityBadge()}
            <Badge variant="outline" className="text-[10px] font-mono capitalize">
              {lead.outreachStatus} outreach
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Primary Problem */}
        <div className="p-3.5 rounded-md border border-border/70 bg-card/60 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <AlertCircle className="h-3.5 w-3.5 text-[hsl(var(--warning-fg))]" />
            <span>Primary Problem</span>
          </div>
          <p
            className={`text-xs leading-relaxed ${
              primaryProblem === 'Unknown'
                ? 'text-muted-foreground italic'
                : 'text-foreground font-medium'
            }`}
          >
            {primaryProblem}
          </p>
        </div>

        {/* Recommended Service */}
        <div className="p-3.5 rounded-md border border-border/70 bg-card/60 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Target className="h-3.5 w-3.5 text-primary" />
            <span>Recommended Service</span>
          </div>
          <div className="space-y-1">
            <span
              className={`text-xs font-semibold block ${
                recommendedService === 'Unknown'
                  ? 'text-muted-foreground italic'
                  : 'text-primary'
              }`}
            >
              {recommendedService}
            </span>
          </div>
        </div>

        {/* Why This Service */}
        <div className="p-3.5 rounded-md border border-border/70 bg-card/60 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--success-fg))]" />
            <span>Why This Service</span>
          </div>
          <p
            className={`text-xs leading-relaxed ${
              whyThisService === 'Unknown'
                ? 'text-muted-foreground italic'
                : 'text-foreground font-medium'
            }`}
          >
            {whyThisService}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
