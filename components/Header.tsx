'use client';

import React from 'react';
import { 
  RefreshCw, 
  Download, 
  Terminal,
  Kanban,
  LayoutList
} from 'lucide-react';
import { LeadStats } from '@/lib/types';

interface HeaderProps {
  stats: LeadStats | null;
  activeView: 'kanban' | 'list';
  onViewChange: (view: 'kanban' | 'list') => void;
  onRefresh: () => void;
  onOpenScraper: () => void;
  onExport: () => void;
  isRefreshing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  stats,
  activeView,
  onViewChange,
  onRefresh,
  onOpenScraper,
  onExport,
  isRefreshing,
}) => {
  return (
    <header className="w-full bg-[#ffffff] border-b border-[#e5e5e5] py-4 px-6 sm:px-8 shadow-xs">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Wordmark */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#0a0a0a] text-white flex items-center justify-center font-bold text-xs shadow-sm">
            LP
          </div>
          <div>
            <span className="text-base font-semibold tracking-tight text-[#0a0a0a]">
              Lead Pipeline Dashboard
            </span>
            <p className="text-xs text-[#737373] mt-0.5">
              {stats?.totalPosts || 170} leads monitored · Multi-channel intelligence
            </p>
          </div>
        </div>

        {/* View Switcher Pill */}
        <nav className="hidden md:flex items-center gap-1 bg-[#f5f5f5] rounded-full p-1 border border-[#e5e5e5] shadow-inner">
          <button
            onClick={() => onViewChange('kanban')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
              activeView === 'kanban'
                ? 'bg-[#ffffff] text-[#0a0a0a] shadow-xs font-semibold'
                : 'text-[#737373] hover:text-[#0a0a0a]'
            }`}
          >
            <Kanban className="w-3.5 h-3.5" />
            Pipeline
          </button>
          <button
            onClick={() => onViewChange('list')}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer ${
              activeView === 'list'
                ? 'bg-[#ffffff] text-[#0a0a0a] shadow-xs font-semibold'
                : 'text-[#737373] hover:text-[#0a0a0a]'
            }`}
          >
            <LayoutList className="w-3.5 h-3.5" />
            Feed View
          </button>
        </nav>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Re-analyze local datasets"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-[18px] text-xs font-medium bg-[#ffffff] hover:bg-[#fafafa] text-[#0a0a0a] border border-[#e5e5e5] hover:border-[#0a0a0a] transition-all cursor-pointer disabled:opacity-50 shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync Data</span>
          </button>

          <button
            onClick={onExport}
            title="Export filtered leads to CSV"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-[18px] text-xs font-medium bg-[#ffffff] hover:bg-[#fafafa] text-[#0a0a0a] border border-[#e5e5e5] hover:border-[#0a0a0a] transition-all cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Primary CTA button */}
          <button
            onClick={onOpenScraper}
            className="flex items-center gap-1.5 px-4 py-2 rounded-[18px] text-xs font-medium bg-[#0a0a0a] hover:bg-[#171717] text-white shadow-sm transition-all cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Run Scraper</span>
          </button>
        </div>
      </div>
    </header>
  );
};
