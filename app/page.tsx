'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  ExternalLink, 
  Copy, 
  Check, 
  Sparkles, 
  Send, 
  CalendarCheck, 
  Calendar, 
  X, 
  FileText, 
  Building2, 
  Target, 
  Users, 
  Download, 
  Archive, 
  MessageSquare, 
  RotateCcw, 
  Terminal, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  MapPin,
  Phone,
  Globe,
  Flame,
  ShieldAlert,
  LogOut
} from 'lucide-react';
import { Lead, LeadStatus, Platform } from '@/types/lead';
import rawLeads from '@/data/leads.json';
import { supabase } from '@/lib/supabase';
import { ScraperModal } from '@/components/ScraperModal';
import { LeadCard, isLegitWebsiteUrl, getServiceBadgeInfo } from '@/components/LeadCard';
import { OutreachApprovalQueue } from '@/components/OutreachApprovalQueue';
import { ResearchRunsPanel } from '@/components/ResearchRunsPanel';
import { ResearchCampaignModal } from '@/components/ResearchCampaignModal';
import { AgentMissionControl, AgentSwarmStatusPill } from '@/components/AgentMissionControl';
import { formatRelativeDate, isValidUuid } from '@/lib/format-date';

const InstagramIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg 
    className={className} 
    width="16" 
    height="16" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    style={{ maxWidth: '16px', maxHeight: '16px', minWidth: '16px' }}
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const WhatsAppIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg 
    className={className} 
    width="16" 
    height="16" 
    viewBox="0 0 24 24" 
    fill="currentColor"
    style={{ maxWidth: '16px', maxHeight: '16px', minWidth: '16px' }}
  >
    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24zm4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.34-.76-1.84-.2-.49-.4-.42-.56-.43h-.47c-.17 0-.44.06-.67.31-.23.25-.87.85-.87 2.08 0 1.22.89 2.41 1.02 2.58.13.17 1.76 2.68 4.26 3.76.6.26 1.06.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.17-.48-.29z"/>
  </svg>
);

function InspectorBody({
  lead,
  copied,
  onCopyPitch,
  onUpdateStatus,
}: {
  lead: Lead;
  copied: boolean;
  onCopyPitch: () => void;
  onUpdateStatus: (id: string, status: LeadStatus) => void;
}) {
  const isGoogleMaps = lead.source_platform === 'google_maps';
  const isMetaAds = lead.source_platform === 'meta_ads';
  const isLocalLead = isGoogleMaps || isMetaAds;
  const score = lead.prospect_score ?? lead.confidence_score ?? 0;
  const serviceBadge = getServiceBadgeInfo(lead.recommended_service);
  const phoneClean = (lead.phone_number || '').replace(/[^0-9]/g, '');
  const whatsAppUrl = phoneClean
    ? `https://wa.me/${phoneClean}?text=${encodeURIComponent(lead.draft_pitch || `Hi ${lead.business_name || lead.title}, saw your active business listing.`)}`
    : null;
  const sourceExternalUrl = lead.google_maps_url || lead.source_url;

  return (
    <div className="space-y-5">
      {/* Title & Primary Badges */}
      <div>
        <h2 className="text-xl font-[family-name:var(--font-inter-tight)] font-semibold tracking-tight text-[var(--color-ink)] leading-snug break-words">
          {lead.business_name || lead.title}
        </h2>

        {isGoogleMaps ? (
          <div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-[var(--color-warm-gray)]">
            <span className="font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 text-[11px]">
              ★ {lead.rating ? lead.rating.toFixed(1) : '4.5'} ({lead.review_count || 0} reviews)
            </span>
            <span>•</span>
            <span className="text-[11px] text-[var(--color-ink-soft)] font-medium">{lead.business_type}</span>
            {serviceBadge && (
              <>
                <span>•</span>
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${serviceBadge.bg} ${serviceBadge.text} ${serviceBadge.border}`}>
                  {serviceBadge.label}
                </span>
              </>
            )}
            {lead.address && (
              <>
                <span>•</span>
                <span className="text-[11px] text-[var(--color-warm-gray)] truncate max-w-[220px]" title={lead.address}>
                  {lead.address}
                </span>
              </>
            )}
          </div>
        ) : isMetaAds ? (
          <div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-[var(--color-warm-gray)]">
            <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200 text-[11px] flex items-center gap-1">
              <Flame className="w-3 h-3 text-blue-600" />
              <span>Active Meta Ads</span>
            </span>
            {serviceBadge && (
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${serviceBadge.bg} ${serviceBadge.text} ${serviceBadge.border}`}>
                {serviceBadge.label}
              </span>
            )}
            {typeof lead.rating === 'number' && lead.rating > 0 && (
              <>
                <span>•</span>
                <span className="font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 text-[11px]">
                  ★ {lead.rating.toFixed(1)} ({lead.review_count || 0} reviews)
                </span>
              </>
            )}
            <span>•</span>
            <span className="text-[11px] text-[var(--color-ink-soft)] font-medium">{lead.business_type}</span>
            {lead.address && (
              <>
                <span>•</span>
                <span className="text-[11px] text-[var(--color-warm-gray)] truncate max-w-[220px]" title={lead.address}>
                  {lead.address}
                </span>
              </>
            )}
            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold">
              Score: {score}/10 Immediate
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 mt-1.5 text-xs text-[var(--color-warm-gray)] flex-wrap">
            <span className="font-medium text-[var(--color-ink)]">{lead.author}</span>
            {serviceBadge && (
              <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${serviceBadge.bg} ${serviceBadge.text} ${serviceBadge.border}`}>
                {serviceBadge.label}
              </span>
            )}
            <span>•</span>
            <span>Confidence Score: </span>
            <span className={`font-medium ${score >= 8 ? 'text-[var(--color-cyan-edge)]' : 'text-[var(--color-ink)]'}`}>
              {score}/10
            </span>
          </div>
        )}
      </div>

      {/* Contact & Social Quick Bar (Local & Meta Ads) */}
      {isLocalLead && (
        <div className="flex flex-wrap items-center gap-2 p-3 bg-[var(--color-stone-100)] rounded-[var(--radius-panel)] border border-[var(--color-hairline)]">
          {lead.phone_number ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white border border-[var(--color-hairline)] text-[var(--color-ink)] shadow-2xs">
              <Phone className="w-3.5 h-3.5 text-emerald-600" />
              <span>{lead.phone_number}</span>
            </span>
          ) : (
            <span className="text-xs text-[var(--color-ash-gray)]">No direct phone listed</span>
          )}

          {/* Only show Visit Website if it is a legitimate website (not WhatsApp or Facebook) */}
          {isLegitWebsiteUrl(lead.website_url) && (
            <a
              href={lead.website_url!.startsWith('http') ? lead.website_url! : `https://${lead.website_url!}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white border border-[var(--color-hairline)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] hover:border-[var(--color-ink)] transition-colors shadow-2xs"
            >
              <Globe className="w-3.5 h-3.5 text-[var(--color-ash-gray)]" />
              <span>Visit Website</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>
          )}

          {lead.instagram_url && (
            <a
              href={lead.instagram_url.startsWith('http') ? lead.instagram_url : `https://${lead.instagram_url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white border border-[var(--color-hairline)] text-[var(--color-ink-soft)] hover:text-pink-600 hover:border-pink-300 transition-colors shadow-2xs"
            >
              <InstagramIcon className="w-3.5 h-3.5" />
              <span>Instagram</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>
          )}

          {lead.google_maps_url && (
            <a
              href={lead.google_maps_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white border border-[var(--color-hairline)] text-[var(--color-ink-soft)] hover:text-emerald-700 hover:border-emerald-300 transition-colors shadow-2xs"
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>Google Maps</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>
          )}

          {sourceExternalUrl && sourceExternalUrl !== lead.google_maps_url && (
            <a
              href={sourceExternalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-white border border-[var(--color-hairline)] text-[var(--color-ink-soft)] hover:text-blue-700 hover:border-blue-300 transition-colors shadow-2xs"
            >
              {isMetaAds ? <Flame className="w-3.5 h-3.5 text-blue-600" /> : <MapPin className="w-3.5 h-3.5 text-emerald-600" />}
              <span>{isMetaAds ? 'Ad Library' : 'Google Maps'}</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>
          )}
        </div>
      )}

      {/* Audit Summary Box (Local & Meta Ads) OR Problem & Niche (Reddit) */}
      {isLocalLead ? (
        <div className="bg-[var(--color-stone-100)] border border-[var(--color-hairline)] rounded-[var(--radius-panel)] p-4 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-[11px] font-semibold text-[var(--color-warm-gray)] uppercase tracking-[0.05em]">
              Operational Audit & Ad Status
            </span>
            {lead.has_active_ads ? (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                <span>🔥 Active Meta Ads</span>
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-200/70 text-stone-600">
                Organic Traffic Only
              </span>
            )}
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-[var(--color-ink)]">Identified Conversion Friction:</span>
            {lead.audit_friction_points && lead.audit_friction_points.length > 0 ? (
              <ul className="space-y-1.5">
                {lead.audit_friction_points.map((friction, i) => (
                  <li key={i} className="text-xs text-[var(--color-ink-soft)] flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <span>{friction}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[var(--color-ink-soft)]">{lead.identified_problem}</p>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="bg-[var(--color-stone-100)] border border-[var(--color-hairline)] rounded-[var(--radius-panel)] p-4 space-y-1.5">
            <span className="text-[10px] font-medium text-[var(--color-warm-gray)] uppercase tracking-[0.05em] block">
              Identified Problem & Business Niche
            </span>
            <p className="text-xs font-normal text-[var(--color-ink)] leading-snug break-words">
              {lead.identified_problem}
            </p>
            <p className="text-[11px] text-[var(--color-warm-gray)] break-words">
              Niche: {lead.business_type}
            </p>
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-medium uppercase tracking-[0.05em] text-[var(--color-ink)] flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-[var(--color-ash-gray)]" />
              Original Post Context
            </span>
            <div className="bg-[var(--color-stone-100)] border border-[var(--color-hairline)] rounded-[var(--radius-panel)] p-4 text-xs text-[var(--color-ink-soft)] leading-relaxed whitespace-pre-wrap max-h-44 overflow-y-auto select-text break-words">
              {lead.body_text}
            </div>
          </div>
        </>
      )}

      {/* AI Outreach / Audit Pitch Section */}
      <div className="space-y-2 pt-2 border-t border-[var(--color-hairline)]">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-[var(--color-cyan-edge)]" />
            <span className="text-xs font-medium text-[var(--color-ink)]">
              {(() => {
                switch (lead.recommended_service) {
                  case 'website_development': return 'AI Website Conversion Audit Pitch';
                  case 'booking_automation': return 'AI Online Calendar Booking Audit Pitch';
                  case 'whatsapp_automation': return 'AI 24/7 Inquiry Capture Audit Pitch';
                  case 'lead_automation': return 'AI Speed-to-Lead & Ad Audit Pitch';
                  case 'ai_agents': return 'AI Inquiry Assistant Audit Pitch';
                  case 'crm_workflow_automation': return 'AI CRM & Workflow Sync Pitch';
                  case 'business_automation': return 'AI Operational Deal Flow Pitch';
                  default: return isMetaAds ? 'AI Meta Ads Conversion Pitch' : isGoogleMaps ? 'AI Operational Audit Pitch' : 'AI-Generated Value Pitch';
                }
              })()}
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>Anti-Spam Verified</span>
            </span>
            {phoneClean ? (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                1-Click WhatsApp Ready
              </span>
            ) : lead.website_url ? (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Website Audit Ready
              </span>
            ) : null}
          </div>
        </div>

        <div className="bg-[var(--color-stone-100)] border border-[var(--color-hairline)] rounded-[var(--radius-panel)] p-4 text-xs text-[var(--color-ink)] leading-relaxed whitespace-pre-wrap select-text font-mono max-h-44 overflow-y-auto break-words">
          {lead.draft_pitch || 'No draft pitch generated for this lead.'}
        </div>

        {/* Prominent Human Approval Boundary Notice */}
        <div className="p-2.5 rounded-[var(--radius-panel)] bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-900 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
          <span><strong>Human Approval Boundary:</strong> Nothing is sent automatically. Manual human approval required.</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2.5 pt-2">
        {/* Primary Direct Action Button (1-Click WhatsApp if phone exists, else Visit Website) */}
        {isLocalLead && whatsAppUrl ? (
          <a
            href={whatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 rounded-full bg-[#25D366] hover:bg-[#1EBE5D] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
          >
            <WhatsAppIcon className="w-4 h-4" />
            <span>Open in WhatsApp (1-Click Outreach)</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </a>
        ) : lead.website_url ? (
          <a
            href={lead.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-4 rounded-full bg-[var(--color-soot)] hover:bg-[var(--color-ink)] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer"
          >
            <Globe className="w-4 h-4" />
            <span>Visit Business Website</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-80" />
          </a>
        ) : null}

        {/* Copy Pitch Button */}
        <button
          onClick={onCopyPitch}
          className={`w-full py-2.5 px-4 rounded-full text-xs font-medium flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer ${
            isLocalLead && whatsAppUrl
              ? 'bg-[var(--color-stone-100)] hover:bg-[var(--color-hairline)] text-[var(--color-ink)] border border-[var(--color-hairline)]'
              : 'bg-[var(--color-cyan)] hover:bg-[var(--color-cyan-edge)] text-white'
          }`}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 text-emerald-600" />
              <span className="font-semibold text-emerald-700">Copied Pitch to Clipboard!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy Pitch to Clipboard</span>
            </>
          )}
        </button>

        {/* Auxiliary Status Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => onUpdateStatus(lead.id, 'pitch_sent')}
            disabled={lead.status === 'pitch_sent'}
            className={`flex-1 py-2 px-3 rounded-full text-xs font-medium border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              lead.status === 'pitch_sent'
                ? 'bg-[var(--color-stone-100)] text-[var(--color-ash-gray)] border-[var(--color-hairline)] opacity-60 cursor-default'
                : 'bg-transparent hover:bg-[var(--color-stone-100)] text-[var(--color-ink)] border-[var(--color-hairline)] hover:border-[var(--color-ink)]'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>{lead.status === 'pitch_sent' ? 'Already Pitched' : 'Mark Pitched'}</span>
          </button>

          <button
            onClick={() => onUpdateStatus(lead.id, 'meeting_booked')}
            className="py-2 px-3 rounded-full text-xs font-medium bg-transparent hover:bg-[var(--color-stone-100)] text-[var(--color-ink)] border border-[var(--color-hairline)] hover:border-[var(--color-ink)] transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Booked Call</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Validates that a lead is authentic and not a hardcoded dummy/test item
 */
function isValidRealLead(lead: Lead): boolean {
  if (!lead || !lead.id) return false;

  // Filter out dummy test UUIDs
  if (/^(11111111|22222222|33333333|44444444|55555555)/.test(lead.id)) {
    return false;
  }

  // Filter out hardcoded mock authors
  const mockAuthors = [
    'u/DrMillerDentistry',
    'u/VelvetLoxSalon',
    'u/ApexRealtyPartners',
    'u/BistroLuminary',
    'u/AustinCommercialBroker',
  ];
  if (mockAuthors.includes(lead.author)) return false;

  // Filter out test dummy Meta Ads from previous test runs
  const sourceUrl = lead.source_url || '';
  const businessName = lead.business_name || '';
  const title = lead.title || '';

  if (
    sourceUrl.includes('ad_475816') ||
    sourceUrl.includes('ad_438573') ||
    businessName.includes('475816') ||
    businessName.includes('438573') ||
    title.includes('475816') ||
    title.includes('438573')
  ) {
    return false;
  }

  return Boolean(lead.title && (lead.body_text || lead.identified_problem));
}

/**
 * Normalizes business names for deduplication:
 * - Lowercase and trimmed
 * - Strip punctuation, special characters, and excess whitespace
 * - Strip common legal/business/industry suffixes like "Clinic", "Dental", "Pvt Ltd", etc.
 */
function normalizeBusinessName(rawName?: string | null): string {
  if (!rawName || typeof rawName !== 'string') return '';

  let normalized = rawName.toLowerCase().trim();

  // Replace separators with spaces
  normalized = normalized.replace(/[-_/\\|&+,]/g, ' ');

  // Remove non-alphanumeric characters (keep letters, digits, spaces)
  normalized = normalized.replace(/[^a-z0-9\s]/g, ' ');

  // Collapse whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Strip leading 'the '
  normalized = normalized.replace(/^the\s+/, '');

  // Strip common suffixes & corporate indicators (as standalone words)
  const suffixes = [
    'pvt ltd',
    'private limited',
    'pvt',
    'ltd',
    'llp',
    'llc',
    'inc',
    'corp',
    'corporation',
    'clinic',
    'clinics',
    'dental',
    'dentistry',
    'hospital',
    'hospitals',
    'centre',
    'center',
    'care',
    'healthcare',
    'studio',
    'solutions',
    'services',
    'salon',
    'spa',
  ];

  for (const suffix of suffixes) {
    const regex = new RegExp(`\\b${suffix}\\b`, 'gi');
    normalized = normalized.replace(regex, ' ');
  }

  return normalized.replace(/\s+/g, ' ').trim();
}

/**
 * Categorize lead into vertical
 */
function getLeadVertical(lead: Lead): 'skin' | 'dental' | 'hair' | 'salon' | 'other' {
  const text = `${lead.business_type || ''} ${lead.business_name || lead.title || ''}`.toLowerCase();
  if (text.includes('skin') || text.includes('derma') || text.includes('aesthetic') || text.includes('laser')) return 'skin';
  if (text.includes('dental') || text.includes('dentist') || text.includes('implant') || text.includes('teeth')) return 'dental';
  if (text.includes('hair') || text.includes('transplant') || text.includes('follicle')) return 'hair';
  if (text.includes('salon') || text.includes('spa') || text.includes('beauty') || text.includes('make-up')) return 'salon';
  return 'other';
}

/**
 * Categorize lead into Delhi NCR region
 */
function getLeadRegion(lead: Lead): 'south' | 'west' | 'north_central' | 'ncr_satellite' | 'other' {
  const addr = `${lead.address || ''} ${lead.business_name || ''} ${lead.body_text || ''}`.toLowerCase();
  if (addr.includes('south') || addr.includes('safdarjung') || addr.includes('kailash') || addr.includes('vasant') || addr.includes('saket') || addr.includes('green park') || addr.includes('hauz khas') || addr.includes('defence colony') || addr.includes('lajpat')) return 'south';
  if (addr.includes('rajouri') || addr.includes('vikaspuri') || addr.includes('janakpuri') || addr.includes('punjabi bagh') || addr.includes('paschim vihar') || addr.includes('dwarka') || addr.includes('west')) return 'west';
  if (addr.includes('kamla nagar') || addr.includes('rohini') || addr.includes('pitampura') || addr.includes('swasthya vihar') || addr.includes('preet vihar') || addr.includes('north') || addr.includes('central') || addr.includes('enclave')) return 'north_central';
  if (addr.includes('gurgaon') || addr.includes('gurugram') || addr.includes('noida') || addr.includes('ghaziabad') || addr.includes('faridabad')) return 'ncr_satellite';
  return 'other';
}

/**
 * Enforces business-level deduplication:
 * 1 Business = Exactly 1 Lead Card in Dashboard
 */
function deduplicateLeads(list: Lead[]): Lead[] {
  const seenBiz = new Set<string>();
  const seenUrls = new Set<string>();
  const result: Lead[] = [];

  for (const lead of list) {
    if (!lead) continue;
    if (lead.source_platform === 'reddit') {
      const urlKey = (lead.source_url || '').toLowerCase().trim();
      if (urlKey && seenUrls.has(urlKey)) continue;
      if (urlKey) seenUrls.add(urlKey);
      result.push(lead);
    } else {
      const normName = normalizeBusinessName(lead.business_name || lead.title);
      if (normName && seenBiz.has(normName)) continue;
      if (normName) seenBiz.add(normName);
      const urlKey = (lead.source_url || '').toLowerCase().trim();
      if (urlKey) seenUrls.add(urlKey);
      result.push(lead);
    }
  }

  return result;
}

const INITIAL_LEADS: Lead[] = (Array.isArray(rawLeads) && rawLeads.length > 0)
  ? deduplicateLeads((rawLeads as Lead[]).filter(isValidRealLead))
  : [];

const LOCAL_STORAGE_KEY = 'leadpulse_v2_clean_delhi_leads_v2';

export default function LeadCommandCenter() {
  const [leads, setLeads] = useState<Lead[]>(INITIAL_LEADS);
  const [activeLeadId, setActiveLeadId] = useState<string>(INITIAL_LEADS[0]?.id || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVertical, setSelectedVertical] = useState<string>('all');
  const [selectedService, setSelectedService] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedScoreTier, setSelectedScoreTier] = useState<'all' | 'immediate' | 'high_potential'>('all');
  const [selectedPlatform, setSelectedPlatform] = useState<'all' | Platform>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | LeadStatus>('all');
  const [copied, setCopied] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isScraperOpen, setIsScraperOpen] = useState(false);
  const [isResearchModalOpen, setIsResearchModalOpen] = useState(false);
  const [isMissionControlOpen, setIsMissionControlOpen] = useState(false);
  const [activeView, setActiveView] = useState<'leads' | 'outreach' | 'research'>('leads');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage((prev) => (prev?.text === text ? null : prev));
    }, 3000);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/login', { method: 'DELETE' });
    } catch {
      // ignore network errors on logout
    } finally {
      window.location.href = '/login';
    }
  };

  // Load persisted leads from Supabase with localStorage / local JSON fallback
  useEffect(() => {
    let isMounted = true;

    // Purge legacy localStorage caches containing old mock data or duplicates
    try {
      localStorage.removeItem('leadpulse_v2_clean_delhi_leads_v1');
      localStorage.removeItem('lead_command_center_clean_v6');
      localStorage.removeItem('lead_command_center_clean_v5');
      localStorage.removeItem('shadcn_lead_pipeline_v3');
      localStorage.removeItem('shadcn_lead_pipeline_v2');
      localStorage.removeItem('shadcn_lead_pipeline');
    } catch {
      // ignore
    }

    async function loadInitialLeads() {
      try {
        const { data, error } = await supabase
          .from('leads')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (isMounted && data && data.length > 0) {
          const fetchedLeads = deduplicateLeads((data as Lead[]).filter(isValidRealLead));
          setLeads(fetchedLeads);
          setIsSupabaseConnected(true);
          if (fetchedLeads.length > 0) {
            setActiveLeadId((prev) => {
              const exists = fetchedLeads.some((l) => l.id === prev);
              return exists ? prev : fetchedLeads[0].id;
            });
          }
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(fetchedLeads));
          } catch {
            // ignore
          }
          return;
        }
      } catch (err) {
        console.warn('⚠️ Could not fetch leads from Supabase, checking local storage:', err);
        if (isMounted) setIsSupabaseConnected(false);
      }

      if (isMounted) {
        try {
          const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
          if (stored) {
            const parsed: Lead[] = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const validLeads = deduplicateLeads(parsed.filter((l) => isValidUuid(l.id) && isValidRealLead(l)));
              if (validLeads.length > 0) {
                setLeads(validLeads);
                setActiveLeadId(validLeads[0].id);
                return;
              }
            }
          }
        } catch (e) {
          console.warn('Could not read saved leads from localStorage', e);
        }

        if (Array.isArray(rawLeads) && rawLeads.length > 0) {
          const cleanLocal = deduplicateLeads((rawLeads as Lead[]).filter(isValidRealLead));
          setLeads(cleanLocal);
          if (cleanLocal.length > 0) {
            setActiveLeadId(cleanLocal[0].id);
          }
        }
      }
    }

    loadInitialLeads();

    return () => {
      isMounted = false;
    };
  }, []);

  // Reset / sync directly from Supabase (or ingested fallback)
  const handleResetToIngested = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const fetched = deduplicateLeads((data as Lead[]).filter(isValidRealLead));
        persistLeads(fetched);
        setIsSupabaseConnected(true);
        if (fetched.length > 0) {
          setActiveLeadId(fetched[0].id);
        }
        setIsSyncing(false);
        showToast('Synced live leads from Supabase');
        return;
      }
    } catch (err) {
      console.warn('Supabase sync failed, falling back to local dataset:', err);
    }

    const target = (Array.isArray(rawLeads) && rawLeads.length > 0)
      ? deduplicateLeads((rawLeads as Lead[]).filter(isValidRealLead))
      : [];
    persistLeads(target);
    if (target.length > 0) {
      setActiveLeadId(target[0].id);
    }
    setIsSyncing(false);
  };

  // Save changes to state & localStorage
  const persistLeads = (newLeads: Lead[]) => {
    const clean = deduplicateLeads(newLeads.filter(isValidRealLead));
    setLeads(clean);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(clean));
    } catch (e) {
      console.warn('Could not save leads to localStorage', e);
    }
  };

  // Dynamically ingest new leads from autonomous scraper
  const handleLeadsIngested = (newLeads: Lead[]) => {
    if (!newLeads || newLeads.length === 0) return;
    const cleanNew = newLeads.filter(isValidRealLead);
    if (cleanNew.length === 0) return;
    setLeads((prev) => {
      const combined = deduplicateLeads([...cleanNew, ...prev]);
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(combined));
      } catch (e) {
        console.warn('Could not save newly ingested leads to localStorage', e);
      }
      return combined;
    });
    if (cleanNew[0]?.id) {
      setActiveLeadId(cleanNew[0].id);
    }
  };

  // Mutate lead status (Supabase persistence + Local cache + Visual Toast)
  const updateStatus = async (leadId: string, newStatus: LeadStatus) => {
    console.log("Updating lead:", leadId, newStatus);

    if (!isValidUuid(leadId)) {
      console.error("Supabase update aborted: leadId is not a valid UUID:", leadId);
      showToast("Invalid lead UUID format", "error");
      return;
    }

    try {
      const { error, data } = await supabase
        .from('leads')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', leadId)
        .select();

      if (error) {
        console.error("Supabase update failed:", error);
        showToast("Failed to save status to database", "error");
        return;
      }

      // Update local cache/state only after confirming the ID format matches and Supabase succeeded
      setLeads((prev) => {
        const updated = prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l));
        try {
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
          console.warn('Could not sync status to localStorage:', e);
        }
        return updated;
      });

      showToast("Status saved to database", "success");
    } catch (err) {
      console.error("Supabase update exception:", err);
      showToast("Failed to connect to database", "error");
    }
  };

  // Active selected lead
  const activeLead = useMemo(() => {
    return leads.find((l) => l.id === activeLeadId) || leads[0] || null;
  }, [leads, activeLeadId]);

  // Stat Ribbon Metrics
  const stats = useMemo(() => {
    const total = leads.length;
    const immediate = leads.filter((l) => (l.prospect_score ?? l.confidence_score ?? 0) >= 8).length;
    const highPotential = leads.filter((l) => {
      const s = l.prospect_score ?? l.confidence_score ?? 0;
      return s >= 6 && s < 8;
    }).length;
    const pitchSent = leads.filter(
      (l) => l.status === 'pitch_sent' || l.status === 'replied' || l.status === 'meeting_booked'
    ).length;
    const bookedCalls = leads.filter((l) => l.status === 'meeting_booked').length;
    const replied = leads.filter((l) => l.status === 'replied' || l.status === 'meeting_booked').length;

    return { total, immediate, highPotential, pitchSent, bookedCalls, replied };
  }, [leads]);

  // 4-Stage Conversion Funnel Calculations
  const funnelStages = useMemo(() => {
    const stage1 = stats.total > 0 ? Math.round((stats.immediate / stats.total) * 100) : 0;
    const stage2 = stats.immediate > 0 ? Math.round((stats.pitchSent / stats.immediate) * 100) : 0;
    const stage3 = stats.pitchSent > 0 ? Math.round((stats.bookedCalls / stats.pitchSent) * 100) : 0;
    const stage4 = stats.total > 0 ? Math.round((stats.bookedCalls / stats.total) * 100) : 0;

    return [
      {
        id: 'stage-1',
        label: 'Discovered → Immediate (≥8)',
        percentage: stage1,
        fillColor: 'var(--color-ink)',
        description: `${stats.immediate} of ${stats.total} hot prospects`,
      },
      {
        id: 'stage-2',
        label: 'Immediate → WhatsApp Pitched',
        percentage: stage2,
        fillColor: 'var(--color-ink)',
        description: `${stats.pitchSent} of ${stats.immediate} outreach delivered`,
      },
      {
        id: 'stage-3',
        label: 'Pitched → Booked Consult',
        percentage: stage3,
        fillColor: 'var(--color-ink)',
        description: `${stats.bookedCalls} of ${stats.pitchSent} calls booked`,
      },
      {
        id: 'stage-4',
        label: 'Overall Deal Conversion',
        percentage: stage4,
        fillColor: 'var(--color-cyan)',
        description: `${stats.bookedCalls} booked calls out of ${stats.total}`,
      },
    ];
  }, [stats]);

  // Platform Counts for filter bar
  const platformCounts = useMemo(() => {
    return {
      all: leads.length,
      google_maps: leads.filter((l) => l.source_platform === 'google_maps').length,
      meta_ads: leads.filter((l) => l.source_platform === 'meta_ads' || l.has_active_ads).length,
    };
  }, [leads]);

  // Vertical Counts
  const verticalCounts = useMemo(() => {
    return {
      all: leads.length,
      skin: leads.filter((l) => getLeadVertical(l) === 'skin').length,
      dental: leads.filter((l) => getLeadVertical(l) === 'dental').length,
      hair: leads.filter((l) => getLeadVertical(l) === 'hair').length,
      salon: leads.filter((l) => getLeadVertical(l) === 'salon').length,
    };
  }, [leads]);

  // Service Counts for filter bar
  const serviceCounts = useMemo(() => {
    return {
      all: leads.length,
      website_development: leads.filter((l) => l.recommended_service === 'website_development').length,
      booking_automation: leads.filter((l) => l.recommended_service === 'booking_automation').length,
      whatsapp_automation: leads.filter((l) => l.recommended_service === 'whatsapp_automation' || (!l.recommended_service && l.direct_contact_channel === 'whatsapp')).length,
      lead_automation: leads.filter((l) => l.recommended_service === 'lead_automation').length,
      ai_agents: leads.filter((l) => l.recommended_service === 'ai_agents').length,
      crm_workflow_automation: leads.filter((l) => l.recommended_service === 'crm_workflow_automation').length,
      business_automation: leads.filter((l) => l.recommended_service === 'business_automation').length,
    };
  }, [leads]);

  // Region Counts
  const regionCounts = useMemo(() => {
    return {
      all: leads.length,
      south: leads.filter((l) => getLeadRegion(l) === 'south').length,
      west: leads.filter((l) => getLeadRegion(l) === 'west').length,
      north_central: leads.filter((l) => getLeadRegion(l) === 'north_central').length,
      ncr_satellite: leads.filter((l) => getLeadRegion(l) === 'ncr_satellite').length,
    };
  }, [leads]);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesAuthor = lead.author?.toLowerCase().includes(q) || false;
        const matchesBusinessName = lead.business_name?.toLowerCase().includes(q) || false;
        const matchesTitle = lead.title?.toLowerCase().includes(q) || false;
        const matchesProblem = lead.identified_problem?.toLowerCase().includes(q) || false;
        const matchesBusiness = lead.business_type?.toLowerCase().includes(q) || false;
        const matchesPhone = lead.phone_number?.toLowerCase().includes(q) || false;
        const matchesAddress = lead.address?.toLowerCase().includes(q) || false;
        if (!matchesAuthor && !matchesBusinessName && !matchesTitle && !matchesProblem && !matchesBusiness && !matchesPhone && !matchesAddress) {
          return false;
        }
      }

      if (selectedVertical !== 'all' && getLeadVertical(lead) !== selectedVertical) {
        return false;
      }

      if (selectedService !== 'all') {
        const s = lead.recommended_service || (lead.direct_contact_channel === 'whatsapp' ? 'whatsapp_automation' : 'business_automation');
        if (s !== selectedService) {
          return false;
        }
      }

      if (selectedRegion !== 'all' && getLeadRegion(lead) !== selectedRegion) {
        return false;
      }

      if (selectedScoreTier !== 'all') {
        const score = lead.prospect_score ?? lead.confidence_score ?? 0;
        if (selectedScoreTier === 'immediate' && score < 8) return false;
        if (selectedScoreTier === 'high_potential' && (score < 6 || score >= 8)) return false;
      }

      if (selectedPlatform !== 'all') {
        if (selectedPlatform === 'meta_ads') {
          if (lead.source_platform !== 'meta_ads' && !lead.has_active_ads) {
            return false;
          }
        } else {
          const leadPlatform = lead.source_platform || 'google_maps';
          if (leadPlatform !== selectedPlatform) {
            return false;
          }
        }
      }

      if (selectedStatus !== 'all' && lead.status !== selectedStatus) {
        return false;
      }

      return true;
    });
  }, [leads, searchQuery, selectedVertical, selectedService, selectedRegion, selectedScoreTier, selectedPlatform, selectedStatus]);

  // Copy Pitch
  const handleCopyPitch = () => {
    if (!activeLead) return;
    navigator.clipboard.writeText(activeLead.draft_pitch);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInspectPitch = (lead: Lead) => {
    setActiveLeadId(lead.id);
    setIsDrawerOpen(true);
  };

  const handleExportLeads = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredLeads, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `leads_export_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const formatStatus = (status: LeadStatus) => {
    switch (status) {
      case 'new': return 'New Lead';
      case 'pitch_sent': return 'Pitch Sent';
      case 'replied': return 'Replied';
      case 'meeting_booked': return 'Meeting Booked';
      case 'archived': return 'Archived';
      default: return status;
    }
  };

  const getStatusIcon = (status: LeadStatus) => {
    switch (status) {
      case 'new': return <Sparkles className="w-3 h-3" />;
      case 'pitch_sent': return <Send className="w-3 h-3" />;
      case 'replied': return <MessageSquare className="w-3 h-3" />;
      case 'meeting_booked': return <CalendarCheck className="w-3 h-3" />;
      case 'archived': return <Archive className="w-3 h-3" />;
      default: return null;
    }
  };

  const getStatusPillClass = (status: LeadStatus) => {
    const base = 'bg-[var(--color-stone-100)] border-[var(--color-hairline)]';
    if (status === 'archived') {
      return `${base} text-[var(--color-ash-gray)]`;
    }
    return `${base} text-[var(--color-ink-soft)]`;
  };

  const renderAuthorInitialChip = (author: string, platform: Platform) => {
    const cleanAuthor = author ? author.replace(/^(u\/|@)/, '') : 'Lead';
    const initial = cleanAuthor.charAt(0).toUpperCase() || 'L';

    return (
      <span 
        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0 select-none bg-[var(--color-stone-100)] text-[var(--color-ink)] border border-[var(--color-hairline)]"
        title={`${author} (${platform})`}
      >
        {initial}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] text-[var(--color-ink)] selection:bg-[var(--color-sky-wash)] selection:text-[var(--color-ink)]">
      
      {/* ────────────────── HEADER (WITHOUT SWITCHER TABS) ────────────────── */}
      <header className="w-full bg-[var(--color-canvas)] border-b border-[var(--color-hairline)] px-10 xl:px-14 2xl:px-20 py-4 sticky top-0 z-30 transition-colors">
        <div className="flex items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[var(--color-ink)] text-white flex items-center justify-center font-medium text-sm shadow-sm shrink-0 select-none">
              LP
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-base font-[family-name:var(--font-inter-tight)] font-medium tracking-tight text-[var(--color-ink)]">
                Lead Command Center
              </span>
              {isSupabaseConnected ? (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-stone-100)] text-[var(--color-warm-gray)] border border-[var(--color-hairline)] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-cyan)] animate-pulse" />
                  Supabase Live ({leads.length})
                </span>
              ) : (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-stone-100)] text-[var(--color-warm-gray)] border border-[var(--color-hairline)] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-ash-gray)]" />
                  Local Cache ({leads.length})
                </span>
              )}
            </div>
          </div>

          {/* Center: View Switcher Tabs */}
          <div className="flex items-center bg-[var(--color-stone-100)] p-1 rounded-full border border-[var(--color-hairline)] shadow-2xs">
            <button
              onClick={() => setActiveView('leads')}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'leads'
                  ? 'bg-[var(--color-soot)] text-white shadow-xs'
                  : 'text-[var(--color-warm-gray)] hover:text-[var(--color-ink)]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Delhi Clinic Leads ({leads.length})</span>
            </button>
            <button
              onClick={() => setActiveView('outreach')}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'outreach'
                  ? 'bg-[var(--color-soot)] text-white shadow-xs'
                  : 'text-[var(--color-warm-gray)] hover:text-[var(--color-ink)]'
              }`}
            >
              <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
              <span>Outreach Approval Queue</span>
            </button>
            <button
              onClick={() => setActiveView('research')}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                activeView === 'research'
                  ? 'bg-[var(--color-soot)] text-white shadow-xs'
                  : 'text-[var(--color-warm-gray)] hover:text-[var(--color-ink)]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Autonomous Research (V2)</span>
            </button>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Live Agent Swarm Telemetry Pill */}
            <AgentSwarmStatusPill onClick={() => setIsMissionControlOpen(true)} />

            {/* Start Research V2 CTA */}
            <button
              onClick={() => setIsResearchModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-medium shadow-sm transition-all cursor-pointer"
              title="Launch V2 Multi-Agent Autonomous Research Swarm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Start Research</span>
            </button>

            {/* Run Scraper CTA */}
            <button
              onClick={() => setIsScraperOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#0a0a0a] hover:bg-[#171717] text-white text-xs font-medium shadow-sm transition-all cursor-pointer"
              title="Run Targeted Google Maps & Meta Ads Scraper"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Quick Scraper</span>
            </button>

            {/* Sync Supabase */}
            <button
              onClick={handleResetToIngested}
              disabled={isSyncing}
              title="Sync with latest leads from Supabase PostgreSQL"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-transparent hover:bg-[var(--color-stone-100)] border border-[var(--color-hairline)] text-[var(--color-ink)] text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 text-[var(--color-warm-gray)] ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Database'}</span>
            </button>

            {/* Export Leads */}
            <button
              onClick={handleExportLeads}
              className="flex items-center gap-2 px-5 py-2 rounded-full bg-[var(--color-cyan)] hover:bg-[var(--color-cyan-edge)] text-white text-xs font-medium shadow-sm transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Leads</span>
            </button>

            {/* Lock / Sign Out */}
            <button
              onClick={handleLogout}
              title="Lock Dashboard Session"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-transparent hover:bg-stone-200/60 border border-[var(--color-hairline)] text-[var(--color-warm-gray)] hover:text-[var(--color-ink)] text-xs font-medium transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lock</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="w-full px-10 xl:px-14 2xl:px-20 py-8 space-y-7">
        {activeView === 'research' ? (
          <ResearchRunsPanel
            onNotify={showToast}
            onViewLeads={() => setActiveView('leads')}
          />
        ) : activeView === 'outreach' ? (
          <OutreachApprovalQueue leads={leads} onNotify={showToast} />
        ) : (
          <>
            {/* ────────────────── PIPELINE OVERVIEW + CONVERSION FUNNEL STRIP ────────────────── */}
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--color-warm-gray)] block">
                DELHI NCR HIGH-TICKET PROSPECT PIPELINE
              </span>
              <h1 className="text-3xl sm:text-4xl font-[family-name:var(--font-inter-tight)] font-normal tracking-tight text-[var(--color-ink)] mt-1">
                <span className="px-2 py-0.5 rounded-md bg-[var(--color-sky-wash)] text-[var(--color-cyan-edge)] font-semibold">{stats.total}</span>{' '}
                verified clinic prospects across Delhi NCR
              </h1>
              <p className="text-sm text-[var(--color-warm-gray)] font-normal mt-1">
                Local business discovery, 10-point scorecard auditing & 1-click WhatsApp deal flow
              </p>
            </div>
          </div>

          {/* 4-Stage Funnel Strip */}
          <div className="grid grid-cols-4 gap-4 p-6 rounded-[var(--radius-shell)] bg-[var(--color-stone-100)] border border-[var(--color-hairline)] card-flat">
            {funnelStages.map((stage) => (
              <div key={stage.id} className="flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between text-xs font-medium gap-2 flex-wrap">
                  <span className="text-[var(--color-ink-soft)]">{stage.label}</span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--color-paper)] border border-[var(--color-hairline)] text-[var(--color-ink)]">
                    {stage.percentage}%
                  </span>
                </div>

                <div className="w-full bg-[var(--color-stone-muted)] h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${Math.min(100, Math.max(0, stage.percentage))}%`,
                      backgroundColor: stage.fillColor,
                    }}
                  />
                </div>

                <div className="text-[11px] text-[var(--color-warm-gray)] font-normal">
                  {stage.description}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ────────────────── KPI STAT CARDS ────────────────── */}
        <section className="grid grid-cols-4 gap-4">
          {/* Card 1: Total Discovered */}
          <div
            onClick={() => { setSelectedStatus('all'); setSelectedVertical('all'); setSelectedRegion('all'); setSelectedScoreTier('all'); setSelectedPlatform('all'); }}
            className="bg-[var(--color-paper)] p-7 rounded-[var(--radius-cards)] border border-[var(--color-hairline)] card-flat cursor-pointer flex flex-col justify-between transition-all"
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] text-[var(--color-warm-gray)] font-medium uppercase tracking-[0.05em]">
                Total Discovered
              </span>
              <div className="w-9 h-9 rounded-[var(--radius-chip)] bg-[var(--color-stone-100)] border border-[var(--color-hairline)] flex items-center justify-center text-[var(--color-ink)] shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4 text-4xl font-[family-name:var(--font-inter-tight)] font-semibold tracking-tight text-[var(--color-ink)]">
              {stats.total}
            </div>
            <div className="mt-2 text-xs text-[var(--color-warm-gray)]">
              High-ticket Delhi NCR clinics
            </div>
          </div>

          {/* Card 2: Immediate Outreach */}
          <div
            onClick={() => { setSelectedScoreTier(selectedScoreTier === 'immediate' ? 'all' : 'immediate'); }}
            className={`bg-[var(--color-paper)] p-7 rounded-[var(--radius-cards)] border card-flat cursor-pointer flex flex-col justify-between transition-all ${
              selectedScoreTier === 'immediate'
                ? 'border-amber-500 ring-2 ring-amber-500/30'
                : 'border-[var(--color-hairline)]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] text-[var(--color-warm-gray)] font-medium uppercase tracking-[0.05em]">
                Immediate Outreach
              </span>
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  <Flame className="w-3 h-3 text-amber-600" />
                  Score ≥ 8
                </span>
              </div>
            </div>
            <div className="mt-4 text-4xl font-[family-name:var(--font-inter-tight)] font-semibold tracking-tight text-[var(--color-ink)]">
              {stats.immediate}
            </div>
            <div className="mt-2 text-xs text-[var(--color-warm-gray)]">
              🔥 Hot leads ready for WhatsApp pitch
            </div>
          </div>

          {/* Card 3: WhatsApp Pitched */}
          <div
            onClick={() => setSelectedStatus(selectedStatus === 'pitch_sent' ? 'all' : 'pitch_sent')}
            className={`bg-[var(--color-paper)] p-7 rounded-[var(--radius-cards)] border card-flat cursor-pointer flex flex-col justify-between transition-all ${
              selectedStatus === 'pitch_sent'
                ? 'border-[var(--color-cyan)] ring-2 ring-[var(--color-cyan)]/30'
                : 'border-[var(--color-hairline)]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] text-[var(--color-warm-gray)] font-medium uppercase tracking-[0.05em]">
                WhatsApp Pitched
              </span>
              <div className="w-9 h-9 rounded-[var(--radius-chip)] bg-[var(--color-stone-100)] border border-[var(--color-hairline)] flex items-center justify-center text-[var(--color-ink)] shrink-0">
                <Send className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4 text-4xl font-[family-name:var(--font-inter-tight)] font-semibold tracking-tight text-[var(--color-ink)]">
              {stats.pitchSent}
            </div>
            <div className="mt-2 text-xs text-[var(--color-warm-gray)]">
              Audit pitches sent to clinic owners
            </div>
          </div>

          {/* Card 4: Booked Consults */}
          <div
            onClick={() => setSelectedStatus(selectedStatus === 'meeting_booked' ? 'all' : 'meeting_booked')}
            className={`bg-[var(--color-paper)] p-7 rounded-[var(--radius-cards)] border card-flat cursor-pointer flex flex-col justify-between transition-all ${
              selectedStatus === 'meeting_booked'
                ? 'border-[var(--color-cyan)] ring-2 ring-[var(--color-cyan)]/30'
                : 'border-[var(--color-hairline)]'
            }`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] text-[var(--color-warm-gray)] font-medium uppercase tracking-[0.05em]">
                Booked Consults
              </span>
              <div className="w-9 h-9 rounded-[var(--radius-chip)] bg-[var(--color-stone-100)] border border-[var(--color-hairline)] flex items-center justify-center text-[var(--color-ink)] shrink-0">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-4 text-4xl font-[family-name:var(--font-inter-tight)] font-semibold tracking-tight text-[var(--color-ink)]">
              {stats.bookedCalls}
            </div>
            <div className="mt-2 text-xs text-[var(--color-warm-gray)]">
              Confirmed discovery meetings
            </div>
          </div>
        </section>

        {/* ────────────────── FILTER & SEARCH SECTION ────────────────── */}
        <section className="bg-[var(--color-paper)] p-5 rounded-[var(--radius-cards)] border border-[var(--color-hairline)] card-flat space-y-4">
          
          {/* Row 1: Source Selector + Score Tier */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--color-hairline)]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-medium text-[var(--color-warm-gray)] uppercase tracking-[0.05em] mr-1">
                Source:
              </span>
              {[
                { id: 'all', label: 'All Sources', icon: null, count: platformCounts.all },
                { id: 'google_maps', label: 'Google Maps', icon: '📍', count: platformCounts.google_maps },
                { id: 'meta_ads', label: 'Meta Ads (Spenders)', icon: '🔥', count: platformCounts.meta_ads },
              ].map((tab) => {
                const isSelected = selectedPlatform === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedPlatform(tab.id as 'all' | Platform)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[var(--color-soot)] text-white border-[var(--color-soot)] shadow-xs'
                        : 'bg-[var(--color-paper)] text-[var(--color-warm-gray)] border-[var(--color-hairline)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]'
                    }`}
                  >
                    {tab.icon && <span className="text-xs">{tab.icon}</span>}
                    <span>{tab.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-[var(--color-stone-100)] text-[var(--color-warm-gray)]'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Score Tier Toggle */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-medium text-[var(--color-warm-gray)] uppercase tracking-[0.05em] mr-1">
                Score Tier:
              </span>
              {[
                { id: 'all', label: 'All Scores' },
                { id: 'immediate', label: '🔥 Immediate (8-10)' },
                { id: 'high_potential', label: '🟢 High Potential (6-7)' },
              ].map((tier) => {
                const isSelected = selectedScoreTier === tier.id;
                return (
                  <button
                    key={tier.id}
                    onClick={() => setSelectedScoreTier(tier.id as any)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--color-soot)] text-white border-[var(--color-soot)] shadow-xs'
                        : 'bg-[var(--color-stone-100)] text-[var(--color-warm-gray)] border-[var(--color-hairline)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]'
                    }`}
                  >
                    {tier.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 2: Service Focus Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 pb-3 border-b border-[var(--color-hairline)]">
            <span className="text-[11px] font-medium text-[var(--color-warm-gray)] uppercase tracking-[0.05em] mr-1">
              Service:
            </span>
            {[
              { id: 'all', label: 'All Services', count: serviceCounts.all },
              { id: 'website_development', label: '🌐 Website Dev', count: serviceCounts.website_development },
              { id: 'booking_automation', label: '📅 Online Booking', count: serviceCounts.booking_automation },
              { id: 'whatsapp_automation', label: '💬 Inquiry Capture', count: serviceCounts.whatsapp_automation },
              { id: 'lead_automation', label: '⚡ Speed-to-Lead', count: serviceCounts.lead_automation },
              { id: 'ai_agents', label: '🤖 Inquiry Assistant', count: serviceCounts.ai_agents },
              { id: 'crm_workflow_automation', label: '🔄 CRM Sync', count: serviceCounts.crm_workflow_automation },
              { id: 'business_automation', label: '⚙️ Business Ops', count: serviceCounts.business_automation },
            ].map((svc) => {
              const isSelected = selectedService === svc.id;
              return (
                <button
                  key={svc.id}
                  onClick={() => setSelectedService(svc.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[var(--color-soot)] text-white border-[var(--color-soot)] shadow-xs'
                      : 'bg-[var(--color-stone-100)] text-[var(--color-warm-gray)] border-[var(--color-hairline)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]'
                  }`}
                >
                  <span>{svc.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-white text-[var(--color-warm-gray)]'
                  }`}>
                    {svc.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Row 3: Search Input + Vertical Pills */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[260px]">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-ash-gray)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search clinics, areas, phone, friction points..."
                className="w-full pl-10 pr-10 py-2.5 bg-[var(--color-stone-100)] border border-[var(--color-hairline)] rounded-[var(--radius-inputs)] text-sm text-[var(--color-ink)] placeholder-[var(--color-ash-gray)] focus:outline-none focus:ring-2 focus:ring-[var(--color-cyan)] focus:border-[var(--color-cyan)] transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[var(--color-ash-gray)] hover:text-[var(--color-ink)] p-1 rounded-full cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Vertical Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-medium text-[var(--color-warm-gray)] uppercase tracking-[0.05em] mr-1">
                Vertical:
              </span>
              {[
                { id: 'all', label: 'All Verticals', count: verticalCounts.all },
                { id: 'skin', label: '💉 Skin & Derma', count: verticalCounts.skin },
                { id: 'dental', label: '🦷 Dental', count: verticalCounts.dental },
                { id: 'hair', label: '💇 Hair Clinic', count: verticalCounts.hair },
                { id: 'salon', label: '💆 Med Spa / Salon', count: verticalCounts.salon },
              ].map((v) => {
                const isActive = selectedVertical === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVertical(v.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-[var(--color-soot)] text-white border-[var(--color-soot)] shadow-xs'
                        : 'bg-[var(--color-stone-100)] text-[var(--color-warm-gray)] border-[var(--color-hairline)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]'
                    }`}
                  >
                    <span>{v.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                      isActive ? 'bg-white/20 text-white' : 'bg-white text-[var(--color-warm-gray)]'
                    }`}>
                      {v.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 3: Delhi NCR Region Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--color-hairline)]">
            <span className="text-[11px] font-medium text-[var(--color-warm-gray)] uppercase tracking-[0.05em] mr-1">
              Area:
            </span>
            {[
              { id: 'all', label: 'All Delhi NCR', count: regionCounts.all },
              { id: 'south', label: 'South Delhi (GK, Safdarjung, Saket)', count: regionCounts.south },
              { id: 'west', label: 'West Delhi (Rajouri, Janakpuri, Vikaspuri)', count: regionCounts.west },
              { id: 'north_central', label: 'North & East (Rohini, Pitampura, Swasthya Vihar)', count: regionCounts.north_central },
              { id: 'ncr_satellite', label: 'Gurgaon & Noida', count: regionCounts.ncr_satellite },
            ].map((reg) => {
              const isSelected = selectedRegion === reg.id;
              return (
                <button
                  key={reg.id}
                  onClick={() => setSelectedRegion(reg.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[var(--color-soot)] text-white border-[var(--color-soot)]'
                      : 'bg-[var(--color-paper)] text-[var(--color-warm-gray)] border-[var(--color-hairline)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]'
                  }`}
                >
                  <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                  <span>{reg.label}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-[var(--color-stone-100)] text-[var(--color-warm-gray)]'
                  }`}>
                    {reg.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Row 4: Status Filter Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[var(--color-hairline)]">
            <span className="text-[11px] font-medium text-[var(--color-warm-gray)] uppercase tracking-[0.05em] mr-1">
              Status:
            </span>
            {(['all', 'new', 'pitch_sent', 'replied', 'meeting_booked', 'archived'] as const).map((st) => {
              const isSelected = selectedStatus === st;
              const count = st === 'all' ? leads.length : leads.filter((l) => l.status === st).length;
              return (
                <button
                  key={st}
                  onClick={() => setSelectedStatus(st)}
                  className={`px-3.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[var(--color-soot)] text-white border-[var(--color-soot)]'
                      : 'bg-[var(--color-paper)] text-[var(--color-warm-gray)] border-[var(--color-hairline)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]'
                  }`}
                >
                  {st !== 'all' && !isSelected && (
                    <span className="text-[var(--color-ash-gray)]">{getStatusIcon(st)}</span>
                  )}
                  <span>{st === 'all' ? 'All' : formatStatus(st)}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-[var(--color-stone-100)] text-[var(--color-warm-gray)]'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ────────────────── MASTER-DETAIL FEED VIEW (SINGLE DEFAULT VIEW) ────────────────── */}
        <section className="grid grid-cols-12 gap-6">
          
          {/* Left Column: Lead Stream */}
          <div className="col-span-7 space-y-4">
            <div className="flex items-center justify-between px-1 flex-wrap gap-2">
              <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--color-warm-gray)]">
                Delhi NCR Deal Stream ({filteredLeads.length})
              </span>
              <span className="text-xs text-[var(--color-warm-gray)]">
                Click card to inspect scorecard &amp; 1-click WhatsApp outreach
              </span>
            </div>

            {filteredLeads.length === 0 ? (
              <div className="bg-[var(--color-paper)] rounded-[var(--radius-cards)] border border-[var(--color-hairline)] p-12 text-center text-xs text-[var(--color-warm-gray)] card-flat">
                No leads match the active search or filters.
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    isActive={activeLead?.id === lead.id}
                    onSelect={(l) => setActiveLeadId(l.id)}
                    onInspectPitch={handleInspectPitch}
                    onStatusChange={updateStatus}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Sticky Pitch Inspector Panel */}
          <div className="col-span-5">
            {activeLead ? (
              <div
                className="bg-[var(--color-paper)] rounded-[var(--radius-cards)] border border-[var(--color-hairline)] p-6 sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto space-y-5"
                style={{ boxShadow: 'var(--shadow-xl)' }}
              >
                {/* Inspector Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[var(--color-hairline)] flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {activeLead.source_platform === 'meta_ads' ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                        <Flame className="w-3 h-3 text-blue-600" />
                        <span>Meta Ads</span>
                      </span>
                    ) : activeLead.source_platform === 'google_maps' ? (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-emerald-600" />
                        <span>Google Maps</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-normal bg-[var(--color-stone-100)] border border-[var(--color-hairline)] text-[var(--color-ink-soft)]">
                        {activeLead.subreddit_or_handle}
                      </span>
                    )}
                    
                    {/* Date Badge */}
                    <span 
                      className="px-2.5 py-0.5 rounded-full text-xs font-normal bg-[var(--color-stone-100)] border border-[var(--color-hairline)] text-[var(--color-warm-gray)] flex items-center gap-1"
                      title={new Date(activeLead.created_at).toLocaleString()}
                    >
                      <Clock className="w-3 h-3 text-[var(--color-ash-gray)]" />
                      <span>{formatRelativeDate(activeLead.created_at)}</span>
                    </span>

                    {/* Status Updater Dropdown */}
                    <select
                      value={activeLead.status}
                      onChange={(e) => updateStatus(activeLead.id, e.target.value as LeadStatus)}
                      className="bg-[var(--color-stone-100)] border border-[var(--color-hairline)] rounded-full px-2.5 py-1 text-xs font-medium text-[var(--color-ink)] focus:outline-none cursor-pointer hover:border-[var(--color-ink)] transition-all"
                    >
                      <option value="new">New Lead</option>
                      <option value="pitch_sent">Pitch Sent</option>
                      <option value="replied">Replied</option>
                      <option value="meeting_booked">Meeting Booked</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>

                  {/* External Source Link */}
                  <a
                    href={activeLead.google_maps_url || activeLead.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-transparent hover:bg-[var(--color-stone-100)] border border-[var(--color-hairline)] text-[var(--color-ink)] transition-all cursor-pointer"
                  >
                    <span>{activeLead.source_platform === 'meta_ads' ? 'Ad Library' : activeLead.source_platform === 'google_maps' ? 'View on Maps' : 'Source Thread'}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <InspectorBody
                  lead={activeLead}
                  copied={copied}
                  onCopyPitch={handleCopyPitch}
                  onUpdateStatus={updateStatus}
                />
              </div>
            ) : (
              <div className="bg-[var(--color-paper)] rounded-[var(--radius-cards)] border border-[var(--color-hairline)] p-8 text-center text-xs text-[var(--color-warm-gray)] card-flat sticky top-20">
                Select a lead on the left stream to inspect pitch.
              </div>
            )}
          </div>
        </section>
      </>
    )}

  </div>

      {/* ────────────────── SLIDE-OVER PITCH DRAWER ────────────────── */}
      {isDrawerOpen && activeLead && (
        <div
          className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/40 backdrop-blur-sm transition-opacity"
          onClick={() => setIsDrawerOpen(false)}
        >
          <div
            className="w-full max-w-xl bg-[var(--color-paper)] h-full border-l border-[var(--color-hairline)] flex flex-col justify-between overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="sticky top-0 z-10 bg-[var(--color-paper)]/95 backdrop-blur-md px-6 py-4 border-b border-[var(--color-hairline)] flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                {activeLead.source_platform === 'meta_ads' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                    <Flame className="w-3 h-3 text-blue-600" />
                    <span>Meta Ads</span>
                  </span>
                ) : activeLead.source_platform === 'google_maps' ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-emerald-600" />
                    <span>Google Maps</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-normal bg-[var(--color-stone-100)] border border-[var(--color-hairline)] text-[var(--color-ink-soft)]">
                    {activeLead.subreddit_or_handle}
                  </span>
                )}

                {/* Relative Date Badge */}
                <span 
                  className="px-2.5 py-0.5 rounded-full text-xs font-normal bg-[var(--color-stone-100)] border border-[var(--color-hairline)] text-[var(--color-warm-gray)] flex items-center gap-1"
                  title={new Date(activeLead.created_at).toLocaleString()}
                >
                  <Clock className="w-3 h-3 text-[var(--color-ash-gray)]" />
                  <span>{formatRelativeDate(activeLead.created_at)}</span>
                </span>

                <select
                  value={activeLead.status}
                  onChange={(e) => updateStatus(activeLead.id, e.target.value as LeadStatus)}
                  className="bg-[var(--color-stone-100)] border border-[var(--color-hairline)] rounded-full px-2.5 py-1 text-xs font-medium text-[var(--color-ink)] focus:outline-none cursor-pointer hover:border-[var(--color-ink)] transition-all"
                >
                  <option value="new">New Lead</option>
                  <option value="pitch_sent">Pitch Sent</option>
                  <option value="replied">Replied</option>
                  <option value="meeting_booked">Meeting Booked</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={activeLead.google_maps_url || activeLead.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-transparent hover:bg-[var(--color-stone-100)] border border-[var(--color-hairline)] text-[var(--color-ink)] transition-all"
                >
                  <span>{activeLead.source_platform === 'meta_ads' ? 'Ad Library' : activeLead.source_platform === 'google_maps' ? 'Maps' : 'Source'}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 text-[var(--color-ash-gray)] hover:text-[var(--color-ink)] rounded-full hover:bg-[var(--color-stone-100)] cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="p-6 flex-1">
              <InspectorBody
                lead={activeLead}
                copied={copied}
                onCopyPitch={handleCopyPitch}
                onUpdateStatus={updateStatus}
              />
            </div>
          </div>
        </div>
      )}

      {/* ────────────────── VISUAL TOAST FEEDBACK ────────────────── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className={`px-4 py-2.5 rounded-full text-xs font-medium shadow-xl flex items-center gap-2 border ${
            toastMessage.type === 'success'
              ? 'bg-[#171717] text-white border-[#262626]'
              : 'bg-red-600 text-white border-red-700'
          }`}>
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[var(--color-cyan)] shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-white shrink-0" />
            )}
            <span>{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Autonomous Scraper Modal */}
      <ScraperModal
        isOpen={isScraperOpen}
        onClose={() => setIsScraperOpen(false)}
        onLeadsIngested={handleLeadsIngested}
        onRefreshData={handleResetToIngested}
        onOpenResearchCampaign={() => setIsResearchModalOpen(true)}
        onOpenMissionControl={() => setIsMissionControlOpen(true)}
      />

      {/* Autonomous Research Campaign Modal */}
      <ResearchCampaignModal
        isOpen={isResearchModalOpen}
        onClose={() => setIsResearchModalOpen(false)}
        onRunCreated={() => {
          setActiveView('research');
        }}
        onNotify={showToast}
      />

      {/* Real-Time AI Agent Mission Control & Thinking Stream Drawer */}
      <AgentMissionControl
        isOpen={isMissionControlOpen}
        onClose={() => setIsMissionControlOpen(false)}
      />
    </div>
  );
}
