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
import { parseStructuredPoints } from '@/lib/utils';

interface IntelligenceSummaryProps {
  lead: NormalizedLead;
}

export function IntelligenceSummary({ lead }: IntelligenceSummaryProps) {
  const primaryProblem = lead.primaryProblem?.trim() || 'Unknown';
  const recommendedService = lead.recommendedService?.trim() || 'Unknown';
  const whyThisService = lead.whyThisService?.trim() || 'Unknown';

  const primaryProblemPoints = parseStructuredPoints(primaryProblem);
  const whyThisServicePoints = parseStructuredPoints(whyThisService);


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
          {primaryProblem === 'Unknown' || primaryProblemPoints.length <= 1 ? (
            <p
              className={`text-xs leading-relaxed ${
                primaryProblem === 'Unknown'
                  ? 'text-muted-foreground italic'
                  : 'text-foreground font-medium'
              }`}
            >
              {primaryProblem}
            </p>
          ) : (
            <ul className="space-y-1.5 pt-0.5">
              {primaryProblemPoints.map((point, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-xs leading-relaxed"
                >
                  <span className="shrink-0 flex items-center justify-center h-4 w-4 rounded-full bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning-fg))] border border-[hsl(var(--warning-border))] font-mono text-[10px] font-bold mt-0.5">
                    {point.number || index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    {point.label && (
                      <span className="font-semibold text-foreground mr-1.5">
                        {point.label}
                      </span>
                    )}
                    <span className="text-foreground font-medium">
                      {point.text}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
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
        <div className="p-3.5 rounded-md border border-border/70 bg-card/60 space-y-2.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--success-fg))]" />
            <span>Why This Service</span>
          </div>
          {whyThisService === 'Unknown' || whyThisServicePoints.length === 0 ? (
            <p className="text-xs leading-relaxed text-muted-foreground italic">
              {whyThisService}
            </p>
          ) : whyThisServicePoints.length === 1 && !whyThisServicePoints[0].number && !whyThisServicePoints[0].label ? (
            <p className="text-xs leading-relaxed text-foreground font-medium">
              {whyThisService}
            </p>
          ) : (
            <ul className="space-y-2 pt-0.5">
              {whyThisServicePoints.map((point, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-xs leading-relaxed"
                >
                  <span className="shrink-0 flex items-center justify-center h-4 w-4 rounded-full bg-[hsl(var(--success-bg))] text-[hsl(var(--success-fg))] border border-[hsl(var(--success-border))] font-mono text-[10px] font-bold mt-0.5">
                    {point.number || index + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    {point.label && (
                      <span className="font-semibold text-foreground mr-1.5">
                        {point.label}
                      </span>
                    )}
                    <span className="text-foreground/90 font-normal">
                      {point.text}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
