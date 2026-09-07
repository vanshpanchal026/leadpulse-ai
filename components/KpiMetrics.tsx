'use client';

import React from 'react';
import { 
  Target, 
  Users, 
  MessageSquareCode, 
  DollarSign, 
} from 'lucide-react';
import { LeadStats, LeadIntent } from '@/lib/types';

interface KpiMetricsProps {
  stats: LeadStats | null;
  currentIntent: 'ALL' | LeadIntent;
  onSelectIntent: (intent: 'ALL' | LeadIntent) => void;
  onlyContactable: boolean;
  onToggleContactable: () => void;
  onlyBudget: boolean;
  onToggleBudget: () => void;
}

export const KpiMetrics: React.FC<KpiMetricsProps> = ({
  stats,
  currentIntent,
  onSelectIntent,
  onlyContactable,
  onToggleContactable,
  onlyBudget,
  onToggleBudget,
}) => {
  const hiringCount = stats?.hiringCount ?? 7;
  const totalPosts = stats?.totalPosts ?? 170;
  const hiringRate = totalPosts > 0 ? ((hiringCount / totalPosts) * 100).toFixed(1) : '0';
  const contactable = stats?.contactableCount ?? 0;
  const budgetCount = stats?.budgetCount ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Total Crawled */}
      <div
        onClick={() => onSelectIntent('ALL')}
        className={`bg-[#ffffff] p-6 rounded-[24px] border card-elevation-hover transition-all cursor-pointer ${
          currentIntent === 'ALL' && !onlyContactable && !onlyBudget
            ? 'border-[#0a0a0a] ring-2 ring-[#0a0a0a]/5 shadow-md'
            : 'border-[#e5e5e5]'
        }`}
      >
        <div className="flex items-center justify-between text-xs text-[#737373] font-medium uppercase tracking-wider">
          <span>Total Crawled</span>
          <Users className="w-4 h-4 text-[#737373]" />
        </div>
        <div className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-[#0a0a0a]">
          {totalPosts}
        </div>
        <div className="mt-2 text-xs text-[#737373]">8 Subreddits active</div>
      </div>

      {/* 2. High-Intent Hiring */}
      <div
        onClick={() => onSelectIntent(currentIntent === 'HIRING' ? 'ALL' : 'HIRING')}
        className={`bg-[#ffffff] p-6 rounded-[24px] border card-elevation-hover transition-all cursor-pointer ${
          currentIntent === 'HIRING'
            ? 'border-[#0a0a0a] ring-2 ring-[#0a0a0a]/5 shadow-md'
            : 'border-[#e5e5e5]'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#737373] font-medium uppercase tracking-wider">High-Intent</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600 border border-red-200">
            Score ≥ 8
          </span>
        </div>
        <div className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-[#0a0a0a]">
          {hiringCount}
        </div>
        <div className="mt-2 text-xs text-[#737373]">{hiringRate}% of total posts</div>
      </div>

      {/* 3. Direct Contact Channels */}
      <div
        onClick={onToggleContactable}
        className={`bg-[#ffffff] p-6 rounded-[24px] border card-elevation-hover transition-all cursor-pointer ${
          onlyContactable
            ? 'border-[#0a0a0a] ring-2 ring-[#0a0a0a]/5 shadow-md'
            : 'border-[#e5e5e5]'
        }`}
      >
        <div className="flex items-center justify-between text-xs text-[#737373] font-medium uppercase tracking-wider">
          <span>Direct Channels</span>
          <MessageSquareCode className="w-4 h-4 text-[#737373]" />
        </div>
        <div className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-[#0a0a0a]">
          {contactable}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-[#737373]">
          <span>Email, TG, Discord</span>
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${
            onlyContactable
              ? 'bg-[#0a0a0a] text-white border-[#0a0a0a] shadow-xs'
              : 'bg-[#fafafa] text-[#737373] border-[#e5e5e5]'
          }`}>
            {onlyContactable ? 'Active' : 'Toggle'}
          </span>
        </div>
      </div>

      {/* 4. Disclosed Budget */}
      <div
        onClick={onToggleBudget}
        className={`bg-[#ffffff] p-6 rounded-[24px] border card-elevation-hover transition-all cursor-pointer ${
          onlyBudget
            ? 'border-[#0a0a0a] ring-2 ring-[#0a0a0a]/5 shadow-md'
            : 'border-[#e5e5e5]'
        }`}
      >
        <div className="flex items-center justify-between text-xs text-[#737373] font-medium uppercase tracking-wider">
          <span>Disclosed Budget</span>
          <DollarSign className="w-4 h-4 text-[#737373]" />
        </div>
        <div className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight text-[#0a0a0a]">
          {budgetCount}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-[#737373]">
          <span>Rates & Fixed quotes</span>
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium border ${
            onlyBudget
              ? 'bg-[#0a0a0a] text-white border-[#0a0a0a] shadow-xs'
              : 'bg-[#fafafa] text-[#737373] border-[#e5e5e5]'
          }`}>
            {onlyBudget ? 'Active' : 'Toggle'}
          </span>
        </div>
      </div>
    </div>
  );
};
