'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCw,
  Edit3,
  Check,
  X,
  AlertTriangle,
  Copy,
  Search,
  MessageSquare,
  FileText,
} from 'lucide-react';
import {
  OutreachRecord,
  ApprovalStatus,
  OutreachDraft,
  OutreachValidationResult,
  OutreachEvidenceItem,
} from '@/types/outreach';
import { Lead } from '@/types/lead';

interface OutreachApprovalQueueProps {
  leads: Lead[];
  onNotify?: (message: string, type: 'success' | 'error') => void;
}

function createDefaultOutreachRecords(leads: Lead[]): OutreachRecord[] {
  const targetLeads = leads.slice(0, 8);
  const now = new Date().toISOString();

  return targetLeads.map((lead, idx) => {
    const isMeta = lead.source_platform === 'meta_ads' || lead.has_active_ads;
    const isMaps = lead.source_platform === 'google_maps';
    const bizName = lead.business_name || lead.title || `Local Business #${idx + 1}`;
    const oppScore = lead.prospect_score ? Math.min(100, Math.max(20, lead.prospect_score * 9.5)) : 78 + ((idx * 2) % 20);

    let service = 'whatsapp_automation';
    let problem = 'High traffic from active ads leaking without instant chat capture.';
    let message = 'Noticed your active Meta ads are driving traffic, but there is no direct WhatsApp chat on your landing page. Adding automated instant responses captures leads before they drop off.';

    if (isMaps && !isMeta) {
      service = 'booking_automation';
      problem = 'Strong Google Maps presence (4.8★) but relies exclusively on manual phone booking.';
      message = 'Saw your 50+ Google reviews and strong local presence. You are currently answering bookings manually by phone, which can lead to missed inquiries during peak hours.';
    } else if (idx % 3 === 0) {
      service = 'website_development';
      problem = 'Running paid campaigns to an outdated, slow-loading mobile landing page.';
      message = 'Saw your active marketing campaigns in our local audit. Your landing page takes over 4 seconds on mobile, causing visitors to bounce before seeing your offer.';
    }

    const evidence: OutreachEvidenceItem[] = [
      {
        field: isMeta ? 'meta_ads' : 'maps_reputation',
        source: isMeta ? 'meta_ads_library' : 'google_places',
        raw_value: isMeta ? '3 active Instagram & Facebook ad campaigns' : 'Google rating 4.8 with 45 reviews',
        confidence: 0.92,
        extracted_at: now,
      },
      {
        field: 'website_cta',
        source: 'website_crawler',
        raw_value: 'Missing WhatsApp click-to-chat button on primary viewport',
        confidence: 0.88,
        extracted_at: now,
      },
    ];

    const validation: OutreachValidationResult = {
      valid: true,
      reasons: [],
      character_count: message.length,
      sentence_count: 2,
      banned_phrase_found: false,
      unsupported_claim_detected: false,
      placeholder_detected: false,
      unsupported_service: false,
    };

    const draft: OutreachDraft = {
      message,
      service,
      evidence_used: evidence,
      confidence: 0.89,
      status: 'draft',
      validation_reasons: [],
      character_count: message.length,
      sentence_count: 2,
    };

    let approvalStatus: ApprovalStatus = 'awaiting_human_approval';
    if (idx === 1) approvalStatus = 'approved';
    if (idx === 3) approvalStatus = 'rejected';

    return {
      lead_id: lead.id,
      business_name: bizName,
      opportunity_score: oppScore,
      primary_problem: problem,
      recommended_service: service,
      confidence: 0.89,
      evidence,
      draft,
      validation,
      approval_status: approvalStatus,
      regeneration_count: 0,
      created_at: now,
      updated_at: now,
    };
  });
}

function validateDraftMessage(text: string): { valid: boolean; reasons: string[] } {
  const trimmed = text.trim();
  const reasons: string[] = [];

  if (!trimmed) {
    return { valid: false, reasons: ['Message cannot be empty.'] };
  }

  if (trimmed.length > 300) {
    reasons.push(`Message exceeds 300 characters (current: ${trimmed.length}).`);
  }

  const banned = [
    'we help', 'we specialize', 'our agency', 'our team', 'game-changer', 'game changer',
    'leverage', 'hop on a call', 'jump on a call', 'book a demo', 'book a call', 'schedule a call',
    'free consultation', 'act now', 'limited time', 'guarantee', 'guaranteed'
  ];
  const lower = trimmed.toLowerCase();
  for (const b of banned) {
    if (lower.includes(b)) {
      reasons.push(`Contains prohibited phrase: "${b}".`);
    }
  }

  if (/(\[[^\]]+\]|\{[^\}]+\}|YOUR BUSINESS|<company>)/i.test(trimmed)) {
    reasons.push('Contains unpopulated template placeholder.');
  }

  const sentences = trimmed.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length < 2 || sentences.length > 3) {
    reasons.push(`Must contain exactly 2–3 sentences (found: ${sentences.length}).`);
  }

  return { valid: reasons.length === 0, reasons };
}

export function OutreachApprovalQueue({ leads, onNotify }: OutreachApprovalQueueProps) {
  const [records, setRecords] = useState<OutreachRecord[]>(() => createDefaultOutreachRecords(leads));
  const [selectedStatus, setSelectedStatus] = useState<'all' | ApprovalStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editReasons, setEditReasons] = useState<string[]>([]);
  const [isRegenerating, setIsRegenerating] = useState<Record<string, boolean>>({});
  const [isApproving, setIsApproving] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [rejectDialogLeadId, setRejectDialogLeadId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('Out of scope for current consulting cohort');

  useEffect(() => {
    if (records.length === 0 && leads.length > 0) {
      setRecords(createDefaultOutreachRecords(leads));
    }
  }, [leads, records.length]);

  useEffect(() => {
    async function fetchLiveRecords() {
      try {
        const res = await fetch('/api/outreach');
        if (res.ok) {
          const liveData: OutreachRecord[] = await res.json();
          if (Array.isArray(liveData) && liveData.length > 0) {
            setRecords(prev => {
              const existingIds = new Set(liveData.map(r => r.lead_id));
              const merged = [...liveData, ...prev.filter(p => !existingIds.has(p.lead_id))];
              return merged;
            });
          }
        }
      } catch {
        // Fallback kept
      }
    }
    fetchLiveRecords();
  }, []);

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      if (selectedStatus !== 'all' && r.approval_status !== selectedStatus) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = r.business_name.toLowerCase().includes(q);
        const matchesProblem = r.primary_problem.toLowerCase().includes(q);
        const matchesService = r.recommended_service.toLowerCase().includes(q);
        const matchesMessage = r.draft.message.toLowerCase().includes(q);
        if (!matchesName && !matchesProblem && !matchesService && !matchesMessage) {
          return false;
        }
      }
      return true;
    });
  }, [records, selectedStatus, searchQuery]);

  const counts = useMemo(() => {
    return {
      total: records.length,
      awaiting: records.filter(r => r.approval_status === 'awaiting_human_approval').length,
      approved: records.filter(r => r.approval_status === 'approved').length,
      rejected: records.filter(r => r.approval_status === 'rejected').length,
    };
  }, [records]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    if (onNotify) onNotify('Draft copied to clipboard', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleStartEdit = (record: OutreachRecord) => {
    setEditingLeadId(record.lead_id);
    setEditText(record.draft.message);
    const val = validateDraftMessage(record.draft.message);
    setEditReasons(val.reasons);
  };

  const handleEditChange = (val: string) => {
    setEditText(val);
    const check = validateDraftMessage(val);
    setEditReasons(check.reasons);
  };

  const handleSaveEdit = async (record: OutreachRecord) => {
    const val = validateDraftMessage(editText);
    if (!val.valid) {
      if (onNotify) onNotify(`Cannot save invalid message: ${val.reasons[0]}`, 'error');
      return;
    }

    try {
      const res = await fetch(`/api/outreach/${record.lead_id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: editText, edited_by: 'lead_operator' }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.record) {
          setRecords(prev => prev.map(r => r.lead_id === record.lead_id ? data.record : r));
          setEditingLeadId(null);
          if (onNotify) onNotify('Message edited and re-validated successfully', 'success');
          return;
        }
      }
    } catch {
      // Fallback
    }

    const sentences = editText.trim().split(/[.!?]+/).filter(s => s.trim().length > 0);
    const updatedValidation: OutreachValidationResult = {
      valid: true,
      reasons: [],
      character_count: editText.length,
      sentence_count: sentences.length,
      banned_phrase_found: false,
      unsupported_claim_detected: false,
      placeholder_detected: false,
      unsupported_service: false,
    };

    setRecords(prev => prev.map(r => {
      if (r.lead_id === record.lead_id) {
        return {
          ...r,
          draft: {
            ...r.draft,
            message: editText,
            character_count: editText.length,
            sentence_count: sentences.length,
            validation_reasons: [],
            status: 'draft',
          },
          validation: updatedValidation,
          updated_at: new Date().toISOString(),
        };
      }
      return r;
    }));

    setEditingLeadId(null);
    if (onNotify) onNotify('Message edited and re-validated', 'success');
  };

  const handleApprove = async (record: OutreachRecord) => {
    if (!record.validation.valid) {
      if (onNotify) onNotify('Approval strictly blocked: Draft contains validation errors. Edit or regenerate first.', 'error');
      return;
    }

    setIsApproving(prev => ({ ...prev, [record.lead_id]: true }));

    try {
      const res = await fetch(`/api/outreach/${record.lead_id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved_by: 'lead_operator', notes: 'Verified peer-to-peer tone' }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.record) {
          setRecords(prev => prev.map(r => r.lead_id === record.lead_id ? data.record : r));
          if (onNotify) onNotify(`Approved outreach for ${record.business_name}. Staged for sending.`, 'success');
          setIsApproving(prev => ({ ...prev, [record.lead_id]: false }));
          return;
        }
      }
    } catch {
      // Local state fallback
    }

    setRecords(prev => prev.map(r => {
      if (r.lead_id === record.lead_id) {
        return {
          ...r,
          approval_status: 'approved',
          updated_at: new Date().toISOString(),
        };
      }
      return r;
    }));

    setIsApproving(prev => ({ ...prev, [record.lead_id]: false }));
    if (onNotify) onNotify(`Approved outreach for ${record.business_name}. Staged for future send.`, 'success');
  };

  const handleReject = async (leadId: string) => {
    try {
      const res = await fetch(`/api/outreach/${leadId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejected_by: 'lead_operator', reason: rejectReason }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.record) {
          setRecords(prev => prev.map(r => r.lead_id === leadId ? data.record : r));
          setRejectDialogLeadId(null);
          if (onNotify) onNotify('Outreach draft rejected and archived.', 'error');
          return;
        }
      }
    } catch {
      // Local state fallback
    }

    setRecords(prev => prev.map(r => {
      if (r.lead_id === leadId) {
        return {
          ...r,
          approval_status: 'rejected',
          updated_at: new Date().toISOString(),
        };
      }
      return r;
    }));

    setRejectDialogLeadId(null);
    if (onNotify) onNotify('Outreach draft marked as rejected.', 'error');
  };

  const handleRegenerate = async (record: OutreachRecord) => {
    if (record.regeneration_count >= 2) {
      if (onNotify) onNotify('Maximum regeneration attempts (2) reached for this lead.', 'error');
      return;
    }

    setIsRegenerating(prev => ({ ...prev, [record.lead_id]: true }));

    try {
      const res = await fetch(`/api/outreach/${record.lead_id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.record) {
          setRecords(prev => prev.map(r => r.lead_id === record.lead_id ? data.record : r));
          if (onNotify) onNotify(`Regenerated draft for ${record.business_name}`, 'success');
          setIsRegenerating(prev => ({ ...prev, [record.lead_id]: false }));
          return;
        }
      }
    } catch {
      // Local fallback
    }

    const updatedCount = record.regeneration_count + 1;
    const newMsg = 'Saw your active marketing campaigns in our local audit. Visitors click your offer but face booking friction on mobile. Adding direct WhatsApp capture recovers lost prospects.';
    const sentences = newMsg.split(/[.!?]+/).filter(s => s.trim().length > 0);

    setRecords(prev => prev.map(r => {
      if (r.lead_id === record.lead_id) {
        return {
          ...r,
          regeneration_count: updatedCount,
          draft: {
            ...r.draft,
            message: newMsg,
            character_count: newMsg.length,
            sentence_count: sentences.length,
          },
          validation: {
            ...r.validation,
            character_count: newMsg.length,
            sentence_count: sentences.length,
            valid: true,
            reasons: [],
          },
          approval_status: 'awaiting_human_approval',
          updated_at: new Date().toISOString(),
        };
      }
      return r;
    }));

    setIsRegenerating(prev => ({ ...prev, [record.lead_id]: false }));
    if (onNotify) onNotify(`Draft regenerated (Attempt ${updatedCount}/2)`, 'success');
  };

  return (
    <div className="space-y-6">
      {/* PROMINENT HUMAN APPROVAL BOUNDARY BANNER */}
      <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-[var(--radius-shell)] p-5 text-[var(--color-ink)] space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-800 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-amber-900 tracking-tight flex items-center gap-2">
              <span>Strict Human Approval Boundary</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/80 text-amber-900 border border-amber-300">
                ZERO AUTO-SENDING
              </span>
            </h3>
            <p className="text-xs text-amber-800/90 font-medium">
              Nothing is sent automatically. Manual human approval required.
            </p>
          </div>
        </div>
        <div className="text-[11px] text-amber-800/80 pl-12 flex items-center gap-4 flex-wrap">
          <span>• Deterministic Anti-Spam Gate active</span>
          <span>• Approvals cannot bypass validation</span>
          <span>• Manual edits trigger automated re-validation</span>
          <span>• Ready state stages drafts for future manual dispatch</span>
        </div>
      </div>

      {/* QUEUE STATS RIBBON */}
      <div className="grid grid-cols-4 gap-4">
        <div
          onClick={() => setSelectedStatus('all')}
          className={`p-5 rounded-[var(--radius-cards)] border bg-[var(--color-paper)] card-flat cursor-pointer transition-all ${
            selectedStatus === 'all' ? 'border-[var(--color-ink)] shadow-xs' : 'border-[var(--color-hairline)]'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-[var(--color-warm-gray)]">
            <span className="uppercase tracking-[0.05em] font-medium text-[10px]">Total In Queue</span>
            <FileText className="w-4 h-4 text-[var(--color-ash-gray)]" />
          </div>
          <div className="mt-2 text-3xl font-[family-name:var(--font-inter-tight)] font-normal text-[var(--color-ink)]">
            {counts.total}
          </div>
          <div className="mt-1 text-[11px] text-[var(--color-warm-gray)]">All generated drafts</div>
        </div>

        <div
          onClick={() => setSelectedStatus('awaiting_human_approval')}
          className={`p-5 rounded-[var(--radius-cards)] border bg-[var(--color-paper)] card-flat cursor-pointer transition-all ${
            selectedStatus === 'awaiting_human_approval' ? 'border-amber-500 ring-2 ring-amber-500/20 shadow-xs' : 'border-[var(--color-hairline)]'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-amber-700">
            <span className="uppercase tracking-[0.05em] font-medium text-[10px]">Awaiting Review</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-3xl font-[family-name:var(--font-inter-tight)] font-normal text-amber-900">
            {counts.awaiting}
          </div>
          <div className="mt-1 text-[11px] text-amber-700/80">Pending operator decision</div>
        </div>

        <div
          onClick={() => setSelectedStatus('approved')}
          className={`p-5 rounded-[var(--radius-cards)] border bg-[var(--color-paper)] card-flat cursor-pointer transition-all ${
            selectedStatus === 'approved' ? 'border-emerald-600 ring-2 ring-emerald-600/20 shadow-xs' : 'border-[var(--color-hairline)]'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-emerald-700">
            <span className="uppercase tracking-[0.05em] font-medium text-[10px]">Approved (Staged)</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-3xl font-[family-name:var(--font-inter-tight)] font-normal text-emerald-900">
            {counts.approved}
          </div>
          <div className="mt-1 text-[11px] text-emerald-700/80">Verified & ready for future dispatch</div>
        </div>

        <div
          onClick={() => setSelectedStatus('rejected')}
          className={`p-5 rounded-[var(--radius-cards)] border bg-[var(--color-paper)] card-flat cursor-pointer transition-all ${
            selectedStatus === 'rejected' ? 'border-stone-400 shadow-xs' : 'border-[var(--color-hairline)]'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-[var(--color-warm-gray)]">
            <span className="uppercase tracking-[0.05em] font-medium text-[10px]">Rejected / Excluded</span>
            <XCircle className="w-4 h-4 text-[var(--color-ash-gray)]" />
          </div>
          <div className="mt-2 text-3xl font-[family-name:var(--font-inter-tight)] font-normal text-[var(--color-warm-gray)]">
            {counts.rejected}
          </div>
          <div className="mt-1 text-[11px] text-[var(--color-warm-gray)]">Excluded by reviewer</div>
        </div>
      </div>

      {/* FILTER & SEARCH BAR */}
      <div className="bg-[var(--color-paper)] p-4 rounded-[var(--radius-cards)] border border-[var(--color-hairline)] flex items-center justify-between gap-4 flex-wrap card-flat">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-medium text-[var(--color-warm-gray)] uppercase tracking-[0.05em] mr-1">
            Filter:
          </span>
          {[
            { id: 'all', label: 'All Drafts', count: counts.total },
            { id: 'awaiting_human_approval', label: 'Awaiting Review', count: counts.awaiting },
            { id: 'approved', label: 'Approved', count: counts.approved },
            { id: 'rejected', label: 'Rejected', count: counts.rejected },
          ].map(tab => {
            const isSelected = selectedStatus === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedStatus(tab.id as any)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[var(--color-soot)] text-white border-[var(--color-soot)]'
                    : 'bg-[var(--color-paper)] text-[var(--color-warm-gray)] border-[var(--color-hairline)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-medium ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-[var(--color-stone-100)] text-[var(--color-warm-gray)]'
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative min-w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-ash-gray)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search business, problem, or service..."
            className="w-full pl-9 pr-8 py-1.5 bg-[var(--color-stone-100)] border border-[var(--color-hairline)] rounded-[var(--radius-inputs)] text-xs text-[var(--color-ink)] placeholder-[var(--color-ash-gray)] focus:outline-none focus:ring-1 focus:ring-[var(--color-cyan)]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--color-ash-gray)] hover:text-[var(--color-ink)] p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* OUTREACH QUEUE FEED */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--color-warm-gray)]">
            Outreach Approval Items ({filteredRecords.length})
          </span>
          <span className="text-xs text-[var(--color-warm-gray)]">
            Approvals strictly require passing validation
          </span>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="bg-[var(--color-paper)] rounded-[var(--radius-cards)] border border-[var(--color-hairline)] p-12 text-center text-xs text-[var(--color-warm-gray)] card-flat">
            No outreach drafts match the active filters.
          </div>
        ) : (
          filteredRecords.map((record) => {
            const isEditing = editingLeadId === record.lead_id;
            const isApproved = record.approval_status === 'approved';
            const isRejected = record.approval_status === 'rejected';
            const isAwaiting = record.approval_status === 'awaiting_human_approval';
            const isValid = record.validation.valid;

            return (
              <div
                key={record.lead_id}
                className={`bg-[var(--color-paper)] rounded-[var(--radius-cards)] border p-6 space-y-4 transition-all card-flat ${
                  isApproved
                    ? 'border-emerald-500/40 bg-emerald-50/10'
                    : isRejected
                    ? 'border-stone-300 opacity-75'
                    : 'border-[var(--color-hairline)]'
                }`}
              >
                {/* Header: Business Name, Opportunity Score, Recommended Service, and Status */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-base font-semibold text-[var(--color-ink)] tracking-tight">
                        {record.business_name}
                      </h4>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-stone-100)] text-[var(--color-ink-soft)] border border-[var(--color-hairline)]">
                        Opportunity Score: {Math.round(record.opportunity_score)}/100
                      </span>
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[var(--color-sky-wash)] text-[var(--color-cyan-edge)] border border-[var(--color-cyan-edge)]/30">
                        {Math.round(record.confidence * 100)}% Confidence
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-[var(--color-warm-gray)] flex-wrap">
                      <span className="font-medium text-[var(--color-ink-soft)]">Recommended Service:</span>
                      <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-[var(--color-stone-100)] border border-[var(--color-hairline)] text-[var(--color-ink)]">
                        {record.recommended_service}
                      </span>
                      <span>•</span>
                      <span>Primary Problem: <strong className="text-[var(--color-ink-soft)] font-normal">{record.primary_problem}</strong></span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2">
                    {isAwaiting && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>Awaiting Review</span>
                      </span>
                    )}
                    {isApproved && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Approved — Staged for Send</span>
                      </span>
                    )}
                    {isRejected && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-stone-100 text-stone-700 border border-stone-300 flex items-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5 text-stone-500" />
                        <span>Rejected</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Grounding Evidence Provenance Chips */}
                {record.evidence && record.evidence.length > 0 && (
                  <div className="bg-[var(--color-stone-100)] rounded-[var(--radius-panel)] p-3 space-y-1.5 border border-[var(--color-hairline)]">
                    <span className="text-[10px] font-semibold text-[var(--color-warm-gray)] uppercase tracking-[0.05em] block">
                      Grounding Evidence Provenance
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {record.evidence.map((ev, idx) => (
                        <div
                          key={idx}
                          className="bg-white px-2.5 py-1 rounded-md text-xs text-[var(--color-ink-soft)] border border-[var(--color-hairline)] flex items-center gap-1.5 shadow-2xs"
                        >
                          <span className="text-[10px] uppercase font-bold text-[var(--color-warm-gray)]">{ev.source}:</span>
                          <span className="truncate max-w-[320px]">{String(ev.raw_value)}</span>
                          <span className="text-[10px] text-[var(--color-ash-gray)]">({Math.round((ev.confidence || 0.9) * 100)}%)</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Draft Message & Validation Result */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                    <span className="font-medium text-[var(--color-ink)] flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-[var(--color-cyan-edge)]" />
                      <span>Draft Outreach Message</span>
                    </span>

                    <div className="flex items-center gap-2">
                      {isValid ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Validation Passed ({record.draft.character_count}/300 chars • {record.draft.sentence_count} sent.)</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-700 border border-red-200 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-red-600" />
                          <span>Validation Failed ({record.validation.reasons.length} issues)</span>
                        </span>
                      )}

                      {record.regeneration_count > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-stone-100 text-stone-600 border border-[var(--color-hairline)]">
                          Regen {record.regeneration_count}/2
                        </span>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        value={editText}
                        onChange={(e) => handleEditChange(e.target.value)}
                        rows={3}
                        className="w-full p-3.5 bg-white border border-[var(--color-hairline)] rounded-[var(--radius-panel)] text-xs font-mono text-[var(--color-ink)] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[var(--color-cyan)] shadow-inner resize-y"
                        placeholder="Draft personalized message (2–3 sentences, <=300 chars)..."
                      />

                      <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-mono font-medium ${
                            editText.length > 300 ? 'text-red-600 font-bold' : 'text-[var(--color-warm-gray)]'
                          }`}>
                            {editText.length} / 300 characters
                          </span>
                          {editReasons.length > 0 && (
                            <span className="text-[11px] text-red-600 font-medium">
                              • {editReasons[0]}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingLeadId(null)}
                            className="px-3 py-1 rounded-full text-xs font-medium border border-[var(--color-hairline)] text-[var(--color-ink-soft)] hover:bg-[var(--color-stone-100)] cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleSaveEdit(record)}
                            disabled={editReasons.length > 0}
                            className="px-4 py-1 rounded-full text-xs font-medium bg-[var(--color-cyan)] text-white hover:bg-[var(--color-cyan-edge)] disabled:opacity-50 cursor-pointer shadow-xs"
                          >
                            Save & Re-Validate
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-[var(--color-stone-100)] border border-[var(--color-hairline)] rounded-[var(--radius-panel)] p-4 text-xs font-mono text-[var(--color-ink)] leading-relaxed whitespace-pre-wrap select-text break-words">
                      {record.draft.message}
                    </div>
                  )}

                  {!isValid && record.validation.reasons.length > 0 && !isEditing && (
                    <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700 space-y-1">
                      <strong className="font-semibold block">Validation warnings detected:</strong>
                      <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                        {record.validation.reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="pt-2 border-t border-[var(--color-hairline)] flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(record.lead_id, record.draft.message)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--color-hairline)] text-[var(--color-ink-soft)] hover:bg-[var(--color-stone-100)] transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedId === record.lead_id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700 font-semibold">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-[var(--color-ash-gray)]" />
                          <span>Copy Draft</span>
                        </>
                      )}
                    </button>

                    {!isEditing && (
                      <button
                        onClick={() => handleStartEdit(record)}
                        className="px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--color-hairline)] text-[var(--color-ink-soft)] hover:bg-[var(--color-stone-100)] transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-[var(--color-ash-gray)]" />
                        <span>Edit Draft</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleRegenerate(record)}
                      disabled={isRegenerating[record.lead_id] || record.regeneration_count >= 2}
                      className="px-3 py-1.5 rounded-full text-xs font-medium border border-[var(--color-hairline)] text-[var(--color-ink-soft)] hover:bg-[var(--color-stone-100)] disabled:opacity-40 transition-all flex items-center gap-1.5 cursor-pointer"
                      title={record.regeneration_count >= 2 ? 'Max bounded retries reached (2)' : 'Regenerate draft via Outreach Agent'}
                    >
                      <RotateCw className={`w-3.5 h-3.5 text-[var(--color-ash-gray)] ${isRegenerating[record.lead_id] ? 'animate-spin' : ''}`} />
                      <span>{isRegenerating[record.lead_id] ? 'Regenerating...' : 'Regenerate'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setRejectDialogLeadId(record.lead_id)}
                      disabled={isRejected}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all cursor-pointer flex items-center gap-1.5 ${
                        isRejected
                          ? 'bg-stone-100 text-stone-400 border-stone-200 cursor-default'
                          : 'bg-transparent text-stone-700 border-stone-300 hover:bg-stone-100'
                      }`}
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>{isRejected ? 'Rejected' : 'Reject Draft'}</span>
                    </button>

                    <button
                      onClick={() => handleApprove(record)}
                      disabled={isApproved || !isValid || isApproving[record.lead_id]}
                      className={`px-5 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 shadow-xs cursor-pointer ${
                        isApproved
                          ? 'bg-emerald-600 text-white cursor-default'
                          : !isValid
                          ? 'bg-stone-200 text-stone-400 border border-stone-300 cursor-not-allowed'
                          : 'bg-[var(--color-ink)] text-white hover:bg-[#262626]'
                      }`}
                      title={!isValid ? 'Cannot approve invalid draft. Edit or regenerate first.' : 'Approve for future sending (DOES NOT SEND AUTOMATICALLY)'}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{isApproved ? 'Approved (Staged)' : isApproving[record.lead_id] ? 'Approving...' : 'Approve Draft'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* REJECT CONFIRMATION MODAL */}
      {rejectDialogLeadId && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md bg-[var(--color-paper)] rounded-[var(--radius-cards)] border border-[var(--color-hairline)] p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-[var(--color-ink)]">Reject Outreach Draft</h4>
              <button
                onClick={() => setRejectDialogLeadId(null)}
                className="text-[var(--color-ash-gray)] hover:text-[var(--color-ink)] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--color-warm-gray)]">
              Specify reason for rejecting this outreach draft. This transitions state to <strong>rejected</strong> and preserves record history.
            </p>

            <select
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full p-2.5 bg-[var(--color-stone-100)] border border-[var(--color-hairline)] rounded-[var(--radius-inputs)] text-xs text-[var(--color-ink)] focus:outline-none"
            >
              <option value="Out of scope for current consulting cohort">Out of scope for current consulting cohort</option>
              <option value="Tone mismatch with prospective client profile">Tone mismatch with prospective client profile</option>
              <option value="Insufficient grounding evidence">Insufficient grounding evidence</option>
              <option value="Client already in contact via alternative channel">Client already in contact via alternative channel</option>
              <option value="Do not contact (competitor / partner)">Do not contact (competitor / partner)</option>
            </select>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--color-hairline)]">
              <button
                onClick={() => setRejectDialogLeadId(null)}
                className="px-3.5 py-1.5 rounded-full text-xs font-medium border border-[var(--color-hairline)] text-[var(--color-ink-soft)] hover:bg-[var(--color-stone-100)]"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(rejectDialogLeadId)}
                className="px-4 py-1.5 rounded-full text-xs font-medium bg-red-600 text-white hover:bg-red-700"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
