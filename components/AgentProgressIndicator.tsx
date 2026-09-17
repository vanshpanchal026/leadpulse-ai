'use client';

import React from 'react';
import {
  Compass,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Sparkles,
  Send,
  Zap,
  ShieldCheck,
} from 'lucide-react';

export interface ResearchRunRecord {
  run_id: string;
  campaign_id?: string | null;
  status: 'pending' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled';
  started_at?: string | null;
  completed_at?: string | null;
  queries_generated: number;
  businesses_found: number;
  businesses_filtered: number;
  businesses_triaged: number;
  businesses_researched: number;
  qualified_leads: number;
  total_tokens: number;
  tool_calls: number;
  apify_calls: number;
  errors?: Array<{ specialist?: string; stage?: string; error?: string; business?: string }>;
  configuration?: Record<string, any>;
  created_at?: string;
}

interface AgentProgressIndicatorProps {
  run: ResearchRunRecord | null;
}

interface PipelineStage {
  id: string;
  name: string;
  agentRole: string;
  icon: React.ElementType;
  description: string;
}

const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: 'search',
    name: 'Search Strategist',
    agentRole: 'AI Query Formulation',
    icon: Compass,
    description: 'Generates targeted geo & vertical queries with boundary whitelists',
  },
  {
    id: 'discovery',
    name: 'Discovery Layer',
    agentRole: 'Apify Tools Scraper',
    icon: Search,
    description: 'Scrapes Maps & Ads, normalizes phone/names, deduplicates candidates',
  },
  {
    id: 'triage',
    name: 'Lead Triage',
    agentRole: 'Deterministic Fast-Path',
    icon: Zap,
    description: 'Filters low-fit candidates (score < 4 = 0 token rejection)',
  },
  {
    id: 'specialists',
    name: 'Specialist Swarm',
    agentRole: 'Website, Ads & Maps',
    icon: Layers,
    description: 'Parallel audit of booking friction, ad copy & review sentiment',
  },
  {
    id: 'opportunity',
    name: 'Opportunity & Analyst',
    agentRole: 'Synthesis & Match',
    icon: Sparkles,
    description: 'Matches 7 canonical services, assesses ROI & assigns confidence',
  },
  {
    id: 'outreach',
    name: 'Outreach & Guardrails',
    agentRole: 'Drafting & Validation',
    icon: Send,
    description: 'Writes <=300 char hyper-specific pitch, checks banned phrases',
  },
];

export function AgentProgressIndicator({ run }: AgentProgressIndicatorProps) {
  if (!run) return null;

  const isRunning = run.status === 'running';
  const isComplete = run.status === 'completed' || run.status === 'partial';
  const isFailed = run.status === 'failed';

  const getStageState = (stageIndex: number): 'completed' | 'active' | 'pending' | 'failed' => {
    if (isFailed) return stageIndex === 0 ? 'failed' : 'pending';
    if (isComplete) return 'completed';

    if (isRunning) {
      if (stageIndex === 0 && run.queries_generated === 0) return 'active';
      if (stageIndex === 1 && run.businesses_found === 0) return 'active';
      if (stageIndex === 2 && run.businesses_triaged === 0) return 'active';
      if (stageIndex === 3 && run.businesses_researched === 0) return 'active';
      if (stageIndex === 4 && run.qualified_leads === 0) return 'active';
      if (stageIndex === 5) return 'active';
      return 'completed';
    }

    return 'pending';
  };

  return (
    <div className="bg-[#ffffff] dark:bg-[#141414] border border-[#e5e5e5] dark:border-[#262626] rounded-2xl p-5 shadow-xs space-y-4">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#e5e5e5] dark:border-[#262626]">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold text-[#0a0a0a] dark:text-white">
            Run Pipeline Monitor: <span className="font-mono text-[11px] text-[#737373]">{run.run_id}</span>
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#f5f5f5] dark:bg-[#262626] text-[#525252] dark:text-[#d4d4d4] uppercase font-mono">
            {run.status}
          </span>
        </div>

        {/* Live Counters */}
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-mono">
          <div className="px-2.5 py-1 rounded-lg bg-[#fafafa] dark:bg-[#1a1a1a] border border-[#e5e5e5] dark:border-[#262626] text-[#525252] dark:text-[#d4d4d4]">
            Queries: <strong className="text-[#0a0a0a] dark:text-white">{run.queries_generated}</strong>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-[#fafafa] dark:bg-[#1a1a1a] border border-[#e5e5e5] dark:border-[#262626] text-[#525252] dark:text-[#d4d4d4]">
            Found: <strong className="text-[#0a0a0a] dark:text-white">{run.businesses_found}</strong>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-[#fafafa] dark:bg-[#1a1a1a] border border-[#e5e5e5] dark:border-[#262626] text-[#525252] dark:text-[#d4d4d4]">
            Researched: <strong className="text-[#0a0a0a] dark:text-white">{run.businesses_researched}</strong>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300">
            Qualified: <strong className="font-bold">{run.qualified_leads}</strong>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/40 text-purple-700 dark:text-purple-300">
            Tokens: <strong className="font-bold">{run.total_tokens.toLocaleString()}</strong>
          </div>
        </div>
      </div>

      {/* Stage Flow Nodes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-2.5 pt-1">
        {PIPELINE_STAGES.map((stage, idx) => {
          const Icon = stage.icon;
          const state = getStageState(idx);

          return (
            <div
              key={stage.id}
              className={`p-3 rounded-xl border transition-all relative flex flex-col justify-between ${
                state === 'completed'
                  ? 'border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20'
                  : state === 'active'
                  ? 'border-blue-500/60 bg-blue-50/50 dark:bg-blue-950/30 ring-1 ring-blue-400/40'
                  : state === 'failed'
                  ? 'border-red-500/50 bg-red-50/40 dark:bg-red-950/20'
                  : 'border-[#e5e5e5] dark:border-[#262626] bg-[#fafafa] dark:bg-[#171717] opacity-60'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div
                      className={`p-1 rounded-md ${
                        state === 'completed'
                          ? 'bg-emerald-500 text-white'
                          : state === 'active'
                          ? 'bg-blue-500 text-white animate-pulse'
                          : 'bg-[#eaeaea] dark:bg-[#262626] text-[#737373]'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-[10px] font-mono text-[#737373]">0{idx + 1}</span>
                  </div>

                  {state === 'completed' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : state === 'active' ? (
                    <Clock className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                  ) : state === 'failed' ? (
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                  ) : (
                    <div className="w-1.5 h-1.5 rounded-full bg-[#d4d4d4] dark:bg-[#404040]" />
                  )}
                </div>

                <div className="font-semibold text-xs text-[#0a0a0a] dark:text-white leading-tight">
                  {stage.name}
                </div>
                <div className="text-[10px] text-[#737373] mt-0.5 font-medium">
                  {stage.agentRole}
                </div>
              </div>

              <div className="text-[9px] text-[#737373] mt-2 pt-2 border-t border-[#e5e5e5]/60 dark:border-[#262626]/60 leading-tight">
                {stage.description}
              </div>
            </div>
          );
        })}
      </div>

      {/* Safety Notice Footer */}
      <div className="flex items-center justify-between text-[11px] text-[#737373] pt-1">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>Strict Zero-Auto-Send Policy: generated outreach proposals strictly require human click-to-dispatch</span>
        </div>
        {run.errors && run.errors.length > 0 && (
          <span className="text-amber-500 text-[10px] font-medium">
            {run.errors.length} non-blocking warning(s) handled gracefully
          </span>
        )}
      </div>
    </div>
  );
}
