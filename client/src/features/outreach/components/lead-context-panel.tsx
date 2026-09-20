import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Building2,
  MapPin,
  Sparkles,
  ExternalLink,
  Globe,
  Phone,
  Layers,
  Flame,
  CheckCircle2,
  XCircle,
  HelpCircle,
} from 'lucide-react';
import { OutreachItem } from '../types';
import { getOpportunityScoreColor, parseStructuredPoints } from '@/lib/utils';

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

interface LeadContextPanelProps {
  item: OutreachItem;
}

export function LeadContextPanel({ item }: LeadContextPanelProps) {
  const scoreInfo = getOpportunityScoreColor(item.opportunityScore);

  return (
    <div className="space-y-4 font-sans">
      {/* 1. Header & Lead Identification */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-sm">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <Building2 className="h-4 w-4 text-primary shrink-0" />
                <CardTitle className="text-base font-medium [font-family:var(--font-display)] text-foreground">
                  {item.businessName}
                </CardTitle>
                <div
                  className={`px-2 py-0.5 rounded-md border text-xs font-medium font-mono tabular-nums ${scoreInfo.bgClass} ${scoreInfo.borderClass} ${scoreInfo.textClass}`}
                >
                  {item.opportunityScore}/10 ({item.opportunityTier})
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground font-mono">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {item.location || 'NCR Region'}
                </span>
                <span>•</span>
                <span>{item.category || 'Local Business'}</span>
                <span>•</span>
                <span className="tabular-nums">
                  Confidence: {Math.round(item.confidence > 1 ? item.confidence : item.confidence * 100)}%
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              asChild
              className="h-8 gap-1.5 text-xs self-start shrink-0"
            >
              <Link to={`/leads/${encodeURIComponent(item.id)}`}>
                <ExternalLink className="h-3.5 w-3.5" />
                Open Dossier
              </Link>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-3.5 space-y-3 text-xs">
          {/* Problem & Recommended Service */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-2.5 rounded-md bg-muted/20 border border-border/60 space-y-1">
              <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
                Primary Operational Friction
              </span>
              <p className="text-xs text-foreground font-medium">
                {item.primaryProblem || 'Operational friction in lead response & intake.'}
              </p>
            </div>

            <div className="p-2.5 rounded-md bg-muted/20 border border-border/60 space-y-1">
              <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider block">
                Recommended Consulting Service
              </span>
              <p className="text-xs text-primary font-medium flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                {item.recommendedService || 'WhatsApp AI Booking Assistant'}
              </p>
            </div>
          </div>

          {/* Strategic Rationale */}
          {item.whyThisService && (() => {
            const whyPoints = parseStructuredPoints(item.whyThisService);
            return (
              <div className="p-3 rounded-md bg-black/20 border border-border/40 text-muted-foreground leading-relaxed space-y-2">
                <div className="text-foreground font-semibold text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--success-fg))]" />
                  <span>Strategic Rationale (Why This Service)</span>
                </div>
                {whyPoints.length > 1 || (whyPoints.length === 1 && (whyPoints[0].number || whyPoints[0].label)) ? (
                  <ul className="space-y-2 pt-0.5">
                    {whyPoints.map((point, index) => (
                      <li key={index} className="flex items-start gap-2 text-xs leading-relaxed">
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
                ) : (
                  <p className="text-xs text-foreground/90 font-medium">
                    {item.whyThisService}
                  </p>
                )}
              </div>
            );
          })()}

          {/* Value Hypothesis & Pitch Angle if provided */}
          {(item.pitchAngle || item.valueHypothesis) && (
            <div className="p-2.5 rounded-md bg-primary/5 border border-primary/20 space-y-1">
              {item.pitchAngle && (
                <div className="text-[11px] text-zinc-300">
                  <span className="text-primary font-semibold font-mono text-[10px] uppercase">
                    Pitch Angle:{' '}
                  </span>
                  {item.pitchAngle}
                </div>
              )}
              {item.valueHypothesis && (
                <div className="text-[11px] text-muted-foreground">
                  <span className="text-primary font-semibold font-mono text-[10px] uppercase">
                    Value Hypothesis:{' '}
                  </span>
                  {item.valueHypothesis}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Digital Footprint & Channels Status */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-sm">
        <CardHeader className="pb-2.5 border-b border-border/60">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider flex items-center justify-between text-muted-foreground">
            <span>Digital Footprint & Verified Channels</span>
            <Badge variant="outline" className="text-[9px] font-mono">
              Manual Dispatch Only
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="pt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          {/* Website */}
          <div className="p-2 rounded-md border border-border/60 bg-muted/15 space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 font-semibold text-[11px] text-foreground">
                <Globe className="h-3 w-3 text-muted-foreground" />
                Website
              </span>
              {item.websiteUrl ? (
                <Badge variant="success" className="text-[8px] px-1 py-0 font-mono">
                  Verified
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[8px] px-1 py-0 font-mono">
                  Unknown
                </Badge>
              )}
            </div>
            <div className="text-[11px] text-foreground truncate">
              {item.websiteUrl ? (
                <a
                  href={item.websiteUrl.startsWith('http') ? item.websiteUrl : `https://${item.websiteUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline text-primary flex items-center gap-0.5 truncate"
                >
                  <span>Visit site</span>
                  <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                </a>
              ) : (
                'Unknown'
              )}
            </div>
          </div>

          {/* Google Maps */}
          <div className="p-2 rounded-md border border-border/60 bg-muted/15 space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 font-semibold text-[11px] text-foreground">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                Maps
              </span>
              {item.googleMapsUrl ? (
                <Badge variant="success" className="text-[8px] px-1 py-0 font-mono">
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[8px] px-1 py-0 font-mono">
                  Unknown
                </Badge>
              )}
            </div>
            <div className="text-[11px] text-foreground truncate">
              {item.googleMapsUrl ? (
                <a
                  href={item.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline text-primary flex items-center gap-0.5 truncate"
                >
                  <span>Listing</span>
                  <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                </a>
              ) : (
                'Unknown'
              )}
            </div>
          </div>

          {/* Instagram */}
          <div className="p-2 rounded-md border border-border/60 bg-muted/15 space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 font-semibold text-[11px] text-foreground">
                <InstagramIcon className="h-3 w-3 text-muted-foreground" />
                Instagram
              </span>
              {item.instagramUrl ? (
                <Badge variant="success" className="text-[8px] px-1 py-0 font-mono">
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[8px] px-1 py-0 font-mono">
                  Unknown
                </Badge>
              )}
            </div>
            <div className="text-[11px] text-foreground truncate">
              {item.instagramUrl ? (
                <a
                  href={item.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline text-primary flex items-center gap-0.5 truncate"
                >
                  <span>Profile</span>
                  <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                </a>
              ) : (
                'Unknown'
              )}
            </div>
          </div>

          {/* Active Ads */}
          <div className="p-2 rounded-md border border-border/60 bg-muted/15 space-y-1">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 font-semibold text-[11px] text-foreground">
                <Flame className="h-3 w-3 text-muted-foreground" />
                Meta Ads
              </span>
              {item.hasActiveAds ? (
                <Badge variant="success" className="text-[8px] px-1 py-0 font-mono">
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[8px] px-1 py-0 font-mono">
                  None
                </Badge>
              )}
            </div>
            <div className="text-[11px] text-muted-foreground font-mono truncate">
              {item.hasActiveAds ? 'Active Campaigns' : 'No active ads'}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Epistemic Evidence Grounding */}
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-sm">
        <CardHeader className="pb-2.5 border-b border-border/60">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 text-muted-foreground">
              <Layers className="h-3.5 w-3.5 text-primary" />
              Grounded Evidence Matrix
            </CardTitle>
            <div className="flex items-center gap-1.5">
              <Badge variant="observed" className="text-[9px]">
                {item.observedCount} OBSERVED
              </Badge>
              <Badge variant="inferred" className="text-[9px]">
                {item.inferredCount} INFERRED
              </Badge>
              {item.unknownCount > 0 && (
                <Badge variant="unknown" className="text-[9px]">
                  {item.unknownCount} UNKNOWN
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-3 space-y-2">
          {item.evidence.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">
              No specific evidence items recorded. Displaying: Unknown.
            </p>
          ) : (
            item.evidence.slice(0, 4).map((ev, idx) => {
              const confPct =
                typeof ev.confidence === 'number'
                  ? Math.round(ev.confidence > 1 ? ev.confidence : ev.confidence * 100)
                  : null;

              return (
                <div
                  key={idx}
                  className="p-2.5 rounded-md bg-muted/15 border border-border/60 space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Badge variant={ev.classification} className="text-[8px] px-1 py-0">
                        {ev.classification.toUpperCase()}
                      </Badge>
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">
                        {ev.source}
                      </span>
                    </div>
                    {confPct !== null && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {confPct}% conf
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-foreground font-medium leading-snug">
                    {ev.finding}
                  </p>

                  {ev.evidence && (
                    <p className="text-[11px] text-muted-foreground font-mono bg-black/20 p-1 rounded border border-border/40 truncate">
                      {ev.evidence}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
