'use client';

import React, { useState } from 'react';
import { 
  X, 
  ExternalLink, 
  Copy, 
  Check, 
  Send, 
  Sparkles, 
  DollarSign, 
  Calendar, 
  ArrowUp,
  FileText
} from 'lucide-react';
import { Lead, PipelineStage } from '@/lib/types';

interface LeadDetailDrawerProps {
  lead: Lead | null;
  onClose: () => void;
  onStageChange: (leadId: string, stage: PipelineStage) => void;
  onUpdateNotes: (leadId: string, notes: string) => void;
}

export const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({
  lead,
  onClose,
  onStageChange,
  onUpdateNotes,
}) => {
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [pitchStyle, setPitchStyle] = useState<'technical' | 'value' | 'concise'>('technical');
  const [notes, setNotes] = useState<string>('');

  React.useEffect(() => {
    if (lead) {
      setNotes(lead.notes || '');
    }
  }, [lead]);

  if (!lead) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleSaveNotes = () => {
    onUpdateNotes(lead.id, notes);
  };

  const generatePitch = () => {
    const text = `${lead.title} ${lead.body_text}`.toLowerCase();
    const isBot = text.includes('chatbot') || text.includes('bot') || text.includes('whatsapp');
    const isAuto = text.includes('automation') || text.includes('automate') || text.includes('n8n');
    const isWeb = text.includes('web') || text.includes('react') || text.includes('next');

    let techDomain = 'automation & custom workflow development';
    if (isBot) techDomain = 'AI conversational agents and WhatsApp automation';
    else if (isAuto) techDomain = 'n8n workflow architecture and end-to-end automations';
    else if (isWeb) techDomain = 'modern Next.js and custom full-stack solutions';

    if (pitchStyle === 'technical') {
      return `Hi there, saw your post on r/${lead.subreddit} regarding ${lead.title.replace(/\[.*?\]/g, '').trim().slice(0, 50)}...\n\nI specialize in ${techDomain}. I have architected similar systems using residential proxy flows, webhook integrations, and clean fault-tolerant pipelines.\n\nWould you be open to a quick 5-min sync or chatting here to explore architecture options?`;
    } else if (pitchStyle === 'value') {
      return `Hi, I noticed your post on r/${lead.subreddit} and wanted to reach out.\n\nI help businesses solve this exact problem in ${techDomain}—eliminating manual bottlenecks and delivering reliable systems with zero maintenance headaches.\n\nHappy to share a quick Loom breakdown or example workflows if helpful for your timeline!`;
    } else {
      return `Hey! Just saw your post on r/${lead.subreddit} about ${lead.title.replace(/\[.*?\]/g, '').trim().slice(0, 40)}. I work directly with ${techDomain}. Let me know if you're still looking for help and we can connect!`;
    }
  };

  const currentPitch = generatePitch();

  return (
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div
        className="w-full max-w-2xl bg-[#ffffff] h-full border-l border-[#e5e5e5] shadow-2xl flex flex-col justify-between overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="sticky top-0 z-10 bg-[#ffffff]/95 backdrop-blur-md px-6 py-4 border-b border-[#e5e5e5] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Subreddit pill tag */}
            <span className="px-3 py-1 rounded-full text-xs font-medium bg-[#f5f5f5] border border-[#e5e5e5] text-[#0a0a0a]">
              r/{lead.subreddit}
            </span>
            {/* Intent pill */}
            <span className={`px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
              lead.intent === 'HIRING'
                ? 'bg-red-50 text-red-600 border border-red-200'
                : lead.intent === 'FOR_HIRE'
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-[#f5f5f5] text-[#737373] border border-[#e5e5e5]'
            }`}>
              {lead.intent.replace('_', ' ')}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Stage Selector */}
            <select
              value={lead.stage}
              onChange={(e) => onStageChange(lead.id, e.target.value as PipelineStage)}
              className="bg-[#fafafa] border border-[#e5e5e5] rounded-[18px] px-3.5 py-1.5 text-xs font-medium text-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/5 cursor-pointer hover:border-[#0a0a0a] transition-colors"
            >
              <option value="inbox">Stage: Inbox</option>
              <option value="qualified">Stage: Qualified</option>
              <option value="outreach">Stage: Outreach</option>
              <option value="converted">Stage: Converted</option>
            </select>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-2 rounded-full text-[#737373] hover:text-[#0a0a0a] hover:bg-[#f5f5f5] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 flex-1">
          {/* Title & Metadata */}
          <div>
            <h2 className="text-xl font-bold text-[#0a0a0a] tracking-tight leading-snug">
              {lead.title}
            </h2>

            <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-[#737373]">
              <span className="flex items-center gap-1">
                <ArrowUp className="w-3.5 h-3.5 text-[#0a0a0a]" />
                <span className="font-semibold text-[#0a0a0a]">{lead.score}</span> upvotes
              </span>
              <span>•</span>
              <span className="px-2 py-0.5 rounded-full bg-[#f5f5f5] border border-[#e5e5e5] text-[#0a0a0a] font-medium text-[11px]">
                #{lead.keyword_matched}
              </span>
              <span>•</span>
              <a
                href={lead.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#0a0a0a] hover:underline font-semibold"
              >
                <span>Reddit Thread</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Quick Signals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Budget */}
            <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-[18px] p-4">
              <span className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider block mb-1">
                Budget Signal
              </span>
              <div className="flex items-center gap-2 text-sm font-semibold text-[#0a0a0a]">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                <span>{lead.budget_signals !== 'N/A' ? lead.budget_signals : 'No explicit budget listed'}</span>
              </div>
            </div>

            {/* Contacts */}
            <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-[18px] p-4">
              <span className="text-[11px] font-semibold text-[#737373] uppercase tracking-wider block mb-1">
                Direct Channels
              </span>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0a0a0a] truncate">
                <Send className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="truncate">{lead.contacts !== 'None' ? lead.contacts : 'Reddit DM / Post comment'}</span>
              </div>
            </div>
          </div>

          {/* Full Post Body */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-[#0a0a0a] uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#737373]" />
              Original Submission Body
            </span>
            <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-[18px] p-5 text-xs text-[#171717] leading-relaxed whitespace-pre-wrap font-sans max-h-72 overflow-y-auto select-text">
              {lead.body_text || 'No description provided in Reddit post.'}
            </div>
          </div>

          {/* Outreach Generator */}
          <div className="bg-[#ffffff] border border-[#e5e5e5] rounded-[24px] p-5 space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-[#0a0a0a] tracking-tight">
                    Instant Outreach Assistant
                  </h4>
                  <p className="text-[11px] text-[#737373]">
                    Tailored message referencing lead signals
                  </p>
                </div>
              </div>

              {/* Style selector — pill tags */}
              <div className="flex items-center gap-1">
                {(['technical', 'value', 'concise'] as const).map((style) => (
                  <button
                    key={style}
                    onClick={() => setPitchStyle(style)}
                    className={`px-3 py-1 rounded-full text-[11px] font-medium capitalize transition-all cursor-pointer border ${
                      pitchStyle === style
                        ? 'bg-[#0a0a0a] text-white border-[#0a0a0a] shadow-xs'
                        : 'bg-[#fafafa] text-[#737373] border-[#e5e5e5] hover:border-[#0a0a0a] hover:text-[#0a0a0a]'
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            {/* Generated pitch preview box */}
            <div className="bg-[#fafafa] border border-[#e5e5e5] rounded-[18px] p-4 text-xs text-[#0a0a0a] leading-relaxed select-text font-mono">
              {currentPitch}
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => handleCopy(currentPitch, 'pitch')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-[18px] text-xs font-medium bg-[#0a0a0a] hover:bg-[#171717] text-white transition-all cursor-pointer shadow-xs"
              >
                {copiedText === 'pitch' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Proposal</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Internal Notes */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-[#0a0a0a] uppercase tracking-wider">
              Internal Pipeline Notes
            </span>
            <div className="flex gap-2">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Log notes, client responses, rate quoted, follow-up dates..."
                rows={2}
                className="flex-1 bg-[#fafafa] border border-[#e5e5e5] rounded-[18px] p-3 text-xs text-[#0a0a0a] placeholder-[#737373] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/5 focus:border-[#0a0a0a] transition-all resize-none"
              />
              <button
                onClick={handleSaveNotes}
                className="self-end px-4 py-2 rounded-[18px] text-xs font-medium bg-[#0a0a0a] hover:bg-[#171717] text-white transition-all cursor-pointer shadow-xs"
              >
                Save
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 px-6 border-t border-[#e5e5e5] bg-[#fafafa] flex items-center justify-between">
          <button
            onClick={() => onStageChange(lead.id, 'outreach')}
            className="px-4 py-2 rounded-[18px] text-xs font-medium bg-[#ffffff] hover:bg-[#f5f5f5] text-[#0a0a0a] border border-[#e5e5e5] hover:border-[#0a0a0a] transition-all cursor-pointer shadow-xs"
          >
            Mark Outreach Sent
          </button>

          <a
            href={lead.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-[18px] text-xs font-medium bg-[#0a0a0a] hover:bg-[#171717] text-white transition-all cursor-pointer shadow-xs"
          >
            <span>Open Reddit Thread</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
