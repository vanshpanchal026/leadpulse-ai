'use client';

import React from 'react';
import { ExternalLink, ArrowUp, DollarSign, Send, Eye } from 'lucide-react';
import { Lead, PipelineStage } from '@/lib/types';

interface LeadTableViewProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  onStageChange: (leadId: string, stage: PipelineStage) => void;
}

const STAGES: { key: PipelineStage; label: string }[] = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'qualified', label: 'Qualified' },
  { key: 'outreach', label: 'Outreach' },
  { key: 'converted', label: 'Converted' },
];

export const LeadTableView: React.FC<LeadTableViewProps> = ({
  leads,
  onSelectLead,
  onStageChange,
}) => {
  if (leads.length === 0) {
    return (
      <div className="bg-[#ffffff] p-12 text-center rounded-[24px] border border-[#e5e5e5] shadow-xs text-sm text-[#737373]">
        No leads match the active filters.
      </div>
    );
  }

  return (
    <div className="bg-[#ffffff] rounded-[24px] border border-[#e5e5e5] shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-[#e5e5e5] bg-[#fafafa] text-[#737373] font-semibold uppercase tracking-wider text-[11px]">
              <th className="py-3.5 px-4">Intent</th>
              <th className="py-3.5 px-4">Subreddit</th>
              <th className="py-3.5 px-4 min-w-[320px]">Title & Requirements</th>
              <th className="py-3.5 px-4">Budget</th>
              <th className="py-3.5 px-4">Direct Channels</th>
              <th className="py-3.5 px-4 text-center">Score</th>
              <th className="py-3.5 px-4">Stage</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e5e5]">
            {leads.map((lead) => {
              const isHiring = lead.intent === 'HIRING';
              const isForHire = lead.intent === 'FOR_HIRE';

              return (
                <tr
                  key={lead.id}
                  onClick={() => onSelectLead(lead)}
                  className="hover:bg-[#fafafa] transition-colors cursor-pointer group"
                >
                  {/* Intent */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                        isHiring
                          ? 'bg-red-50 text-red-600 border border-red-200'
                          : isForHire
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-[#f5f5f5] text-[#737373] border border-[#e5e5e5]'
                      }`}
                    >
                      {lead.intent.replace('_', ' ')}
                    </span>
                  </td>

                  {/* Subreddit */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#f5f5f5] border border-[#e5e5e5] text-[#0a0a0a]">
                      r/{lead.subreddit}
                    </span>
                  </td>

                  {/* Title & Preview */}
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-[#0a0a0a] group-hover:underline line-clamp-1">
                      {lead.title}
                    </div>
                    <div className="text-[11px] text-[#737373] line-clamp-1 mt-0.5">
                      {lead.body_text || 'No description provided'}
                    </div>
                  </td>

                  {/* Budget */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {lead.budget_signals !== 'N/A' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#f5f5f5] border border-[#e5e5e5] text-[#0a0a0a]">
                        <DollarSign className="w-3 h-3 text-emerald-600" />
                        <span>{lead.budget_signals}</span>
                      </span>
                    ) : (
                      <span className="text-[#737373]">—</span>
                    )}
                  </td>

                  {/* Contacts */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {lead.contacts !== 'None' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#f5f5f5] border border-[#e5e5e5] text-[#0a0a0a]">
                        <Send className="w-3 h-3 text-blue-600" />
                        <span className="truncate max-w-[140px]">{lead.contacts.split(';')[0]}</span>
                      </span>
                    ) : (
                      <span className="text-[#737373]">—</span>
                    )}
                  </td>

                  {/* Score */}
                  <td className="py-3.5 px-4 text-center whitespace-nowrap font-medium text-[#0a0a0a]">
                    <div className="inline-flex items-center gap-0.5 text-[#737373]">
                      <ArrowUp className="w-3 h-3 text-[#0a0a0a]" />
                      <span className="font-semibold text-[#0a0a0a]">{lead.score}</span>
                    </div>
                  </td>

                  {/* Stage select */}
                  <td className="py-3.5 px-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <select
                      value={lead.stage}
                      onChange={(e) => onStageChange(lead.id, e.target.value as PipelineStage)}
                      className="bg-[#fafafa] border border-[#e5e5e5] rounded-[18px] px-3 py-1 text-[11px] font-medium text-[#0a0a0a] focus:outline-none focus:ring-2 focus:ring-[#0a0a0a]/5 cursor-pointer hover:border-[#0a0a0a] transition-colors"
                    >
                      {STAGES.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onSelectLead(lead)}
                        title="View Details & Outreach"
                        className="p-1.5 rounded-full text-[#737373] hover:text-[#0a0a0a] hover:bg-[#f5f5f5] transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <a
                        href={lead.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Open Reddit thread"
                        className="p-1.5 rounded-full text-[#737373] hover:text-[#0a0a0a] hover:bg-[#f5f5f5] transition-colors cursor-pointer"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
