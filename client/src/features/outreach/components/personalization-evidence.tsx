import React from 'react';
import { EvidenceItem } from '../../leads/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Eye, Brain, HelpCircle, Layers } from 'lucide-react';

interface PersonalizationEvidenceProps {
  evidence: EvidenceItem[];
  observedCount: number;
  inferredCount: number;
  unknownCount: number;
}

export function PersonalizationEvidence({
  evidence,
  observedCount,
  inferredCount,
  unknownCount,
}: PersonalizationEvidenceProps) {
  return (
    <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-sm">
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 text-muted-foreground">
            <Layers className="h-3.5 w-3.5 text-primary" />
            Personalization Evidence & Epistemic Grounding
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Badge variant="observed" className="text-[9px]">
              {observedCount} OBSERVED
            </Badge>
            <Badge variant="inferred" className="text-[9px]">
              {inferredCount} INFERRED
            </Badge>
            {unknownCount > 0 && (
              <Badge variant="unknown" className="text-[9px]">
                {unknownCount} UNKNOWN
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-3 space-y-2.5">
        {evidence.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-2">
            No specific evidence records attached to this draft.
          </p>
        ) : (
          evidence.slice(0, 4).map((item, idx) => {
            const confPct =
              typeof item.confidence === 'number'
                ? Math.round(item.confidence > 1 ? item.confidence : item.confidence * 100)
                : null;

            return (
              <div
                key={idx}
                className="p-2.5 rounded-md bg-muted/15 border border-border/60 space-y-1 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Badge variant={item.classification} className="text-[8px] px-1 py-0">
                      {item.classification.toUpperCase()}
                    </Badge>
                    <span className="text-[10px] font-mono text-muted-foreground uppercase">
                      {item.source}
                    </span>
                  </div>
                  {confPct !== null && (
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {confPct}% conf
                    </span>
                  )}
                </div>

                <p className="text-xs text-foreground font-medium leading-snug">
                  {item.finding}
                </p>

                {item.evidence && (
                  <p className="text-[11px] text-muted-foreground font-mono bg-black/20 p-1 rounded border border-border/40 truncate">
                    {item.evidence}
                  </p>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
