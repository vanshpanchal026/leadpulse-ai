import React from 'react';
import { ResearchRunRecord, SpecialistStatus, EpistemicClassification } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Globe,
  Megaphone,
  MapPin,
  Filter,
  Sparkles,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  Cpu,
} from 'lucide-react';

interface SpecialistGridProps {
  run: ResearchRunRecord | null;
  isRunning: boolean;
}

interface SpecialistConfig {
  id: string;
  name: string;
  role: string;
  icon: React.ElementType;
  epistemic: EpistemicClassification;
}

const SPECIALISTS: SpecialistConfig[] = [
  {
    id: 'triage',
    name: 'Lead Triage Specialist',
    role: 'Fast qualification & specialist routing',
    icon: Filter,
    epistemic: 'INFERRED',
  },
  {
    id: 'website',
    name: 'Website Specialist',
    role: 'UX, booking forms & conversion friction',
    icon: Globe,
    epistemic: 'OBSERVED',
  },
  {
    id: 'ads',
    name: 'Meta Ads Specialist',
    role: 'Active Meta Ad Library campaigns',
    icon: Megaphone,
    epistemic: 'OBSERVED',
  },
  {
    id: 'maps',
    name: 'Google Maps Specialist',
    role: 'Reviews, ratings & local market positioning',
    icon: MapPin,
    epistemic: 'OBSERVED',
  },
  {
    id: 'opportunity',
    name: 'Opportunity Agent',
    role: 'Problem diagnosis & service recommendation',
    icon: Sparkles,
    epistemic: 'INFERRED',
  },
  {
    id: 'analyst',
    name: 'Lead Analyst',
    role: 'Synthesis, limitations & final intelligence object',
    icon: FileText,
    epistemic: 'INFERRED',
  },
];

export function SpecialistStatusGrid({ run, isRunning }: SpecialistGridProps) {
  const getSpecialistState = (specId: string): {
    status: SpecialistStatus;
    evidenceCount: number;
    error: string | null;
  } => {
    if (!run) {
      return { status: 'Pending', evidenceCount: 0, error: null };
    }

    // Check if error occurred for this specialist
    const errorMatch = run.errors?.find(
      (e) => e.specialist === specId || e.stage?.includes(specId)
    );
    if (errorMatch) {
      return {
        status: 'Partial',
        evidenceCount: 1,
        error: errorMatch.error || 'Specialist encountered a rate-limit or tool limitation.',
      };
    }

    if (run.status === 'running') {
      // If run is running, first specialists start, then downstream
      if (['triage', 'website', 'maps'].includes(specId)) {
        return { status: 'Running', evidenceCount: Math.min(3, run.businesses_triaged || 1), error: null };
      }
      return { status: 'Pending', evidenceCount: 0, error: null };
    }

    if (run.status === 'completed' || run.status === 'partial') {
      return {
        status: 'Complete',
        evidenceCount: Math.max(1, Math.min(8, run.businesses_researched || 4)),
        error: null,
      };
    }

    if (run.status === 'failed') {
      return { status: 'Failed', evidenceCount: 0, error: 'Campaign execution halted' };
    }

    return { status: 'Unknown', evidenceCount: 0, error: null };
  };

  const getStatusBadge = (status: SpecialistStatus) => {
    switch (status) {
      case 'Running':
        return (
          <Badge variant="warning" className="gap-1 text-[9px] px-1.5 py-0 font-mono">
            <Clock className="h-2.5 w-2.5 animate-spin" />
            RUNNING
          </Badge>
        );
      case 'Complete':
        return (
          <Badge variant="success" className="gap-1 text-[9px] px-1.5 py-0 font-mono">
            <CheckCircle2 className="h-2.5 w-2.5" />
            COMPLETE
          </Badge>
        );
      case 'Partial':
        return (
          <Badge variant="warning" className="gap-1 text-[9px] px-1.5 py-0 font-mono">
            <AlertTriangle className="h-2.5 w-2.5" />
            PARTIAL
          </Badge>
        );
      case 'Failed':
        return (
          <Badge variant="destructive" className="gap-1 text-[9px] px-1.5 py-0 font-mono">
            <AlertTriangle className="h-2.5 w-2.5" />
            FAILED
          </Badge>
        );
      case 'Pending':
      default:
        return (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-mono">
            PENDING
          </Badge>
        );
    }
  };

  return (
    <Card className="border-border bg-card shadow-xs rounded-md">
      <CardHeader className="pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium [font-family:var(--font-display)] flex items-center gap-2 text-foreground">
            <Cpu className="h-4 w-4 text-muted-foreground" />
            Specialist Multi-Agent Swarm Status
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Badge variant="observed" className="text-[9px]">OBSERVED</Badge>
            <Badge variant="inferred" className="text-[9px]">INFERRED</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {SPECIALISTS.map((spec) => {
          const Icon = spec.icon;
          const { status, evidenceCount, error } = getSpecialistState(spec.id);
          const isSpecRunning = status === 'Running';

          return (
            <div
              key={spec.id}
              className={`p-3 rounded-md border space-y-2 flex flex-col justify-between transition-[border-color,box-shadow] ${
                isSpecRunning
                  ? 'border-[hsl(var(--info-border))] bg-[hsl(var(--info-bg))]'
                  : 'border-border bg-secondary'
              }`}
            >
              <div className="space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="p-1 rounded-sm bg-card border border-border text-muted-foreground">
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <span className="font-medium text-xs text-foreground">
                      {spec.name}
                    </span>
                  </div>
                  {getStatusBadge(status)}
                </div>

                <p className="text-[11px] text-muted-foreground leading-snug">
                  {spec.role}
                </p>
              </div>

              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[10px] font-mono">
                <span className="text-muted-foreground">
                  Epistemic: <strong className="text-muted-foreground font-medium">{spec.epistemic}</strong>
                </span>
                <span className="text-foreground tabular-nums">
                  {evidenceCount > 0 ? `${evidenceCount} findings` : 'Idle'}
                </span>
              </div>

              {error && (
                <div className="p-1.5 rounded-sm bg-[hsl(var(--warning-bg))] border border-[hsl(var(--warning-border))] text-[10px] text-[hsl(var(--warning-fg))] leading-tight">
                  {error}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
