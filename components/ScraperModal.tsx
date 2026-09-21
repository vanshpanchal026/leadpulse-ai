'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Play, 
  Terminal, 
  ShieldAlert, 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  Sparkles,
  MapPin,
  MessageSquare,
  Flame,
  Brain,
  ExternalLink
} from 'lucide-react';
import { Lead } from '@/types/lead';

interface ScraperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLeadsIngested?: (newLeads: Lead[]) => void;
  onRefreshData?: () => void;
  onOpenResearchCampaign?: () => void;
  onOpenMissionControl?: () => void;
}

const PRESET_SUBREDDITS = [
  'smallbusiness',
  'restaurantowners',
  'realtors',
  'shopify'
];

const PRESET_KEYWORDS = [
  'missed calls',
  'after hours',
  'too many messages',
  'double booking'
];

const PRESET_META_ADS_QUERIES = [
  'Skin Clinic Delhi',
  'Dental Clinic South Delhi',
  'Hair Transplant Delhi',
  'Luxury Salon Delhi',
];

const PRESET_GOOGLE_MAPS_QUERIES = [
  'Skin Clinic in Delhi',
  'Dental Clinic in South Delhi',
  'Hair Transplant Clinic Delhi',
  'Luxury Salon Delhi',
];

export const ScraperModal: React.FC<ScraperModalProps> = ({
  isOpen,
  onClose,
  onLeadsIngested,
  onRefreshData,
  onOpenResearchCampaign,
  onOpenMissionControl,
}) => {
  // Source selector: 'google_maps' | 'meta_ads' | 'reddit'
  const [activeTab, setActiveTab] = useState<'google_maps' | 'meta_ads' | 'reddit'>('google_maps');

  // Meta Ads State
  const [selectedMetaQuery, setSelectedMetaQuery] = useState<string>(PRESET_META_ADS_QUERIES[0]);
  const [maxAds, setMaxAds] = useState<number>(5);

  // Reddit State
  const [selectedSubs, setSelectedSubs] = useState<string[]>([...PRESET_SUBREDDITS]);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([...PRESET_KEYWORDS]);
  const [maxPosts, setMaxPosts] = useState<number>(10);

  // Google Maps State
  const [selectedQueries, setSelectedQueries] = useState<string[]>([PRESET_GOOGLE_MAPS_QUERIES[0]]);
  const [maxPlaces, setMaxPlaces] = useState<number>(5);

  // Pipeline execution state
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [resultStats, setResultStats] = useState<{
    totalScraped: number;
    prefilterRejected?: number;
    evaluated: number;
    antiSpamBlocked?: number;
    qualified: number;
  } | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const stepTimerRef1 = useRef<NodeJS.Timeout | null>(null);
  const stepTimerRef2 = useRef<NodeJS.Timeout | null>(null);
  const stepTimerRef3 = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (stepTimerRef1.current) clearTimeout(stepTimerRef1.current);
      if (stepTimerRef2.current) clearTimeout(stepTimerRef2.current);
      if (stepTimerRef3.current) clearTimeout(stepTimerRef3.current);
    };
  }, []);

  if (!isOpen) return null;

  const toggleSubreddit = (sub: string) => {
    if (status === 'running') return;
    setSelectedSubs((prev) => 
      prev.includes(sub) 
        ? (prev.length > 1 ? prev.filter((s) => s !== sub) : prev)
        : [...prev, sub]
    );
  };

  const toggleKeyword = (kw: string) => {
    if (status === 'running') return;
    setSelectedKeywords((prev) =>
      prev.includes(kw)
        ? (prev.length > 1 ? prev.filter((k) => k !== kw) : prev)
        : [...prev, kw]
    );
  };

  const toggleGoogleQuery = (query: string) => {
    if (status === 'running') return;
    setSelectedQueries((prev) =>
      prev.includes(query)
        ? (prev.length > 1 ? prev.filter((q) => q !== query) : prev)
        : [...prev, query]
    );
  };

  // Instant verification test using sample Delhi clinics/ads without Apify timeouts
  const handleRunFastTest = async () => {
    setStatus('running');
    setCurrentStep(1);
    setErrorMessage('');
    setResultStats(null);

    stepTimerRef1.current = setTimeout(() => setCurrentStep(2), 300);
    stepTimerRef2.current = setTimeout(() => setCurrentStep(3), 700);
    stepTimerRef3.current = setTimeout(() => setCurrentStep(4), 1100);

    try {
      const endpoint = activeTab === 'meta_ads' ? '/api/scraper/meta-ads' : '/api/scraper/google-maps';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testMode: true,
          searchQuery: activeTab === 'meta_ads' ? selectedMetaQuery : undefined,
          searchQueries: activeTab === 'google_maps' ? selectedQueries : undefined,
        }),
      });

      if (stepTimerRef1.current) clearTimeout(stepTimerRef1.current);
      if (stepTimerRef2.current) clearTimeout(stepTimerRef2.current);
      if (stepTimerRef3.current) clearTimeout(stepTimerRef3.current);

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || data.error || 'Fast test failed');
      }

      setCurrentStep(4);
      setResultStats({
        totalScraped: data.total_ingested || (data.leads ? data.leads.length : 2),
        prefilterRejected: data.duplicates_skipped || 0,
        evaluated: data.evaluated || (data.leads ? data.leads.length : 2),
        qualified: data.qualified_leads_count || (data.leads ? data.leads.length : 2),
      });

      await new Promise((resolve) => setTimeout(resolve, 400));
      setStatus('success');

      if (data.leads && Array.isArray(data.leads) && data.leads.length > 0) {
        onLeadsIngested?.(data.leads);
      }
      onRefreshData?.();

      timerRef.current = setTimeout(() => {
        onClose();
        setStatus('idle');
      }, 2000);
    } catch (err: any) {
      if (stepTimerRef1.current) clearTimeout(stepTimerRef1.current);
      if (stepTimerRef2.current) clearTimeout(stepTimerRef2.current);
      if (stepTimerRef3.current) clearTimeout(stepTimerRef3.current);
      setStatus('error');
      setErrorMessage(err.message || 'Failed to run fast test');
    }
  };

  const handleStartSearch = async () => {
    setStatus('running');
    setCurrentStep(1);
    setErrorMessage('');
    setResultStats(null);

    // Dynamic Step Simulation timers
    if (activeTab === 'meta_ads') {
      stepTimerRef1.current = setTimeout(() => setCurrentStep(2), 6000);
      stepTimerRef2.current = setTimeout(() => setCurrentStep(3), 14000);
      stepTimerRef3.current = setTimeout(() => setCurrentStep(4), 22000);
    } else if (activeTab === 'google_maps') {
      stepTimerRef1.current = setTimeout(() => setCurrentStep(2), 7000);
      stepTimerRef2.current = setTimeout(() => setCurrentStep(3), 15000);
      stepTimerRef3.current = setTimeout(() => setCurrentStep(4), 22000);
    } else {
      stepTimerRef1.current = setTimeout(() => setCurrentStep(2), 9000);
      stepTimerRef2.current = setTimeout(() => setCurrentStep(3), 18000);
    }

    try {
      let res: Response;

      if (activeTab === 'meta_ads') {
        res = await fetch('/api/scraper/meta-ads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            runActor: true,
            searchQuery: selectedMetaQuery,
            maxAds: maxAds,
          }),
        });
      } else if (activeTab === 'google_maps') {
        res = await fetch('/api/scraper/google-maps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            runActor: true,
            searchQueries: selectedQueries,
            maxPlacesPerSearch: maxPlaces,
          }),
        });
      } else {
        res = await fetch('/api/scraper/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            subreddits: selectedSubs,
            keywords: selectedKeywords,
            maxPosts,
          }),
        });
      }

      if (stepTimerRef1.current) clearTimeout(stepTimerRef1.current);
      if (stepTimerRef2.current) clearTimeout(stepTimerRef2.current);
      if (stepTimerRef3.current) clearTimeout(stepTimerRef3.current);

      const data = await res.json();

      if (!res.ok || !data.success) {
        const errorMsg = data.error?.message || data.error || 'Scraper run failed';
        throw new Error(errorMsg);
      }

      if (activeTab === 'meta_ads' || activeTab === 'google_maps') {
        setCurrentStep(4);
        setResultStats({
          totalScraped: data.total_ingested || 0,
          prefilterRejected: data.duplicates_skipped || 0,
          evaluated: data.evaluated || 0,
          qualified: data.qualified_leads_count || (data.leads ? data.leads.length : 0),
        });
      } else {
        setCurrentStep(3);
        setResultStats({
          totalScraped: data.total_scraped || 0,
          prefilterRejected: data.prefilter_rejected || 0,
          evaluated: data.evaluated || 0,
          antiSpamBlocked: data.anti_spam_blocked || 0,
          qualified: data.qualified || 0,
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 800));
      setStatus('success');

      if (data.leads && Array.isArray(data.leads) && data.leads.length > 0) {
        onLeadsIngested?.(data.leads);
      }
      onRefreshData?.();

      timerRef.current = setTimeout(() => {
        onClose();
        setStatus('idle');
      }, 2500);

    } catch (err: any) {
      if (stepTimerRef1.current) clearTimeout(stepTimerRef1.current);
      if (stepTimerRef2.current) clearTimeout(stepTimerRef2.current);
      if (stepTimerRef3.current) clearTimeout(stepTimerRef3.current);
      setStatus('error');
      setErrorMessage(err.message || 'Failed to execute automated scraping pipeline');
    }
  };

  const handleClose = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (stepTimerRef1.current) clearTimeout(stepTimerRef1.current);
    if (stepTimerRef2.current) clearTimeout(stepTimerRef2.current);
    if (stepTimerRef3.current) clearTimeout(stepTimerRef3.current);
    setStatus('idle');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-[#ffffff] rounded-[24px] border border-[#e5e5e5] shadow-2xl p-6 sm:p-7 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#e5e5e5]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#0a0a0a] text-white flex items-center justify-center shadow-xs">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#0a0a0a] tracking-tight">
                Autonomous Lead Scraper
              </h3>
              <p className="text-xs text-[#737373]">
                {activeTab === 'meta_ads'
                  ? 'Apify Meta Ad Library Scraper & Gemini 2.5 Ad-Audit Engine'
                  : activeTab === 'google_maps' 
                  ? 'Apify Google Places & Gemini 2.5 Operational Audit'
                  : 'Apify Reddit Crawler & Gemini 2.5 Flash Evaluation'}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            disabled={status === 'running'}
            className="p-2 rounded-full text-[#737373] hover:text-[#0a0a0a] hover:bg-[#f5f5f5] transition-colors cursor-pointer disabled:opacity-30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* V2 Autonomous Swarm Switcher Banner */}
        {onOpenResearchCampaign && (
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-purple-50 via-blue-50 to-indigo-50 border border-purple-200 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-xl bg-purple-600 text-white shadow-2xs">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-semibold text-purple-950">
                  LeadPulse V2 Multi-Agent Research Swarm
                </div>
                <div className="text-[11px] text-purple-700">
                  Let AI Search Strategist plan queries & execute specialist audits automatically
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenResearchCampaign();
              }}
              className="px-3.5 py-1.5 text-xs font-medium rounded-full bg-purple-600 hover:bg-purple-700 text-white shadow-xs transition-colors shrink-0 cursor-pointer"
            >
              Launch V2 Engine →
            </button>
          </div>
        )}

        {/* Source Selector Tab / Toggle */}
        <div className="flex items-center p-1 rounded-full bg-[#f5f5f5] border border-[#e5e5e5]">
          <button
            type="button"
            onClick={() => { if (status !== 'running') setActiveTab('google_maps'); }}
            disabled={status === 'running'}
            className={`flex-1 py-2 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'google_maps'
                ? 'bg-[#ffffff] text-[#0a0a0a] shadow-xs border border-[#e5e5e5]'
                : 'text-[#737373] hover:text-[#0a0a0a]'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
            <span>Google Maps</span>
          </button>

          <button
            type="button"
            onClick={() => { if (status !== 'running') setActiveTab('meta_ads'); }}
            disabled={status === 'running'}
            className={`flex-1 py-2 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'meta_ads'
                ? 'bg-[#ffffff] text-[#0a0a0a] shadow-xs border border-[#e5e5e5]'
                : 'text-[#737373] hover:text-[#0a0a0a]'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-blue-600" />
            <span>🔥 Meta Ads (Paid Spenders)</span>
          </button>

          <button
            type="button"
            onClick={() => { if (status !== 'running') setActiveTab('reddit'); }}
            disabled={status === 'running'}
            className={`flex-1 py-2 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'reddit'
                ? 'bg-[#ffffff] text-[#0a0a0a] shadow-xs border border-[#e5e5e5]'
                : 'text-[#737373] hover:text-[#0a0a0a]'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-orange-600" />
            <span>Reddit</span>
          </button>
        </div>

        {/* Budget Safeguard Banner */}
        <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-[18px] p-3.5 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[#0a0a0a] font-medium">
            <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0" />
            <span>
              {activeTab === 'meta_ads'
                ? `Cost Control: Max ${maxAds} ads (< $0.10 / strictly bounded)`
                : activeTab === 'google_maps'
                ? `Cost Control: Max ${maxPlaces} places (~$0.05 / strictly bounded)`
                : `Cost Control: Max ${maxPosts} posts (< $0.30)`}
            </span>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#ffffff] text-[#737373] border border-[#e5e5e5]">
            {activeTab === 'meta_ads'
              ? 'apify/facebook-ads-scraper'
              : activeTab === 'google_maps'
              ? 'compass/crawler-google-places'
              : 'trudax/reddit-scraper-lite'}
          </span>
        </div>

        {/* Form Controls for Meta Ads */}
        {activeTab === 'meta_ads' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#0a0a0a] uppercase tracking-wider text-[11px]">
                  Target High-Ticket Ad Verticals (Delhi NCR)
                </label>
                <span className="text-[11px] text-[#737373]">
                  Selected: {selectedMetaQuery}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {PRESET_META_ADS_QUERIES.map((query) => {
                  const isSelected = selectedMetaQuery === query;
                  return (
                    <button
                      key={query}
                      type="button"
                      onClick={() => setSelectedMetaQuery(query)}
                      disabled={status === 'running'}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-[#0a0a0a] text-white border-[#0a0a0a] shadow-xs'
                          : 'bg-[#ffffff] text-[#737373] border-[#e5e5e5] hover:border-[#0a0a0a] hover:text-[#0a0a0a]'
                      }`}
                    >
                      <span>🔥</span>
                      <span>{query}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Max Ads Slider */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#0a0a0a] uppercase tracking-wider text-[11px]">
                  Ads Crawl Limit
                </span>
                <span className="font-semibold text-[#0a0a0a] px-2 py-0.5 rounded-md bg-[#f5f5f5] border border-[#e5e5e5]">
                  {maxAds} ads
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="20"
                step="5"
                value={maxAds}
                onChange={(e) => setMaxAds(Number(e.target.value))}
                disabled={status === 'running'}
                className="w-full accent-[#0a0a0a] cursor-pointer disabled:opacity-50"
              />
              <div className="flex justify-between text-[11px] text-[#737373]">
                <span>5 (Fast check)</span>
                <span>10 (Cost guardrail &lt; $0.10)</span>
                <span>20 (Full scan)</span>
              </div>
            </div>
          </div>
        ) : activeTab === 'google_maps' ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#0a0a0a] uppercase tracking-wider text-[11px]">
                  Target High-Ticket Verticals (Delhi NCR)
                </label>
                <span className="text-[11px] text-[#737373]">
                  {selectedQueries.length} selected
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {PRESET_GOOGLE_MAPS_QUERIES.map((query) => {
                  const isSelected = selectedQueries.includes(query);
                  return (
                    <button
                      key={query}
                      type="button"
                      onClick={() => toggleGoogleQuery(query)}
                      disabled={status === 'running'}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-[#0a0a0a] text-white border-[#0a0a0a] shadow-xs'
                          : 'bg-[#ffffff] text-[#737373] border-[#e5e5e5] hover:border-[#0a0a0a] hover:text-[#0a0a0a]'
                      }`}
                    >
                      <span>📍</span>
                      <span>{query}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Max Places Slider */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#0a0a0a] uppercase tracking-wider text-[11px]">
                  Places Crawl Limit
                </span>
                <span className="font-semibold text-[#0a0a0a] px-2 py-0.5 rounded-md bg-[#f5f5f5] border border-[#e5e5e5]">
                  {maxPlaces} places
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="20"
                step="5"
                value={maxPlaces}
                onChange={(e) => setMaxPlaces(Number(e.target.value))}
                disabled={status === 'running'}
                className="w-full accent-[#0a0a0a] cursor-pointer disabled:opacity-50"
              />
              <div className="flex justify-between text-[11px] text-[#737373]">
                <span>5 (Fast verification)</span>
                <span>10 (Recommended)</span>
                <span>20 (Full scan)</span>
              </div>
            </div>
          </div>
        ) : (
          /* Form Controls for Reddit */
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#0a0a0a] uppercase tracking-wider text-[11px]">
                  Target Communities
                </label>
                <span className="text-[11px] text-[#737373]">
                  {selectedSubs.length} selected
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {PRESET_SUBREDDITS.map((sub) => {
                  const isSelected = selectedSubs.includes(sub);
                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => toggleSubreddit(sub)}
                      disabled={status === 'running'}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer disabled:opacity-50 ${
                        isSelected
                          ? 'bg-[#0a0a0a] text-white border-[#0a0a0a] shadow-xs'
                          : 'bg-[#ffffff] text-[#737373] border-[#e5e5e5] hover:border-[#0a0a0a] hover:text-[#0a0a0a]'
                      }`}
                    >
                      r/{sub}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[#0a0a0a] uppercase tracking-wider text-[11px]">
                  Pain Symptoms & Friction Keywords
                </label>
                <span className="text-[11px] text-[#737373]">
                  {selectedKeywords.length} selected
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {PRESET_KEYWORDS.map((kw) => {
                  const isSelected = selectedKeywords.includes(kw);
                  return (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => toggleKeyword(kw)}
                      disabled={status === 'running'}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer disabled:opacity-50 ${
                        isSelected
                          ? 'bg-[#0a0a0a] text-white border-[#0a0a0a] shadow-xs'
                          : 'bg-[#ffffff] text-[#737373] border-[#e5e5e5] hover:border-[#0a0a0a] hover:text-[#0a0a0a]'
                      }`}
                    >
                      "{kw}"
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-[#0a0a0a] uppercase tracking-wider text-[11px]">
                  Post Batch Limit
                </span>
                <span className="font-semibold text-[#0a0a0a] px-2 py-0.5 rounded-md bg-[#f5f5f5] border border-[#e5e5e5]">
                  {maxPosts} posts
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="30"
                step="5"
                value={maxPosts}
                onChange={(e) => setMaxPosts(Number(e.target.value))}
                disabled={status === 'running'}
                className="w-full accent-[#0a0a0a] cursor-pointer disabled:opacity-50"
              />
              <div className="flex justify-between text-[11px] text-[#737373]">
                <span>5 (Quick test)</span>
                <span>20 (Standard)</span>
                <span>30 (Maximum)</span>
              </div>
            </div>
          </div>
        )}

        {/* Running State: Step-by-Step Animated Progress Indicator */}
        {status === 'running' && (
          <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-[18px] p-4 space-y-3 animate-in fade-in duration-200">
            <div className="text-xs font-semibold uppercase tracking-wider text-[11px] text-[#0a0a0a] flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0a0a0a]" />
              <span>Pipeline Running...</span>
            </div>

            {activeTab === 'meta_ads' ? (
              <div className="space-y-2.5">
                {/* Step 1 */}
                <div className="flex items-center gap-3 text-xs">
                  {currentStep > 1 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Loader2 className="w-4 h-4 animate-spin text-[#0a0a0a] shrink-0" />
                  )}
                  <span className={currentStep === 1 ? 'font-medium text-[#0a0a0a]' : currentStep > 1 ? 'text-[#737373]' : 'text-[#a3a3a3]'}>
                    Step 1: Querying Meta Ad Library for active advertisers...
                  </span>
                </div>

                {/* Step 2 */}
                <div className="flex items-center gap-3 text-xs">
                  {currentStep > 2 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : currentStep === 2 ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#0a0a0a] shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-[#d4d4d4] shrink-0" />
                  )}
                  <span className={currentStep === 2 ? 'font-medium text-[#0a0a0a]' : currentStep > 2 ? 'text-[#737373]' : 'text-[#a3a3a3]'}>
                    Step 2: Extracting landing pages &amp; WhatsApp numbers...
                  </span>
                </div>

                {/* Step 3 */}
                <div className="flex items-center gap-3 text-xs">
                  {currentStep > 3 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : currentStep === 3 ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#0a0a0a] shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-[#d4d4d4] shrink-0" />
                  )}
                  <span className={currentStep === 3 ? 'font-medium text-[#0a0a0a]' : currentStep > 3 ? 'text-[#737373]' : 'text-[#a3a3a3]'}>
                    Step 3: Auditing funnels &amp; generating ad-specific pitches...
                  </span>
                </div>

                {/* Step 4 */}
                <div className="flex items-center gap-3 text-xs">
                  {currentStep === 4 ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#0a0a0a] shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-[#d4d4d4] shrink-0" />
                  )}
                  <span className={currentStep === 4 ? 'font-medium text-[#0a0a0a]' : 'text-[#a3a3a3]'}>
                    Step 4: Syncing verified ad spenders to dashboard...
                  </span>
                </div>
              </div>
            ) : activeTab === 'google_maps' ? (
              <div className="space-y-2.5">
                {/* Step 1 */}
                <div className="flex items-center gap-3 text-xs">
                  {currentStep > 1 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Loader2 className="w-4 h-4 animate-spin text-[#0a0a0a] shrink-0" />
                  )}
                  <span className={currentStep === 1 ? 'font-medium text-[#0a0a0a]' : currentStep > 1 ? 'text-[#737373]' : 'text-[#a3a3a3]'}>
                    Step 1: Crawling Google Places & extracting social handles...
                  </span>
                </div>

                {/* Step 2 */}
                <div className="flex items-center gap-3 text-xs">
                  {currentStep > 2 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : currentStep === 2 ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#0a0a0a] shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-[#d4d4d4] shrink-0" />
                  )}
                  <span className={currentStep === 2 ? 'font-medium text-[#0a0a0a]' : currentStep > 2 ? 'text-[#737373]' : 'text-[#a3a3a3]'}>
                    Step 2: Auditing websites & calculating 10-point scorecard...
                  </span>
                </div>

                {/* Step 3 */}
                <div className="flex items-center gap-3 text-xs">
                  {currentStep > 3 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : currentStep === 3 ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#0a0a0a] shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-[#d4d4d4] shrink-0" />
                  )}
                  <span className={currentStep === 3 ? 'font-medium text-[#0a0a0a]' : currentStep > 3 ? 'text-[#737373]' : 'text-[#a3a3a3]'}>
                    Step 3: Generating customized WhatsApp audit notes...
                  </span>
                </div>

                {/* Step 4 */}
                <div className="flex items-center gap-3 text-xs">
                  {currentStep === 4 ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#0a0a0a] shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-[#d4d4d4] shrink-0" />
                  )}
                  <span className={currentStep === 4 ? 'font-medium text-[#0a0a0a]' : 'text-[#a3a3a3]'}>
                    Step 4: Syncing qualified leads to dashboard...
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* Reddit Steps */}
                <div className="flex items-center gap-3 text-xs">
                  {currentStep > 1 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <Loader2 className="w-4 h-4 animate-spin text-[#0a0a0a] shrink-0" />
                  )}
                  <span className={currentStep === 1 ? 'font-medium text-[#0a0a0a]' : currentStep > 1 ? 'text-[#737373]' : 'text-[#a3a3a3]'}>
                    Step 1: Scraping targeted subreddits via Apify...
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  {currentStep > 2 ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : currentStep === 2 ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#0a0a0a] shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-[#d4d4d4] shrink-0" />
                  )}
                  <span className={currentStep === 2 ? 'font-medium text-[#0a0a0a]' : currentStep > 2 ? 'text-[#737373]' : 'text-[#a3a3a3]'}>
                    Step 2: Stage 2 Pre-filter triage & Gemini Flash evaluation...
                  </span>
                </div>

                <div className="flex items-center gap-3 text-xs">
                  {currentStep === 3 ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#0a0a0a] shrink-0" />
                  ) : (
                    <div className="w-4 h-4 rounded-full border border-[#d4d4d4] shrink-0" />
                  )}
                  <span className={currentStep === 3 ? 'font-medium text-[#0a0a0a]' : 'text-[#a3a3a3]'}>
                    Step 3: Code-level anti-spam check & Supabase upsert...
                  </span>
                </div>
              </div>
            )}

            {onOpenMissionControl && (
              <div className="pt-3 border-t border-[#e5e5e5] flex items-center justify-between flex-wrap gap-2">
                <span className="text-[11px] text-[#737373] font-mono">Real-time subagents &amp; Claude/Perplexity thinking stream:</span>
                <button
                  type="button"
                  onClick={onOpenMissionControl}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#18181C] hover:bg-black text-purple-300 border border-purple-500/40 text-xs font-mono transition-all cursor-pointer shadow-xs"
                >
                  <Brain className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                  <span>Open Agent Mission Control</span>
                  <ExternalLink className="w-3 h-3 text-purple-400" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Complete / Success State */}
        {status === 'success' && resultStats && (
          <div className="bg-emerald-50/80 border border-emerald-200 rounded-[18px] p-4 text-xs space-y-2.5 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Successfully ingested {resultStats.qualified} qualified {activeTab === 'meta_ads' ? 'Meta advertisers' : activeTab === 'google_maps' ? 'local service businesses' : 'leads'}!</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 text-center">
              <div className="bg-white/80 rounded-xl p-2 border border-emerald-100">
                <span className="text-[10px] uppercase text-[#737373] block">Scraped</span>
                <span className="font-semibold text-sm text-[#0a0a0a]">{resultStats.totalScraped}</span>
              </div>
              <div className="bg-white/80 rounded-xl p-2 border border-emerald-100">
                <span className="text-[10px] uppercase text-amber-700 font-medium block">Deduplicated</span>
                <span className="font-semibold text-sm text-amber-800">{resultStats.prefilterRejected || 0}</span>
              </div>
              <div className="bg-white/80 rounded-xl p-2 border border-emerald-100">
                <span className="text-[10px] uppercase text-emerald-600 font-medium block">Ingested</span>
                <span className="font-semibold text-sm text-emerald-700">{resultStats.qualified}</span>
              </div>
            </div>
            <p className="text-[11px] text-emerald-700/80 text-center pt-1">
              ✨ Leads and WhatsApp audit pitches synced to command center. Closing in 2s...
            </p>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-[18px] p-4 text-xs space-y-2 text-red-700 animate-in fade-in duration-200">
            <div className="flex items-center gap-1.5 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>Scraper Execution Issue</span>
            </div>
            <p className="text-[11px] leading-relaxed break-words">{errorMessage}</p>
            <div className="pt-1">
              <button
                type="button"
                onClick={handleRunFastTest}
                className="px-3 py-1.5 rounded-full text-xs font-semibold bg-red-100 hover:bg-red-200 text-red-900 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>⚡ Run Fast Test Instead (Sample Data &lt; 2s)</span>
              </button>
            </div>
          </div>
        )}

        {/* Footer / CTA Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-[#e5e5e5] gap-3 flex-wrap">
          <button
            type="button"
            onClick={handleClose}
            disabled={status === 'running'}
            className="px-4 py-2 rounded-full text-xs font-medium text-[#737373] hover:text-[#0a0a0a] hover:bg-[#f5f5f5] transition-all cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Fast Test Button (Instant Verification) */}
            <button
              type="button"
              onClick={handleRunFastTest}
              disabled={status === 'running'}
              title="Verify scorecard scoring, Gemini pitch, and dashboard sync instantly using pre-verified Delhi clinic data"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-semibold bg-[var(--color-stone-100)] hover:bg-[var(--color-hairline)] text-[var(--color-ink)] border border-[var(--color-hairline)] transition-all cursor-pointer disabled:opacity-50"
            >
              <span>⚡ Fast Test (Sample Data)</span>
            </button>

            {/* Live Scraper Search Button */}
            <button
              type="button"
              onClick={handleStartSearch}
              disabled={
                status === 'running' || 
                (activeTab === 'meta_ads' ? !selectedMetaQuery : activeTab === 'google_maps' ? selectedQueries.length === 0 : (selectedSubs.length === 0 || selectedKeywords.length === 0))
              }
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-medium bg-[#0a0a0a] hover:bg-[#171717] text-white shadow-sm transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'running' ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Running Pipeline...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-white" />
                  <span>{activeTab === 'meta_ads' ? 'Scan Active Meta Advertisers' : activeTab === 'google_maps' ? 'Start Local Business Scrape' : 'Start Autonomous Search'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
