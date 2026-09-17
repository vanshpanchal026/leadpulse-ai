'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Brain,
  Terminal,
  Play,
  X,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Zap,
  Layers,
  Globe,
  Flame,
  MapPin,
  Send,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RotateCcw,
  Maximize2,
  Minimize2,
  Sliders,
  Filter,
  Activity,
  Cpu,
  RefreshCw,
  Search,
  ExternalLink,
} from 'lucide-react';
import { AgentActivityEvent, SwarmStatus } from '@/lib/agent-telemetry';

interface AgentMissionControlProps {
  isOpen: boolean;
  onClose: () => void;
  onRunSimulation?: () => void;
}

export function AgentMissionControl({
  isOpen,
  onClose,
  onRunSimulation,
}: AgentMissionControlProps) {
  const [events, setEvents] = useState<AgentActivityEvent[]>([]);
  const [swarmStatus, setSwarmStatus] = useState<SwarmStatus>({
    isActive: false,
    activeAgent: null,
    activeSubagents: [],
    totalEventsEmitted: 0,
    currentStage: 'idle',
    startedAt: null,
    lastActiveAt: new Date().toISOString(),
  });

  const [activeFilter, setActiveFilter] = useState<'all' | 'thinking' | 'tools' | 'subagents' | 'decisions'>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({});
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Connect to live SSE stream
  useEffect(() => {
    let es: EventSource | null = null;

    try {
      es = new EventSource('/api/agent/stream');
      eventSourceRef.current = es;

      es.addEventListener('init', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (Array.isArray(payload.events)) {
            setEvents(payload.events);
          }
          if (payload.status) {
            setSwarmStatus(payload.status);
          }
        } catch (err) {
          console.warn('Could not parse SSE init payload:', err);
        }
      });

      es.addEventListener('agent_event', (e: MessageEvent) => {
        try {
          const newEvent: AgentActivityEvent = JSON.parse(e.data);
          setEvents((prev) => {
            const exists = prev.some((item) => item.id === newEvent.id);
            if (exists) return prev;
            return [...prev, newEvent];
          });

          // Automatically expand newest thinking block
          if (newEvent.type === 'thinking') {
            setExpandedThinking((prev) => ({ ...prev, [newEvent.id]: true }));
          }

          // Update swarm status
          setSwarmStatus((prev) => {
            const next = { ...prev, lastActiveAt: newEvent.timestamp };
            if (newEvent.type === 'agent_spawn') {
              next.isActive = true;
              next.activeAgent = newEvent.agentName;
            } else if (newEvent.type === 'subagent_start' && newEvent.subagentName) {
              if (!next.activeSubagents.includes(newEvent.subagentName)) {
                next.activeSubagents = [...next.activeSubagents, newEvent.subagentName];
              }
            } else if (newEvent.type === 'subagent_finish' && newEvent.subagentName) {
              next.activeSubagents = next.activeSubagents.filter((s) => s !== newEvent.subagentName);
            } else if (newEvent.type === 'agent_complete') {
              if (next.activeSubagents.length === 0) {
                next.isActive = false;
                next.activeAgent = null;
              }
            }
            return next;
          });
        } catch (err) {
          console.warn('Could not parse SSE event:', err);
        }
      });

      es.onerror = () => {
        // Fallback polling if SSE is disconnected
        es?.close();
      };
    } catch (e) {
      console.warn('SSE initialization failed:', e);
    }

    return () => {
      es?.close();
    };
  }, []);

  // Polling fallback every 3s to guarantee freshness
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/agent/events');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.events) && data.events.length > events.length) {
            setEvents(data.events);
          }
          if (data.status) {
            setSwarmStatus(data.status);
          }
        }
      } catch {
        // silent polling catch
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [events.length]);

  // Elapsed timer when active
  useEffect(() => {
    if (!swarmStatus.isActive) {
      setElapsedSeconds(0);
      return;
    }

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [swarmStatus.isActive]);

  // Auto-scroll terminal
  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [events, autoScroll]);

  // Filter events
  const filteredEvents = useMemo(() => {
    if (activeFilter === 'all') return events;
    if (activeFilter === 'thinking') return events.filter((e) => e.type === 'thinking' || Boolean(e.thinkingProcess));
    if (activeFilter === 'tools') return events.filter((e) => e.type === 'tool_call' || e.type === 'tool_result');
    if (activeFilter === 'subagents') return events.filter((e) => Boolean(e.subagentName) || e.type.startsWith('subagent_'));
    if (activeFilter === 'decisions') return events.filter((e) => e.type === 'decision' || e.type.startsWith('guardrail_'));
    return events;
  }, [events, activeFilter]);

  // Trigger live simulation
  const handleTriggerSimulation = async () => {
    setIsSimulating(true);
    try {
      await fetch('/api/agent/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'simulate' }),
      });
      onRunSimulation?.();
    } catch (err) {
      console.error('Failed to trigger simulation:', err);
    } finally {
      setTimeout(() => setIsSimulating(false), 2000);
    }
  };

  const handleClearTelemetry = async () => {
    try {
      await fetch('/api/agent/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear' }),
      });
      setEvents([]);
    } catch (err) {
      console.error('Failed to clear telemetry:', err);
    }
  };

  const toggleThinking = (id: string) => {
    setExpandedThinking((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleTool = (id: string) => {
    setExpandedTools((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      {/* Slide-over Drawer Panel */}
      <div className="w-full max-w-3xl h-full bg-[#0E0E10] text-[#E4E4E7] shadow-2xl border-l border-[#27272A] flex flex-col overflow-hidden font-sans">
        
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-[#27272A] bg-[#141418] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={`w-3 h-3 rounded-full ${swarmStatus.isActive ? 'bg-emerald-500 animate-ping' : 'bg-zinc-600'}`} />
              <div className={`absolute inset-0 w-3 h-3 rounded-full ${swarmStatus.isActive ? 'bg-emerald-500' : 'bg-zinc-500'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight text-white font-mono flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-purple-400" />
                  <span>AI AGENT MISSION CONTROL</span>
                </h2>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                  swarmStatus.isActive
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                }`}>
                  {swarmStatus.isActive ? 'SWARM ACTIVE' : 'SWARM IDLE'}
                </span>
                {swarmStatus.isActive && (
                  <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-zinc-500" />
                    {elapsedSeconds}s
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Real-time subagent execution tree, tool telemetry & Claude/Perplexity thinking stream
              </p>
            </div>
          </div>

          {/* Header Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerSimulation}
              disabled={isSimulating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-medium shadow-xs transition-all cursor-pointer disabled:opacity-50"
              title="Trigger realistic multi-agent research swarm simulation"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>{isSimulating ? 'Starting...' : 'Test Live Swarm'}</span>
            </button>
            <button
              onClick={handleClearTelemetry}
              className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              title="Clear Event Log"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Multi-Agent & Subagent Hierarchy Visualizer Strip */}
        <div className="px-6 py-3.5 bg-[#121216] border-b border-[#27272A] shrink-0">
          <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>Multi-Agent Swarm Hierarchy</span>
            </span>
            <span className="text-[10px] text-zinc-400">
              {swarmStatus.activeSubagents.length > 0
                ? `Active Subagents (${swarmStatus.activeSubagents.length})`
                : 'All Subagents Standby'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Stage 1 */}
            <div className={`p-2 rounded-lg border text-xs transition-all ${
              swarmStatus.activeAgent?.includes('Search')
                ? 'bg-purple-950/40 border-purple-500/50 text-purple-200 ring-1 ring-purple-500/30'
                : 'bg-[#18181C] border-[#27272A] text-zinc-400'
            }`}>
              <div className="font-mono font-medium flex items-center justify-between">
                <span>1. Strategist</span>
                <span className="text-[9px]">Query Engine</span>
              </div>
              <div className="text-[10px] text-zinc-400 mt-1 truncate">Delhi Geospatial Queries</div>
            </div>

            {/* Stage 2 */}
            <div className={`p-2 rounded-lg border text-xs transition-all ${
              swarmStatus.activeAgent?.includes('Discovery')
                ? 'bg-blue-950/40 border-blue-500/50 text-blue-200 ring-1 ring-blue-500/30'
                : 'bg-[#18181C] border-[#27272A] text-zinc-400'
            }`}>
              <div className="font-mono font-medium flex items-center justify-between">
                <span>2. Discovery</span>
                <span className="text-[9px]">Apify Tools</span>
              </div>
              <div className="text-[10px] text-zinc-400 mt-1 truncate">Google Maps & Ads Scraper</div>
            </div>

            {/* Stage 3: Subagent Swarm */}
            <div className={`p-2 rounded-lg border text-xs transition-all ${
              swarmStatus.activeSubagents.length > 0 || swarmStatus.activeAgent?.includes('Specialist')
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200 ring-1 ring-emerald-500/30'
                : 'bg-[#18181C] border-[#27272A] text-zinc-400'
            }`}>
              <div className="font-mono font-medium flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  3. Subagent Swarm
                </span>
                <span className="text-[9px]">{swarmStatus.activeSubagents.length} live</span>
              </div>
              <div className="text-[10px] text-zinc-400 mt-1 truncate">Website, Ads & Maps Audits</div>
            </div>

            {/* Stage 4 */}
            <div className={`p-2 rounded-lg border text-xs transition-all ${
              swarmStatus.activeAgent?.includes('Outreach') || swarmStatus.activeAgent?.includes('Analyst')
                ? 'bg-amber-950/40 border-amber-500/50 text-amber-200 ring-1 ring-amber-500/30'
                : 'bg-[#18181C] border-[#27272A] text-zinc-400'
            }`}>
              <div className="font-mono font-medium flex items-center justify-between">
                <span>4. Pitch & Guard</span>
                <span className="text-[9px]">Vansh 7 Rules</span>
              </div>
              <div className="text-[10px] text-zinc-400 mt-1 truncate">Zero Hallucination Audit</div>
            </div>
          </div>

          {/* Active Subagents Badges */}
          {swarmStatus.activeSubagents.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
              <span className="text-[10px] font-mono text-emerald-400 uppercase mr-1">Active Subagents:</span>
              {swarmStatus.activeSubagents.map((sub) => (
                <span
                  key={sub}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/30"
                >
                  <Cpu className="w-2.5 h-2.5 animate-spin" />
                  <span>{sub}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Filter Bar & Controls */}
        <div className="px-6 py-2.5 border-b border-[#27272A] bg-[#141418] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1">
            {[
              { id: 'all', label: `All Activity (${events.length})` },
              { id: 'thinking', label: 'Thinking Stream', icon: Brain },
              { id: 'tools', label: 'Tool Calls', icon: Terminal },
              { id: 'subagents', label: 'Subagents', icon: Cpu },
              { id: 'decisions', label: 'Decisions', icon: CheckCircle2 },
            ].map((f) => {
              const isSel = activeFilter === f.id;
              const Icon = f.icon;
              return (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id as any)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                    isSel
                      ? 'bg-zinc-800 text-white font-semibold shadow-2xs border border-zinc-700'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
                >
                  {Icon && <Icon className="w-3 h-3 text-purple-400" />}
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>

          <label className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded border-zinc-700 text-purple-600 focus:ring-0 w-3 h-3 bg-zinc-800"
            />
            <span>Auto-scroll</span>
          </label>
        </div>

        {/* Main Real-Time Event Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 font-mono text-xs">
          {filteredEvents.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-zinc-500">
              <Brain className="w-10 h-10 text-zinc-600 mb-3 animate-pulse" />
              <p className="text-sm font-medium text-zinc-300">No agent actions recorded yet</p>
              <p className="text-xs text-zinc-500 max-w-sm mt-1">
                Click <span className="text-purple-400 font-semibold">Test Live Swarm</span> above or run a Quick Scraper to watch the AI agents formulate queries, audit websites, and draft pitches in real-time.
              </p>
            </div>
          ) : (
            filteredEvents.map((evt) => {
              const isThinking = evt.type === 'thinking';
              const isToolCall = evt.type === 'tool_call';
              const isToolResult = evt.type === 'tool_result';
              const isDecision = evt.type === 'decision';
              const isSubagent = evt.type.startsWith('subagent_');
              const isGuardrail = evt.type.startsWith('guardrail_');

              const isThinkingOpen = expandedThinking[evt.id] ?? false;
              const isToolOpen = expandedTools[evt.id] ?? false;

              return (
                <div
                  key={evt.id}
                  className={`rounded-xl border p-4 transition-all ${
                    isThinking
                      ? 'bg-purple-950/15 border-purple-900/40 text-purple-100'
                      : isToolCall
                        ? 'bg-zinc-900/60 border-zinc-800 text-zinc-200'
                        : isToolResult
                          ? 'bg-blue-950/20 border-blue-900/40 text-blue-100'
                          : isDecision
                            ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-100'
                            : isGuardrail
                              ? 'bg-amber-950/20 border-amber-900/40 text-amber-100'
                              : 'bg-[#151518] border-[#27272A] text-zinc-300'
                  }`}
                >
                  {/* Event Header */}
                  <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <div className="flex items-center gap-2">
                      {/* Agent Badge */}
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold tracking-wide bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {evt.agentName}
                      </span>

                      {/* Subagent Tag */}
                      {evt.subagentName && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 flex items-center gap-1">
                          <Cpu className="w-2.5 h-2.5" />
                          <span>Subagent: {evt.subagentName}</span>
                        </span>
                      )}

                      {/* Event Type Badge */}
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                        isThinking
                          ? 'bg-purple-500/20 text-purple-300'
                          : isToolCall
                            ? 'bg-cyan-500/20 text-cyan-300'
                            : isToolResult
                              ? 'bg-blue-500/20 text-blue-300'
                              : isDecision
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : isGuardrail
                                  ? 'bg-amber-500/20 text-amber-300'
                                  : 'bg-zinc-700 text-zinc-300'
                      }`}>
                        {evt.type.replace('_', ' ')}
                      </span>
                    </div>

                    <span className="text-[10px] text-zinc-500">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  {/* Title & Core Content */}
                  <div className="font-semibold text-xs text-white mb-1">{evt.title}</div>
                  <div className="text-zinc-300 text-xs leading-relaxed font-sans">{evt.content}</div>

                  {/* Perplexity/Claude-Style Thinking Block */}
                  {evt.thinkingProcess && (
                    <div className="mt-3 pt-2.5 border-t border-purple-900/30">
                      <button
                        onClick={() => toggleThinking(evt.id)}
                        className="flex items-center gap-1.5 text-[11px] font-mono text-purple-400 hover:text-purple-300 transition-colors cursor-pointer w-full text-left"
                      >
                        <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                        <span className="font-medium">
                          {isThinkingOpen ? 'Hide Internal Reasoning Chain' : 'View Extended Thinking Process (Claude/Perplexity Stream)'}
                        </span>
                        {isThinkingOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      </button>

                      {isThinkingOpen && (
                        <div className="mt-2 p-3 rounded-lg bg-[#0A0A0C] border border-purple-900/40 text-purple-200/90 text-[11px] leading-relaxed font-mono whitespace-pre-wrap animate-in fade-in duration-150">
                          {evt.thinkingProcess}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tool Call / Tool Result Inspect Block */}
                  {(evt.toolArgs || evt.toolResult) && (
                    <div className="mt-2.5 pt-2 border-t border-zinc-800">
                      <button
                        onClick={() => toggleTool(evt.id)}
                        className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                      >
                        <Terminal className="w-3 h-3" />
                        <span>{isToolOpen ? 'Hide Payload' : `Inspect Tool Payload (${evt.toolName || 'tool'})`}</span>
                        {evt.durationMs && (
                          <span className="text-zinc-500 font-mono">[{evt.durationMs}ms]</span>
                        )}
                        {isToolOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      </button>

                      {isToolOpen && (
                        <div className="mt-2 p-3 rounded-lg bg-[#08080A] border border-zinc-800 text-[10px] font-mono text-zinc-300 overflow-x-auto max-h-48">
                          {evt.toolArgs && (
                            <div className="mb-2">
                              <span className="text-cyan-400 font-semibold block mb-1">Arguments:</span>
                              <pre className="text-zinc-400">{JSON.stringify(evt.toolArgs, null, 2)}</pre>
                            </div>
                          )}
                          {evt.toolResult && (
                            <div>
                              <span className="text-blue-400 font-semibold block mb-1">Return Result:</span>
                              <pre className="text-zinc-400">{JSON.stringify(evt.toolResult, null, 2)}</pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={terminalEndRef} />
        </div>

        {/* Footer Status Bar */}
        <div className="px-6 py-3 border-t border-[#27272A] bg-[#141418] flex items-center justify-between text-xs font-mono text-zinc-400 shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${swarmStatus.isActive ? 'bg-emerald-400 animate-ping' : 'bg-zinc-600'}`} />
              <span className="text-zinc-300">{swarmStatus.isActive ? 'Executing Swarm...' : 'Ready for Ingestion'}</span>
            </span>
            <span>•</span>
            <span>Events Emitted: {events.length}</span>
          </div>
          <div className="text-[11px] text-zinc-500">
            LeadPulse AI Autonomous Agent Architecture
          </div>
        </div>

      </div>
    </div>
  );
}

/**
 * Sleek floating status trigger pill placed in bottom corner or header.
 */
export function AgentSwarmStatusPill({
  onClick,
}: {
  onClick: () => void;
}) {
  const [isActive, setIsActive] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/agent/events');
        if (res.ok) {
          const data = await res.json();
          if (data.status) {
            setIsActive(Boolean(data.status.isActive));
            setActiveAgent(data.status.activeAgent || (data.status.activeSubagents?.length ? data.status.activeSubagents[0] : null));
          }
        }
      } catch {
        // silent
      }
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <button
      onClick={onClick}
      className={`group px-3 py-1.5 rounded-full text-xs font-mono font-medium transition-all cursor-pointer flex items-center gap-2 border shadow-sm ${
        isActive
          ? 'bg-purple-950 text-purple-200 border-purple-500/50 hover:bg-purple-900 ring-2 ring-purple-500/20'
          : 'bg-[#18181C] text-zinc-300 border-zinc-700 hover:border-zinc-500 hover:text-white'
      }`}
      title="Open Real-Time AI Agent Mission Control"
    >
      <div className="relative">
        <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400 animate-ping' : 'bg-zinc-500'}`} />
        <div className={`absolute inset-0 w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400' : 'bg-zinc-400'}`} />
      </div>
      <span className="flex items-center gap-1.5">
        <Brain className={`w-3.5 h-3.5 ${isActive ? 'text-purple-400 animate-pulse' : 'text-zinc-400'}`} />
        <span>{isActive ? `Swarm: ${activeAgent || 'Active'}` : 'Agent Mission Control'}</span>
      </span>
      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400 group-hover:text-white">
        Live
      </span>
    </button>
  );
}
