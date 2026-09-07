'use client';

import React from 'react';
import { Search, X, ArrowUpDown } from 'lucide-react';
import { FilterState, LeadIntent } from '@/lib/types';

interface FilterBarProps {
  filter: FilterState;
  onFilterChange: (newFilter: Partial<FilterState>) => void;
  availableSubreddits: string[];
  availableKeywords: string[];
  totalFilteredCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filter,
  onFilterChange,
  availableSubreddits,
  availableKeywords,
  totalFilteredCount,
}) => {
  const toggleSubreddit = (sub: string) => {
    const exists = filter.subreddits.includes(sub);
    if (exists) {
      onFilterChange({ subreddits: filter.subreddits.filter((s) => s !== sub) });
    } else {
      onFilterChange({ subreddits: [...filter.subreddits, sub] });
    }
  };

  const toggleKeyword = (kw: string) => {
    const exists = filter.keywords.includes(kw);
    if (exists) {
      onFilterChange({ keywords: filter.keywords.filter((k) => k !== kw) });
    } else {
      onFilterChange({ keywords: [...filter.keywords, kw] });
    }
  };

  const clearFilters = () => {
    onFilterChange({
      search: '',
      intent: 'ALL',
      subreddits: [],
      keywords: [],
      onlyWithContact: false,
      onlyWithBudget: false,
      sortBy: 'newest',
      stage: 'ALL',
    });
  };

  const hasActiveFilters =
    filter.search !== '' ||
    filter.intent !== 'ALL' ||
    filter.subreddits.length > 0 ||
    filter.keywords.length > 0 ||
    filter.onlyWithContact ||
    filter.onlyWithBudget ||
    filter.stage !== 'ALL';

  return (
    <div className="bg-[#ffffff] p-5 rounded-[24px] border border-[#e5e5e5] shadow-xs space-y-4">
      {/* Top Row: Search + Intent + Sort */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search input — 18px radius, subtle border */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
          <input
            type="text"
            value={filter.search}
            onChange={(e) => onFilterChange({ search: e.target.value })}
            placeholder="Search leads, keywords, client pain points, tech stacks..."
            className="w-full pl-10 pr-10 py-2.5 bg-[#fafafa] border border-[#e5e5e5] rounded-[18px] text-sm text-[#0a0a0a] placeholder-[#737373] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/5 focus:border-[#0a0a0a] transition-all"
          />
          {filter.search && (
            <button
              onClick={() => onFilterChange({ search: '' })}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#737373] hover:text-[#0a0a0a] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Intent Tabs — pill buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {(['ALL', 'HIRING', 'FOR_HIRE', 'DISCUSSION'] as const).map((intent) => {
            const label =
              intent === 'ALL' ? 'All' :
              intent === 'HIRING' ? 'Hiring' :
              intent === 'FOR_HIRE' ? 'For Hire' : 'Discussions';
            const isActive = filter.intent === intent;
            return (
              <button
                key={intent}
                onClick={() => onFilterChange({ intent })}
                className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all cursor-pointer border ${
                  isActive
                    ? 'bg-[#0a0a0a] text-white border-[#0a0a0a] shadow-xs'
                    : 'bg-[#fafafa] text-[#737373] border-[#e5e5e5] hover:border-[#0a0a0a] hover:text-[#0a0a0a]'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Sort + Clear */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center bg-[#fafafa] border border-[#e5e5e5] rounded-[18px] px-3.5 py-2 text-xs text-[#0a0a0a]">
            <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-[#737373]" />
            <select
              value={filter.sortBy}
              onChange={(e) => onFilterChange({ sortBy: e.target.value as any })}
              className="bg-transparent border-none focus:outline-none cursor-pointer font-medium text-xs text-[#0a0a0a]"
            >
              <option value="newest">Newest First</option>
              <option value="score">Highest Upvotes</option>
              <option value="intent">Intent Priority</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-3 py-2 text-xs text-[#737373] hover:text-red-600 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Second Row: Subreddits & Keywords pills */}
      <div className="space-y-2.5 pt-2 border-t border-[#e5e5e5]">
        {/* Subreddits */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider mr-1">
            Subreddits:
          </span>
          {availableSubreddits.map((sub) => {
            const isSelected = filter.subreddits.includes(sub);
            return (
              <button
                key={sub}
                onClick={() => toggleSubreddit(sub)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#0a0a0a] text-white border-[#0a0a0a] shadow-xs'
                    : 'bg-[#fafafa] text-[#737373] border-[#e5e5e5] hover:border-[#0a0a0a] hover:text-[#0a0a0a]'
                }`}
              >
                r/{sub}
              </button>
            );
          })}
        </div>

        {/* Target Keywords */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider mr-1">
            Signals:
          </span>
          {availableKeywords.map((kw) => {
            const isSelected = filter.keywords.includes(kw);
            return (
              <button
                key={kw}
                onClick={() => toggleKeyword(kw)}
                className={`px-3 py-1 rounded-full text-[11px] font-medium border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-red-50 text-red-600 border-red-200 font-semibold'
                    : 'bg-[#fafafa] text-[#737373] border-[#e5e5e5] hover:border-[#0a0a0a] hover:text-[#0a0a0a]'
                }`}
              >
                #{kw}
              </button>
            );
          })}
        </div>
      </div>

      {/* Count indicator + toggles */}
      <div className="flex items-center justify-between text-xs text-[#737373] pt-1">
        <span>
          Showing <strong className="text-[#0a0a0a] font-semibold">{totalFilteredCount}</strong> matching leads
        </span>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filter.onlyWithContact}
              onChange={(e) => onFilterChange({ onlyWithContact: e.target.checked })}
              className="accent-[#0a0a0a] rounded cursor-pointer"
            />
            <span className="text-xs text-[#0a0a0a] font-medium">Has Direct Contact</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={filter.onlyWithBudget}
              onChange={(e) => onFilterChange({ onlyWithBudget: e.target.checked })}
              className="accent-[#0a0a0a] rounded cursor-pointer"
            />
            <span className="text-xs text-[#0a0a0a] font-medium">Has Budget</span>
          </label>
        </div>
      </div>
    </div>
  );
};
