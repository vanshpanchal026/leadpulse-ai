'use client';

import React from 'react';
import { 
  ExternalLink, 
  MapPin, 
  Phone, 
  Globe, 
  MessageCircle, 
  Sparkles, 
  Send, 
  MessageSquare, 
  CalendarCheck, 
  Archive, 
  Clock, 
  Target, 
  CheckCircle2, 
  Building2, 
  Flame,
  AlertTriangle
} from 'lucide-react';
import { Lead, LeadStatus, Platform } from '@/types/lead';
import { formatRelativeDate } from '@/lib/format-date';

interface LeadCardProps {
  lead: Lead;
  isActive: boolean;
  onSelect: (lead: Lead) => void;
  onInspectPitch: (lead: Lead) => void;
  onStatusChange: (leadId: string, status: LeadStatus) => void;
}

const InstagramIcon = ({ className = "w-3 h-3" }: { className?: string }) => (
  <svg 
    className={className} 
    width="14" 
    height="14" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
    style={{ maxWidth: '14px', maxHeight: '14px', minWidth: '14px' }}
  >
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const WhatsAppIcon = ({ className = "w-3.5 h-3.5" }: { className?: string }) => (
  <svg 
    className={className} 
    width="14" 
    height="14" 
    viewBox="0 0 24 24" 
    fill="currentColor"
    style={{ maxWidth: '14px', maxHeight: '14px', minWidth: '14px' }}
  >
    <path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.816 9.816 0 0 0 12.04 2zm.01 1.67c2.2 0 4.26.86 5.82 2.42a8.225 8.225 0 0 1 2.41 5.83c0 4.54-3.7 8.24-8.24 8.24-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.196 8.196 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.24-8.24zm4.52 11.66c-.25-.13-1.47-.72-1.7-.81-.23-.08-.39-.13-.56.13-.17.25-.64.81-.79.97-.14.17-.29.19-.54.06-.25-.13-1.06-.39-2.02-1.25-.75-.67-1.26-1.5-1.41-1.75-.15-.25-.02-.39.11-.51.11-.11.25-.29.37-.44.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.44-.06-.13-.56-1.34-.76-1.84-.2-.49-.4-.42-.56-.43h-.47c-.17 0-.44.06-.67.31-.23.25-.87.85-.87 2.08 0 1.22.89 2.41 1.02 2.58.13.17 1.76 2.68 4.26 3.76.6.26 1.06.41 1.43.53.6.19 1.15.16 1.58.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.15-1.18-.07-.1-.23-.17-.48-.29z"/>
  </svg>
);

export function isLegitWebsiteUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase().trim();
  return (
    !lower.includes('wa.me') &&
    !lower.includes('whatsapp.com') &&
    !lower.includes('api.whatsapp.com') &&
    !lower.includes('fb.me') &&
    !lower.includes('facebook.com')
  );
}

export function getServiceBadgeInfo(service?: string) {
  switch (service) {
    case 'website_development':
      return { label: 'Website Dev', bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' };
    case 'booking_automation':
      return { label: 'Online Booking', bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' };
    case 'whatsapp_automation':
      return { label: 'Inquiry Capture', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
    case 'lead_automation':
      return { label: 'Speed-to-Lead', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    case 'ai_agents':
      return { label: 'Inquiry Assistant', bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' };
    case 'crm_workflow_automation':
      return { label: 'CRM Sync', bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', border: 'border-fuchsia-200' };
    case 'business_automation':
      return { label: 'Business Ops', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' };
    default:
      return null;
  }
}

export const LeadCard: React.FC<LeadCardProps> = ({
  lead,
  isActive,
  onSelect,
  onInspectPitch,
  onStatusChange,
}) => {
  const isGoogleMaps = lead.source_platform === 'google_maps';
  const isMetaAds = lead.source_platform === 'meta_ads';
  const isLocalLead = isGoogleMaps || isMetaAds;
  const score = lead.prospect_score ?? lead.confidence_score ?? 0;
  const serviceBadge = getServiceBadgeInfo(lead.recommended_service);

  const formatStatus = (status: LeadStatus) => {
    switch (status) {
      case 'new': return 'New';
      case 'pitch_sent': return 'Pitched';
      case 'replied': return 'Replied';
      case 'meeting_booked': return 'Booked';
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
    if (platform === 'meta_ads') {
      return (
        <span 
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0 select-none bg-blue-50 text-blue-700 border border-blue-200"
          title={`${author} (Meta Ads)`}
        >
          <Flame className="w-3 h-3 text-blue-600" />
        </span>
      );
    }

    if (platform === 'google_maps') {
      return (
        <span 
          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0 select-none bg-emerald-50 text-emerald-700 border border-emerald-200"
          title={`${author} (Google Maps)`}
        >
          <MapPin className="w-3 h-3" />
        </span>
      );
    }

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

  // WhatsApp 1-Click Link
  const phoneClean = (lead.phone_number || '').replace(/[^0-9]/g, '');
  const whatsAppUrl = phoneClean
    ? `https://wa.me/${phoneClean}?text=${encodeURIComponent(lead.draft_pitch || `Hi ${lead.business_name || lead.title}, noticed your clinic on Google Maps.`)}`
    : null;

  return (
    <div
      onClick={() => onSelect(lead)}
      className={`bg-[var(--color-paper)] p-5 rounded-[var(--radius-cards)] border card-flat transition-all cursor-pointer flex flex-col gap-3.5 ${
        isActive
          ? 'border-[var(--color-cyan)] ring-2 ring-[var(--color-cyan)]/30'
          : 'border-[var(--color-hairline)]'
      }`}
    >
      {/* ────────────────── TOP BADGES ROW ────────────────── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {renderAuthorInitialChip(lead.author || lead.business_name || 'Lead', lead.source_platform)}
          <span className="text-xs font-medium text-[var(--color-ink)] truncate max-w-[170px]" title={lead.business_name || lead.author}>
            {lead.business_name || lead.author}
          </span>

          {/* Platform / Subreddit Pill */}
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-normal bg-[var(--color-stone-100)] border border-[var(--color-hairline)] text-[var(--color-ink-soft)] flex items-center gap-1">
            {isMetaAds ? (
              <>
                <Flame className="w-2.5 h-2.5 text-blue-600" />
                <span>Meta Ads</span>
              </>
            ) : isGoogleMaps ? (
              <>
                <MapPin className="w-2.5 h-2.5 text-emerald-600" />
                <span>Google Maps</span>
              </>
            ) : (
              <span>{lead.subreddit_or_handle}</span>
            )}
          </span>

          {/* Relative Date */}
          <span 
            className="px-2 py-0.5 rounded-full text-[10px] font-normal bg-[var(--color-stone-100)] border border-[var(--color-hairline)] text-[var(--color-warm-gray)] flex items-center gap-1"
            title={new Date(lead.created_at).toLocaleString()}
          >
            <Clock className="w-3 h-3 text-[var(--color-ash-gray)]" />
            <span>{formatRelativeDate(lead.created_at)}</span>
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Status Pill */}
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider border flex items-center gap-1 ${getStatusPillClass(lead.status)}`}>
            {getStatusIcon(lead.status)}
            <span>{formatStatus(lead.status)}</span>
          </span>

          {/* Recommended Service Badge */}
          {serviceBadge && (
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${serviceBadge.bg} ${serviceBadge.text} ${serviceBadge.border}`}>
              {serviceBadge.label}
            </span>
          )}

          {/* Local / Meta Ads Scorecard Pill */}
          {isLocalLead ? (
            <>
              {score >= 8 ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                  <Flame className="w-3 h-3 text-amber-600" />
                  <span>{score}/10 Immediate</span>
                </span>
              ) : score >= 6 ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>{score}/10 High</span>
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-700 border border-stone-200">
                  {score}/10 Medium
                </span>
              )}

              {lead.has_active_ads && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                  <span>🔥 Ads Active</span>
                </span>
              )}
            </>
          ) : (
            <>
              {score >= 8 && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-[var(--color-sky-wash)] text-[var(--color-cyan-edge)] border border-[var(--color-cyan-edge)]/30 flex items-center gap-1">
                  <Target className="w-2.5 h-2.5" />
                  High Intent
                </span>
              )}
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-stone-100)] border border-[var(--color-hairline)] text-[var(--color-ink)]">
                ★ {score}/10
              </span>
            </>
          )}
        </div>
      </div>

      {/* ────────────────── TITLE / BUSINESS NAME & LOCATION ────────────────── */}
      <div>
        <h3 className="text-[15px] font-[family-name:var(--font-inter-tight)] font-semibold tracking-tight text-[var(--color-ink)] leading-snug break-words">
          {lead.business_name || lead.title}
        </h3>

        {lead.address && (
          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[var(--color-warm-gray)]">
            <MapPin className="w-3 h-3 text-[var(--color-ash-gray)] shrink-0" />
            <span className="truncate" title={lead.address}>{lead.address}</span>
          </div>
        )}
      </div>

      {/* ────────────────── VERIFIED ASSETS BADGE ROW ────────────────── */}
      {isLocalLead && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {/* 1. 🔥 Meta Ads Active */}
          {(lead.has_active_ads || isMetaAds) && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              <Flame className="w-3 h-3 text-blue-600" />
              <span>Meta Ads Active</span>
            </span>
          )}

          {/* 2. ★ 4.8 (120 reviews) with link to Google Maps */}
          {typeof lead.rating === 'number' && lead.rating > 0 ? (
            <a
              href={lead.google_maps_url || (lead.source_platform === 'google_maps' ? lead.source_url : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.business_name || lead.title)}`)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-900 border border-amber-200 hover:border-amber-400 hover:bg-amber-100/70 transition-colors"
              title="Open Google Maps listing"
            >
              <span>★ {lead.rating.toFixed(1)}</span>
              <span className="text-amber-700">({lead.review_count || 0} reviews)</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>
          ) : isGoogleMaps && (
            <a
              href={lead.google_maps_url || lead.source_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 hover:border-emerald-400 transition-colors"
            >
              <MapPin className="w-2.5 h-2.5 text-emerald-600" />
              <span>Google Maps</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>
          )}

          {/* 3. 📸 Instagram link */}
          {lead.instagram_url && (
            <a
              href={lead.instagram_url.startsWith('http') ? lead.instagram_url : `https://${lead.instagram_url}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-normal bg-[var(--color-stone-100)] border border-[var(--color-hairline)] text-[var(--color-ink-soft)] hover:text-pink-600 hover:border-pink-300 transition-colors"
            >
              <InstagramIcon className="w-3 h-3" />
              <span>Instagram</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>
          )}

          {/* 4. 🌐 Website link (Strictly filtered so WhatsApp links never show as Website) */}
          {isLegitWebsiteUrl(lead.website_url) && (
            <a
              href={lead.website_url!.startsWith('http') ? lead.website_url! : `https://${lead.website_url!}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-normal bg-[var(--color-stone-100)] border border-[var(--color-hairline)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] hover:border-[var(--color-ink)] transition-colors"
            >
              <Globe className="w-3 h-3 text-[var(--color-ash-gray)]" />
              <span>Website</span>
              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
            </a>
          )}

          {/* 5. 📞 Phone / WhatsApp */}
          {lead.phone_number && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[var(--color-stone-100)] border border-[var(--color-hairline)] text-[var(--color-ink)]">
              <Phone className="w-3 h-3 text-[var(--color-warm-gray)]" />
              <span>{lead.phone_number}</span>
            </span>
          )}
        </div>
      )}

      {/* ────────────────── FRICTION CHIPS (LOCAL & META ADS) OR PAIN POINT (REDDIT) ────────────────── */}
      {isLocalLead && lead.audit_friction_points && lead.audit_friction_points.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {lead.audit_friction_points.slice(0, 3).map((friction, idx) => (
            <span
              key={idx}
              className="px-2.5 py-1 rounded-[10px] text-[11px] font-normal bg-[var(--color-stone-100)] border border-[var(--color-hairline)] text-[var(--color-warm-gray)] flex items-center gap-1"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              <span className="truncate max-w-[240px]">{friction}</span>
            </span>
          ))}
        </div>
      ) : (
        <div className="text-xs text-[var(--color-warm-gray)] leading-relaxed bg-[var(--color-stone-100)] p-3 rounded-[var(--radius-panel)] border border-[var(--color-hairline)] break-words">
          <span className="font-medium text-[var(--color-ink)]">Pain point: </span>
          {lead.identified_problem}
        </div>
      )}

      {/* ────────────────── BOTTOM ACTION ROW ────────────────── */}
      <div className="flex items-center justify-between pt-1 text-xs flex-wrap gap-2">
        <span 
          className="text-xs text-[var(--color-warm-gray)] flex items-center gap-1.5 break-words"
          title={lead.business_type}
        >
          <Building2 className="w-3.5 h-3.5 text-[var(--color-ash-gray)] shrink-0" />
          <span className="break-words">{lead.business_type}</span>
        </span>

        <div className="flex items-center gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
          {/* Quick WhatsApp Action (if phone exists) */}
          {isLocalLead && whatsAppUrl && (
            <a
              href={whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-[#25D366] hover:bg-[#1EBE5D] text-white transition-all shadow-xs"
              title="Open direct WhatsApp outreach"
            >
              <WhatsAppIcon className="w-3 h-3" />
              <span>WhatsApp</span>
            </a>
          )}

          <button
            onClick={() => onInspectPitch(lead)}
            className="px-3.5 py-1.5 rounded-full text-xs font-medium border border-[var(--color-hairline)] bg-transparent hover:bg-[var(--color-stone-100)] hover:border-[var(--color-ink)] text-[var(--color-ink)] transition-all cursor-pointer"
          >
            Inspect Pitch
          </button>

          <select
            value={lead.status}
            onChange={(e) => onStatusChange(lead.id, e.target.value as LeadStatus)}
            className="bg-transparent border border-[var(--color-hairline)] rounded-full px-2.5 py-1 text-xs font-normal text-[var(--color-ink)] focus:outline-none cursor-pointer hover:border-[var(--color-ink)] transition-all w-auto min-w-fit"
          >
            <option value="new">New Lead</option>
            <option value="pitch_sent">Pitch Sent</option>
            <option value="replied">Replied</option>
            <option value="meeting_booked">Meeting Booked</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>
    </div>
  );
};
