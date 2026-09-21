import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  UserCheck,
  Building,
  MapPin,
  Sparkles,
  FileCheck,
} from 'lucide-react';
import { PreSendQualityResult } from '../types';

interface MessageValidationProps {
  validationResult: PreSendQualityResult;
  businessName?: string;
}

export function MessageValidation({
  validationResult,
  businessName,
}: MessageValidationProps) {
  const { level, errors, warnings, personalization, characterCount, sentenceCount } = validationResult;

  return (
    <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-sm font-sans">
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Deterministic Message Validation & Personalization Quality
            </CardTitle>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-muted-foreground font-mono">
              Advisory Pre-Send:
            </span>
            {level === 'PASS' && (
              <Badge variant="success" className="gap-1 text-[9px] font-mono">
                <CheckCircle2 className="h-2.5 w-2.5" />
                PASS
              </Badge>
            )}
            {level === 'WARNING' && (
              <Badge variant="warning" className="gap-1 text-[9px] font-mono">
                <AlertTriangle className="h-2.5 w-2.5" />
                WARNING
              </Badge>
            )}
            {(level === 'BLOCKED' || level === 'BLOCK') && (
              <Badge variant="destructive" className="gap-1 text-[9px] font-mono">
                <XCircle className="h-2.5 w-2.5" />
                BLOCKED
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-3.5 space-y-3.5 text-xs">
        {/* Metric Overview Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
          <div className="p-2 rounded bg-muted/20 border border-border/60">
            <span className="text-[10px] text-muted-foreground font-mono block">Length</span>
            <span
              className={`font-mono font-medium text-xs tabular-nums ${
                characterCount > 300 ? 'text-[hsl(var(--warning-fg))]' : 'text-foreground'
              }`}
            >
              {characterCount} / 300 ch
            </span>
          </div>

          <div className="p-2 rounded-md bg-muted/20 border border-border/60">
            <span className="text-[10px] text-muted-foreground font-mono block">Sentences</span>
            <span
              className={`font-mono font-medium text-xs tabular-nums ${
                sentenceCount < 2 || sentenceCount > 3 ? 'text-[hsl(var(--warning-fg))]' : 'text-foreground'
              }`}
            >
              {sentenceCount} (target: 2–3)
            </span>
          </div>

          <div className="p-2 rounded-md bg-muted/20 border border-border/60">
            <span className="text-[10px] text-muted-foreground font-mono block">Banned Words</span>
            <span
              className={`font-mono font-medium text-xs ${
                validationResult.hasBannedPhrases ? 'text-destructive' : 'text-[hsl(var(--success-fg))]'
              }`}
            >
              {validationResult.hasBannedPhrases ? 'Found' : '0 Banned'}
            </span>
          </div>

          <div className="p-2 rounded-md bg-muted/20 border border-border/60">
            <span className="text-[10px] text-muted-foreground font-mono block">Placeholders</span>
            <span
              className={`font-mono font-medium text-xs ${
                validationResult.hasPlaceholders ? 'text-destructive' : 'text-[hsl(var(--success-fg))]'
              }`}
            >
              {validationResult.hasPlaceholders ? 'Unfilled' : '0 Placeholders'}
            </span>
          </div>
        </div>

        {/* 1. Errors & Blocking Rules */}
        {errors.length > 0 && (
          <div className="p-2.5 rounded-md bg-[hsl(var(--destructive)/0.08)] border border-[hsl(var(--destructive)/0.3)] space-y-1.5 text-destructive">
            <div className="flex items-center gap-1.5 font-medium text-[11px] text-destructive">
              <XCircle className="h-3.5 w-3.5" />
              <span>Blocking Issues Detected:</span>
            </div>
            <ul className="space-y-1 pl-4 list-disc text-[11px] text-destructive/90">
              {errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 2. Warnings & Heuristics */}
        {warnings.length > 0 && (
          <div className="p-2.5 rounded-md border border-[hsl(var(--warning-border))] bg-[hsl(var(--warning-bg))] space-y-1.5 text-[hsl(var(--warning-fg))]">
            <div className="flex items-center gap-1.5 font-medium text-[11px] text-[hsl(var(--warning-fg))]">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Advisory Quality Warnings:</span>
            </div>
            <ul className="space-y-1 pl-4 list-disc text-[11px] text-[hsl(var(--warning-fg))]/90">
              {warnings.map((warn, i) => (
                <li key={i}>{warn}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 3. Personalization Quality Indicator */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[10px] font-mono uppercase text-muted-foreground tracking-wider flex items-center gap-1">
            <UserCheck className="h-3 w-3 text-primary" />
            <span>Personalization Indicators</span>
          </span>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
            <div className="p-2 rounded bg-muted/15 border border-border/50 flex items-center justify-between">
              <span className="text-zinc-300 flex items-center gap-1">
                <Building className="h-3 w-3 text-muted-foreground" />
                Business Name
              </span>
              {personalization.businessNameUsed ? (
                <Badge variant="success" className="text-[8px] px-1 py-0 font-mono">
                  Referenced
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[8px] px-1 py-0 font-mono">
                  Unknown
                </Badge>
              )}
            </div>

            <div className="p-2 rounded bg-muted/15 border border-border/50 flex items-center justify-between">
              <span className="text-zinc-300 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-muted-foreground" />
                Service / Angle
              </span>
              {personalization.serviceReferenced ? (
                <Badge variant="success" className="text-[8px] px-1 py-0 font-mono">
                  Referenced
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[8px] px-1 py-0 font-mono">
                  Unknown
                </Badge>
              )}
            </div>

            <div className="p-2 rounded bg-muted/15 border border-border/50 flex items-center justify-between">
              <span className="text-zinc-300 flex items-center gap-1">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                City / Location
              </span>
              {personalization.locationReferenced ? (
                <Badge variant="success" className="text-[8px] px-1 py-0 font-mono">
                  Referenced
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[8px] px-1 py-0 font-mono">
                  Unknown
                </Badge>
              )}
            </div>

            <div className="p-2 rounded bg-muted/15 border border-border/50 flex items-center justify-between">
              <span className="text-zinc-300 flex items-center gap-1">
                <FileCheck className="h-3 w-3 text-muted-foreground" />
                Evidence Metric
              </span>
              {personalization.evidenceReferenced ? (
                <Badge variant="success" className="text-[8px] px-1 py-0 font-mono">
                  Grounded
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[8px] px-1 py-0 font-mono">
                  Unknown
                </Badge>
              )}
            </div>

            <div className="p-2 rounded bg-muted/15 border border-border/50 flex items-center justify-between col-span-2 sm:col-span-2">
              <span className="text-zinc-300">Opening Quality</span>
              {personalization.genericOpeningDetected ? (
                <Badge variant="warning" className="text-[8px] px-1 py-0 font-mono">
                  Generic Opening
                </Badge>
              ) : (
                <Badge variant="success" className="text-[8px] px-1 py-0 font-mono">
                  Consultative Opening
                </Badge>
              )}
            </div>
          </div>
        </div>

        {level === 'PASS' && (
          <p className="text-[11px] text-[hsl(var(--success-fg))] leading-tight pt-1">
            ✓ Pitch complies with deterministic anti-spam boundaries: concise, grounded, and free of sales pressure buzzwords.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
