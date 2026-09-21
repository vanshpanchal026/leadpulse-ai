import React, { useState } from 'react';
import { NormalizedLead, EvidenceItem, EvidenceClassification } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ShieldCheck,
  Search,
  Filter,
  Eye,
  Brain,
  HelpCircle,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface EvidenceSectionProps {
  lead: NormalizedLead;
  onSelectEvidence: (item: EvidenceItem) => void;
}

export function EvidenceSection({ lead, onSelectEvidence }: EvidenceSectionProps) {
  const [filter, setFilter] = useState<'all' | EvidenceClassification>('all');

  const filteredEvidence = lead.evidence.filter((item) => {
    if (filter === 'all') return true;
    return item.classification === filter;
  });

  return (
    <Card className="border-border/80 bg-card/60 rounded-md shadow-xs">
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Grounded Multi-Agent Evidence
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Strict epistemic separation: Verifiable Facts (OBSERVED), Deductions (INFERRED), and Public Gaps (UNKNOWN).
            </p>
          </div>

          {/* Classification Filters */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant={filter === 'all' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setFilter('all')}
            >
              All ({lead.evidence.length})
            </Button>
            <Button
              variant={filter === 'observed' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs px-2.5 text-muted-foreground hover:text-foreground"
              onClick={() => setFilter('observed')}
            >
              <Eye className="h-3 w-3 mr-1" />
              Observed ({lead.observedCount})
            </Button>
            <Button
              variant={filter === 'inferred' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs px-2.5 text-muted-foreground hover:text-foreground"
              onClick={() => setFilter('inferred')}
            >
              <Brain className="h-3 w-3 mr-1" />
              Inferred ({lead.inferredCount})
            </Button>
            <Button
              variant={filter === 'unknown' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs px-2.5 text-muted-foreground hover:text-foreground"
              onClick={() => setFilter('unknown')}
            >
              <HelpCircle className="h-3 w-3 mr-1" />
              Unknown ({lead.unknownCount})
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-3">
        {filteredEvidence.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border/80 rounded-md p-6">
            <ShieldCheck className="h-6 w-6 mx-auto mb-2 text-muted-foreground opacity-50" />
            <p className="font-medium text-foreground">No evidence records match the selected classification filter.</p>
            <p className="text-[11px] mt-1 text-muted-foreground">Try switching to &apos;All&apos; or another classification tab.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredEvidence.map((item, index) => {
              const confidencePct =
                typeof item.confidence === 'number'
                  ? Math.round(item.confidence > 1 ? item.confidence : item.confidence * 100)
                  : null;

              return (
                <div
                  key={`${item.source}-${index}`}
                  onClick={() => onSelectEvidence(item)}
                  className="p-3.5 rounded-md border border-border/80 bg-card/60 hover:bg-card/90 transition-colors cursor-pointer group flex flex-col justify-between space-y-2.5"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <Badge variant={item.classification}>
                          {item.classification.toUpperCase()}
                        </Badge>
                        <span className="text-[10px] font-mono uppercase text-muted-foreground">
                          {item.source}
                        </span>
                      </div>

                      {confidencePct !== null && (
                        <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                          {confidencePct}% conf
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-foreground font-medium line-clamp-2 leading-relaxed">
                      {item.finding}
                    </p>

                    {item.evidence && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2 font-mono bg-muted/40 p-1.5 rounded-sm border border-border/60">
                        {item.evidence}
                      </p>
                    )}
                  </div>

                  <div className="pt-1 border-t border-border/40 flex items-center justify-between text-[11px] text-primary group-hover:text-primary/90 font-medium">
                    <span>Inspect Raw Finding</span>
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
