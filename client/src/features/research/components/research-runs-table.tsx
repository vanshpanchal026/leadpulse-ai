import React from 'react';
import { ResearchRunRecord } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Terminal,
  Database,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { differenceInSeconds } from 'date-fns';
import { formatSafeDate, formatSafeDuration, toValidDate } from '@/lib/date';

interface RunsTableProps {
  runs: ResearchRunRecord[];
  selectedRunId?: string | null;
  onSelectRun: (runId: string) => void;
  isLoading: boolean;
  onRefresh: () => void;
}

export function ResearchRunsTable({
  runs,
  selectedRunId,
  onSelectRun,
  isLoading,
  onRefresh,
}: RunsTableProps) {
  const formatRunDate = (iso?: string | null) => {
    return formatSafeDate(iso, 'MMM dd, HH:mm', '—');
  };

  const calculateDuration = (start?: string | null, end?: string | null) => {
    const startDate = toValidDate(start);
    const endDate = toValidDate(end);
    if (!startDate || !endDate) return '—';
    const sec = differenceInSeconds(endDate, startDate);
    return formatSafeDuration(Math.max(0, sec));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return (
          <Badge variant="warning" className="text-[9px] px-1.5 py-0 font-mono gap-1">
            <Clock className="h-2.5 w-2.5 animate-spin" />
            RUNNING
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="success" className="text-[9px] px-1.5 py-0 font-mono gap-1">
            <CheckCircle2 className="h-2.5 w-2.5" />
            COMPLETED
          </Badge>
        );
      case 'partial':
        return (
          <Badge variant="warning" className="text-[9px] px-1.5 py-0 font-mono gap-1">
            <AlertTriangle className="h-2.5 w-2.5" />
            PARTIAL
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="text-[9px] px-1.5 py-0 font-mono gap-1">
            <AlertTriangle className="h-2.5 w-2.5" />
            FAILED
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0 font-mono">
            {status.toUpperCase()}
          </Badge>
        );
    }
  };

  return (
    <Card className="border-border bg-card shadow-xs rounded-md">
      <CardHeader className="pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-sm font-medium [font-family:var(--font-display)] flex items-center gap-2 text-foreground">
              <Database className="h-4 w-4 text-muted-foreground" />
              Recent Campaign Research Runs
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Audit trail of research sessions recorded in Supabase and SQLite. Click a row to inspect telemetry.
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-7 text-xs gap-1.5"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {runs.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            <Terminal className="h-6 w-6 mx-auto mb-2 opacity-50" />
            <p className="font-medium text-foreground">No past research runs recorded.</p>
            <p className="text-[11px] mt-1 text-muted-foreground">Launch your first campaign using the form above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary text-[10px] uppercase font-mono text-muted-foreground border-b border-border">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Run ID</th>
                  <th className="py-2.5 px-4 font-medium">Target / Campaign</th>
                  <th className="py-2.5 px-4 font-medium">Status</th>
                  <th className="py-2.5 px-4 font-medium">Started</th>
                  <th className="py-2.5 px-4 font-medium">Duration</th>
                  <th className="py-2.5 px-4 font-medium">Yield (Qual/Found)</th>
                  <th className="py-2.5 px-4 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {runs.map((run) => {
                  const isSelected = selectedRunId === run.run_id;
                  const campaignTitle =
                    run.configuration?.campaign_name ||
                    run.campaign_id ||
                    'General Research';
                  const location = run.configuration?.location || 'Delhi NCR';

                  return (
                    <tr
                      key={run.run_id}
                      onClick={() => onSelectRun(run.run_id)}
                      className={`cursor-pointer transition-[background-color] hover:bg-secondary/70 group ${
                        isSelected ? 'bg-secondary font-medium' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono text-[11px] text-foreground">
                        {run.run_id}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-foreground truncate max-w-[200px]" title={campaignTitle}>
                          {campaignTitle}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                          {location} • {run.configuration?.vertical || 'General'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {getStatusBadge(run.status)}
                      </td>
                      <td className="py-3 px-4 text-[11px] font-mono tabular-nums text-muted-foreground">
                        {formatRunDate(run.started_at || run.created_at)}
                      </td>
                      <td className="py-3 px-4 text-[11px] font-mono tabular-nums text-muted-foreground">
                        {calculateDuration(run.started_at, run.completed_at)}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px]">
                        <span className="text-foreground font-semibold tabular-nums">{run.qualified_leads}</span>
                        <span className="text-muted-foreground tabular-nums"> / {run.businesses_found}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors flex items-center justify-end gap-0.5">
                          <span>Inspect</span>
                          <ChevronRight className="h-3 w-3" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
