import React from 'react';
import { EvidenceItem } from '../types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  X,
  ShieldCheck,
  Search,
  Layers,
  FileText,
} from 'lucide-react';

interface EvidenceDrawerProps {
  item: EvidenceItem | null;
  onClose: () => void;
}

export function EvidenceDrawer({ item, onClose }: EvidenceDrawerProps) {
  if (!item) return null;

  const confidencePct =
    typeof item.confidence === 'number'
      ? Math.round(item.confidence > 1 ? item.confidence : item.confidence * 100)
      : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Click outside backdrop to close */}
      <div className="flex-1" onClick={onClose} aria-label="Close drawer backdrop" />

      {/* Slide-over panel */}
      <div className="w-full max-w-lg bg-card border-l border-border shadow-2xl h-full flex flex-col overflow-hidden animate-in slide-in-from-right duration-250">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Specialist Evidence Record
              </h2>
              <p className="text-[11px] text-muted-foreground font-mono">
                Source: {item.source.toUpperCase()}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 rounded-md text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close drawer</span>
          </Button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Classification & Confidence Banner */}
          <div className="p-3 rounded-md border border-border/70 bg-background/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium">Classification:</span>
              <Badge variant={item.classification}>
                {item.classification.toUpperCase()}
              </Badge>
            </div>
            {confidencePct !== null && (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Confidence:</span>
                <span className="font-mono font-medium text-foreground tabular-nums">{confidencePct}%</span>
              </div>
            )}
          </div>

          {/* Finding */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-primary" />
              Specialist Finding
            </h3>
            <div className="p-3.5 rounded-md bg-muted/20 border border-border/80 text-xs text-foreground leading-relaxed font-medium">
              {item.finding || 'No detailed finding text provided.'}
            </div>
          </div>

          {/* Raw Grounded Evidence */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-muted-foreground" />
              Raw Grounded Evidence
            </h3>
            <div className="p-3.5 rounded-md bg-muted/30 border border-border font-mono text-[11px] text-foreground leading-relaxed break-words whitespace-pre-wrap">
              {item.evidence || item.finding || 'No raw snippet recorded for this item.'}
            </div>
          </div>

          {/* Epistemic Grounding Standard Guide */}
          <Card className="border-border/60 bg-muted/10 rounded-md shadow-xs">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                Epistemic Grounding Standard
              </CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 text-[11px] text-muted-foreground space-y-1.5 leading-normal">
              <p>
                <strong className="text-[hsl(var(--success-fg))] font-mono">OBSERVED:</strong> Directly verifiable public fact from live DOM elements, Google Maps verified metadata, or active Meta Ad Library campaigns.
              </p>
              <p>
                <strong className="text-[hsl(var(--warning-fg))] font-mono">INFERRED:</strong> Analytical deduction synthesized by an intelligence specialist based on multiple observed patterns.
              </p>
              <p>
                <strong className="text-muted-foreground font-mono">UNKNOWN:</strong> Information that cannot be publicly verified or confirmed. Never fabricated or assumed.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground font-mono">
            LeadPulse V2 Intelligence Engine
          </span>
          <Button variant="outline" size="sm" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
