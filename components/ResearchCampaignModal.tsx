'use client';

import React, { useState } from 'react';
import {
  X,
  Play,
  MapPin,
  Building2,
  Layers,
  Sparkles,
  Loader2,
  ShieldCheck,
  CheckSquare,
  Square,
  FlaskConical,
} from 'lucide-react';

interface ResearchCampaignModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRunCreated?: (runId: string) => void;
  onNotify?: (text: string, type: 'success' | 'error') => void;
}

const LOCATION_PRESETS = ['South Delhi', 'Gurgaon', 'Noida', 'Delhi NCR'];
const VERTICAL_PRESETS = [
  'Dermatology',
  'Med Spa',
  'Hair Transplant',
  'Dental Clinic',
  'Luxury Salon',
  'Interior Design',
];

export function ResearchCampaignModal({
  isOpen,
  onClose,
  onRunCreated,
  onNotify,
}: ResearchCampaignModalProps) {
  const [campaignName, setCampaignName] = useState('Delhi Aesthetic & Laser Q3');
  const [location, setLocation] = useState('South Delhi');
  const [vertical, setVertical] = useState('Dermatology');
  const [goal, setGoal] = useState('Find high-ticket medical/aesthetic clinics needing automated booking and lead recovery');
  const [maxQueries, setMaxQueries] = useState<number>(3);
  const [leadLimit, setLeadLimit] = useState<number>(10);
  const [dryRun, setDryRun] = useState<boolean>(true); // Safe default
  const [enabledSpecialists, setEnabledSpecialists] = useState<string[]>([
    'website',
    'ads',
    'maps',
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const toggleSpecialist = (type: string) => {
    if (enabledSpecialists.includes(type)) {
      if (enabledSpecialists.length <= 1) return;
      setEnabledSpecialists(enabledSpecialists.filter((s) => s !== type));
    } else {
      setEnabledSpecialists([...enabledSpecialists, type]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const payload = {
        campaign_id: campaignName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        configuration: {
          campaign_name: campaignName.trim(),
          goal: goal.trim(),
          locations: [location.trim()],
          verticals: [vertical.trim()],
          max_queries: maxQueries,
          lead_limit: leadLimit,
          max_apify_calls: dryRun ? 0 : Math.min(6, maxQueries * 2),
          dry_run: dryRun,
          enabled_specialists: enabledSpecialists,
          execute: true,
          auto_execute: true,
        },
      };

      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Worker error ${res.status}: ${errorText}`);
      }

      const record = await res.json();
      onNotify?.(
        `Autonomous research campaign "${campaignName}" launched (Run ID: ${record.run_id})`,
        'success'
      );
      onRunCreated?.(record.run_id);
      onClose();
    } catch (err: any) {
      console.error('Failed to launch campaign:', err);
      onNotify?.(`Failed to launch campaign: ${err.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-[#ffffff] dark:bg-[#121212] border border-[#e5e5e5] dark:border-[#262626] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#e5e5e5] dark:border-[#262626] flex items-center justify-between bg-[#fafafa] dark:bg-[#171717]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#0a0a0a] text-white dark:bg-white dark:text-[#0a0a0a] flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#0a0a0a] dark:text-white">
                Start Autonomous Research Campaign
              </h2>
              <p className="text-[11px] text-[#737373]">
                AI Search Strategist autonomously discovers and researches qualified prospects
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[#eaeaea] dark:hover:bg-[#262626] text-[#737373] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Campaign Name */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-[#404040] dark:text-[#a3a3a3] uppercase tracking-wider">
              Campaign Name
            </label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              required
              placeholder="e.g. South Delhi Laser Clinics Q3"
              className="w-full px-3.5 py-2 rounded-xl bg-[#fafafa] dark:bg-[#1c1c1c] border border-[#e5e5e5] dark:border-[#2e2e2e] text-[#0a0a0a] dark:text-white text-xs focus:outline-none focus:border-[#0a0a0a] dark:focus:border-white transition-colors"
            />
          </div>

          {/* Research Goal */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-[#404040] dark:text-[#a3a3a3] uppercase tracking-wider">
              Strategic Research Goal
            </label>
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              rows={2}
              className="w-full px-3.5 py-2 rounded-xl bg-[#fafafa] dark:bg-[#1c1c1c] border border-[#e5e5e5] dark:border-[#2e2e2e] text-[#0a0a0a] dark:text-white text-xs focus:outline-none focus:border-[#0a0a0a] dark:focus:border-white transition-colors resize-none"
            />
          </div>

          {/* Geography & Vertical Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Geography */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[#404040] dark:text-[#a3a3a3] uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                <span>Target Geography</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
                className="w-full px-3.5 py-2 rounded-xl bg-[#fafafa] dark:bg-[#1c1c1c] border border-[#e5e5e5] dark:border-[#2e2e2e] text-[#0a0a0a] dark:text-white text-xs focus:outline-none"
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {LOCATION_PRESETS.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => setLocation(loc)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-[#f5f5f5] dark:bg-[#262626] hover:bg-[#e5e5e5] dark:hover:bg-[#333333] text-[#525252] dark:text-[#d4d4d4] transition-colors"
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>

            {/* Vertical */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-[#404040] dark:text-[#a3a3a3] uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-cyan-500" />
                <span>Seed Vertical</span>
              </label>
              <input
                type="text"
                value={vertical}
                onChange={(e) => setVertical(e.target.value)}
                required
                className="w-full px-3.5 py-2 rounded-xl bg-[#fafafa] dark:bg-[#1c1c1c] border border-[#e5e5e5] dark:border-[#2e2e2e] text-[#0a0a0a] dark:text-white text-xs focus:outline-none"
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {VERTICAL_PRESETS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVertical(v)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-[#f5f5f5] dark:bg-[#262626] hover:bg-[#e5e5e5] dark:hover:bg-[#333333] text-[#525252] dark:text-[#d4d4d4] transition-colors"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Limits & Budgets */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[#e5e5e5] dark:border-[#262626]">
            {/* Lead Limit Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-[#404040] dark:text-[#a3a3a3]">
                  Candidate Yield Target
                </span>
                <span className="font-mono font-semibold text-[#0a0a0a] dark:text-white">
                  {leadLimit} businesses
                </span>
              </div>
              <input
                type="range"
                min="3"
                max="30"
                step="1"
                value={leadLimit}
                onChange={(e) => setLeadLimit(Number(e.target.value))}
                className="w-full accent-[#0a0a0a] dark:accent-white h-1.5 bg-[#e5e5e5] dark:bg-[#333333] rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-[#737373]">
                <span>3 (Fast test)</span>
                <span>15 (Balanced)</span>
                <span>30 (Full batch)</span>
              </div>
            </div>

            {/* Max Queries */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-[#404040] dark:text-[#a3a3a3]">
                  Max Search Queries
                </span>
                <span className="font-mono font-semibold text-[#0a0a0a] dark:text-white">
                  {maxQueries} queries
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={maxQueries}
                onChange={(e) => setMaxQueries(Number(e.target.value))}
                className="w-full accent-[#0a0a0a] dark:accent-white h-1.5 bg-[#e5e5e5] dark:bg-[#333333] rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[9px] text-[#737373]">
                <span>1 query</span>
                <span>3 queries</span>
                <span>5 queries</span>
              </div>
            </div>
          </div>

          {/* Specialist Agents Selection */}
          <div className="space-y-2 pt-2 border-t border-[#e5e5e5] dark:border-[#262626]">
            <label className="text-[11px] font-medium text-[#404040] dark:text-[#a3a3a3] uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-500" />
              <span>Specialist Research Swarm</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => toggleSpecialist('website')}
                className={`p-2 rounded-xl border text-left flex items-start gap-2 transition-all ${
                  enabledSpecialists.includes('website')
                    ? 'border-blue-500/60 bg-blue-50 dark:bg-blue-950/30'
                    : 'border-[#e5e5e5] dark:border-[#262626] opacity-50'
                }`}
              >
                {enabledSpecialists.includes('website') ? (
                  <CheckSquare className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-[#737373] shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-medium text-[#0a0a0a] dark:text-white text-[11px]">Website</div>
                  <div className="text-[9px] text-[#737373]">UX & booking audit</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => toggleSpecialist('ads')}
                className={`p-2 rounded-xl border text-left flex items-start gap-2 transition-all ${
                  enabledSpecialists.includes('ads')
                    ? 'border-purple-500/60 bg-purple-50 dark:bg-purple-950/30'
                    : 'border-[#e5e5e5] dark:border-[#262626] opacity-50'
                }`}
              >
                {enabledSpecialists.includes('ads') ? (
                  <CheckSquare className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-[#737373] shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-medium text-[#0a0a0a] dark:text-white text-[11px]">Meta Ads</div>
                  <div className="text-[9px] text-[#737373]">Ad Library audit</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => toggleSpecialist('maps')}
                className={`p-2 rounded-xl border text-left flex items-start gap-2 transition-all ${
                  enabledSpecialists.includes('maps')
                    ? 'border-emerald-500/60 bg-emerald-50 dark:bg-emerald-950/30'
                    : 'border-[#e5e5e5] dark:border-[#262626] opacity-50'
                }`}
              >
                {enabledSpecialists.includes('maps') ? (
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-[#737373] shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-medium text-[#0a0a0a] dark:text-white text-[11px]">Maps</div>
                  <div className="text-[9px] text-[#737373]">Reviews & presence</div>
                </div>
              </button>
            </div>
          </div>

          {/* Dry Run Toggle (Cost Protection) */}
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <div className="text-[11px] font-semibold text-amber-900 dark:text-amber-200">
                  Dry Run Mode (Zero Apify API Cost)
                </div>
                <div className="text-[10px] text-amber-700 dark:text-amber-400">
                  Runs the full multi-agent pipeline using sample candidates without live scraper spend
                </div>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-[#d4d4d4] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600"></div>
            </label>
          </div>

          {/* Footer Controls */}
          <div className="pt-3 border-t border-[#e5e5e5] dark:border-[#262626] flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[10px] text-[#737373]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Human Approval Gate Protected</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-full border border-[#e5e5e5] dark:border-[#262626] text-xs font-medium hover:bg-[#f5f5f5] dark:hover:bg-[#262626] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#0a0a0a] hover:bg-[#171717] dark:bg-white dark:hover:bg-[#ededed] text-white dark:text-[#0a0a0a] text-xs font-medium shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Launching Pipeline...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Launch Campaign</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
