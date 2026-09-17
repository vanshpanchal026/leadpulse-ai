'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  RefreshCw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Database,
  Cpu,
  Layers,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { AgentProgressIndicator, ResearchRunRecord } from './AgentProgressIndicator';
import { ResearchCampaignModal } from './ResearchCampaignModal';

interface ResearchRunsPanelProps {
  onNotify?: (text: string, type: 'success' | 'error') => void;
  onViewLeads?: () => void;
}

export function ResearchRunsPanel({ onNotify, onViewLeads }: ResearchRunsPanelProps) {
  const [runs, setRuns] = useState<ResearchRunRecord[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchRuns = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/research');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items = Array.isArray(data.items) ? data.items : [];
      setRuns(items);
      if (items.length > 0 && !selectedRunId) {
        setSelectedRunId(items[0].run_id);
      }
    } catch (err: any) {
      console.warn('Could not load research runs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedRunId]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Live polling every 3s while any run is pending or running
  useEffect(() => {
    const hasActiveRun = runs.some((r) => r.status === 'running' || r.status === 'pending');
    if (!hasActiveRun) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/research');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.items)) {
            setRuns(data.items);
          }
        }
      } catch {
        // silent polling failure
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [runs]);

  const activeRun = runs.find((r) => r.run_id === selectedRunId) || runs[0] || null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
            <Clock className="w-2.5 h-2.5 animate-spin" />
            RUNNING
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-2.5 h-2.5" />
            COMPLETED
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-2.5 h-2.5" />
            PARTIAL
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
            <AlertCircle className="w-2.5 h-2.5" />
            FAILED
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#f5f5f5] dark:bg-[#262626] text-[#737373]">
            {status.toUpperCase()}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-[#737373] block">
            V2 AUTONOMOUS RESEARCH ENGINE
          </span>
          <h1 className="text-3xl font-semibold tracking-tight text-[#0a0a0a] dark:text-white mt-0.5">
            Campaign Intelligence Swarm
          </h1>
          <p className="text-xs text-[#737373] mt-1">
            Autonomous multi-agent research cycles powered by OpenAI Agents SDK and bounded by strict whitelists
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchRuns}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[#e5e5e5] dark:border-[#262626] hover:bg-[#fafafa] dark:hover:bg-[#1a1a1a] text-xs font-medium text-[#0a0a0a] dark:text-white transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Sync Runs</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0a0a0a] hover:bg-[#171717] dark:bg-white dark:hover:bg-[#ededed] text-white dark:text-[#0a0a0a] text-xs font-medium shadow-sm transition-all cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Launch New Research</span>
          </button>
        </div>
      </div>

      {/* Active Run Monitor */}
      {activeRun && <AgentProgressIndicator run={activeRun} />}

      {/* Runs Table Card */}
      <div className="bg-[#ffffff] dark:bg-[#141414] border border-[#e5e5e5] dark:border-[#262626] rounded-2xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e5e5e5] dark:border-[#262626] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#737373]" />
            <h2 className="text-sm font-semibold text-[#0a0a0a] dark:text-white">
              Campaign Research History
            </h2>
          </div>
          <span className="text-xs text-[#737373] font-mono">
            {runs.length} recorded runs
          </span>
        </div>

        {runs.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#737373] space-y-2">
            <Cpu className="w-8 h-8 mx-auto opacity-40" />
            <p className="font-medium text-[#0a0a0a] dark:text-white">No research runs recorded yet.</p>
            <p className="text-[11px]">Click "Launch New Research" to start your first bounded autonomous campaign.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#fafafa] dark:bg-[#171717] text-[10px] uppercase font-mono text-[#737373] border-b border-[#e5e5e5] dark:border-[#262626]">
                <tr>
                  <th className="py-3 px-6 font-medium">Run ID</th>
                  <th className="py-3 px-6 font-medium">Campaign Target</th>
                  <th className="py-3 px-6 font-medium">Status</th>
                  <th className="py-3 px-6 font-medium">Yield (Qual / Found)</th>
                  <th className="py-3 px-6 font-medium">Tokens Used</th>
                  <th className="py-3 px-6 font-medium">Date</th>
                  <th className="py-3 px-6 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e5e5e5] dark:divide-[#262626]">
                {runs.map((run) => {
                  const isSelected = run.run_id === selectedRunId;
                  const campaignName =
                    run.configuration?.campaign_name || run.campaign_id || 'Autonomous Campaign';
                  const locations = (run.configuration?.locations || ['Delhi NCR']).join(', ');
                  const vertical = (run.configuration?.verticals || ['General']).join(', ');

                  return (
                    <tr
                      key={run.run_id}
                      onClick={() => setSelectedRunId(run.run_id)}
                      className={`cursor-pointer transition-colors hover:bg-[#fafafa] dark:hover:bg-[#1a1a1a] ${
                        isSelected ? 'bg-[#f5f5f5] dark:bg-[#1c1c1c]' : ''
                      }`}
                    >
                      <td className="py-3.5 px-6 font-mono text-[11px] font-semibold text-[#0a0a0a] dark:text-white">
                        {run.run_id}
                      </td>
                      <td className="py-3.5 px-6">
                        <div className="font-medium text-[#0a0a0a] dark:text-white">
                          {campaignName}
                        </div>
                        <div className="text-[10px] text-[#737373]">
                          {locations} • {vertical}
                        </div>
                      </td>
                      <td className="py-3.5 px-6">{getStatusBadge(run.status)}</td>
                      <td className="py-3.5 px-6 font-mono">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {run.qualified_leads}
                        </span>
                        <span className="text-[#737373]"> / {run.businesses_found}</span>
                      </td>
                      <td className="py-3.5 px-6 font-mono text-[#737373]">
                        {run.total_tokens ? run.total_tokens.toLocaleString() : '0'}
                      </td>
                      <td className="py-3.5 px-6 text-[11px] text-[#737373]">
                        {run.created_at ? new Date(run.created_at).toLocaleDateString() : 'Today'}
                      </td>
                      <td className="py-3.5 px-6 text-right">
                        <span className="text-[11px] font-medium text-[#0a0a0a] dark:text-white hover:underline flex items-center justify-end gap-0.5">
                          <span>Inspect</span>
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Campaign Modal */}
      <ResearchCampaignModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onRunCreated={(runId) => {
          setSelectedRunId(runId);
          fetchRuns();
        }}
        onNotify={onNotify}
      />
    </div>
  );
}
