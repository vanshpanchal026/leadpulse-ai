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
  Activity,
  Cpu,
  RefreshCw,
  Search,
  ExternalLink,
} from 'lucide-react';

export type AgentRole =
  | 'search_strategist'
  | 'discovery_scraper'
  | 'lead_triage'
  | 'specialist_swarm'
  | 'website_auditor'
  | 'ads_inspector'
  | 'maps_evaluator'
  | 'opportunity_analyst'
  | 'outreach_copywriter'
  | 'guardrail_validator';

export type EventType =
  | 'agent_spawn'
  | 'subagent_start'
  | 'subagent_finish'
  | 'thinking'
  | 'tool_call'
  | 'tool_result'
  | 'decision'
  | 'guardrail_pass'
  | 'guardrail_flag'
  | 'agent_complete'
  | 'error';

export interface AgentActivityEvent {
  id: string;
  timestamp: string;
  agentName: string;
  agentRole: AgentRole;
  parentAgent?: string;
  subagentName?: string;
  type: EventType;
  title: string;
  content: string;
  thinkingProcess?: string;
  toolName?: string;
  toolArgs?: Record<string, any>;
  toolResult?: any;
  durationMs?: number;
  metadata?: Record<string, any>;
}

export interface SwarmStatus {
  isActive: boolean;
  activeAgent: string | null;
  activeSubagents: string[];
  totalEventsEmitted: number;
  currentStage: string;
  startedAt: string | null;
  lastActiveAt: string;
}

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

  // Connect to SSE stream
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

          if (newEvent.type === 'thinking') {
            setExpandedThinking((prev) => ({ ...prev, [newEvent.id]: true }));
          }

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
        es?.close();
      };
    } catch (e) {
      console.warn('SSE initialization failed:', e);
    }

    return () => {
      es?.close();
    };
  }, []);

  // Polling fallback every 3s
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

  // Auto-scroll
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
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      {/* Slide-over Drawer Panel */}
      <div className="w-full max-w-3xl h-full bg-card text-foreground shadow-2xl border-l border-border flex flex-col overflow-hidden font-sans">
        
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-border bg-card flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className={`w-3 h-3 rounded-full ${swarmStatus.isActive ? 'bg-[hsl(var(--success-fg))] animate-ping' : 'bg-muted-foreground'}`} />
              <div className={`absolute inset-0 w-3 h-3 rounded-full ${swarmStatus.isActive ? 'bg-[hsl(var(--success-fg))]' : 'bg-muted-foreground'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold tracking-tight text-foreground font-mono flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-primary" />
                  <span>AI AGENT MISSION CONTROL</span>
                </h2>
                <span className={`text-[10px] px-2 py-0.5 rounded-md font-mono font-medium ${
                  swarmStatus.isActive
                    ? 'bg-[hsl(var(--success-bg))] text-[hsl(var(--success-fg))] border border-[hsl(var(--success-border))]'
                    : 'bg-muted/40 text-muted-foreground border border-border'
                }`}>
                  {swarmStatus.isActive ? 'SWARM ACTIVE' : 'SWARM IDLE'}
                </span>
                {swarmStatus.isActive && (
                  <span className="text-[10px] font-mono text-muted-foreground flex items-center gap-1 tabular-nums">
                    <Clock className="w-3 h-3 text-muted-foreground" />
                    {elapsedSeconds}s
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Real-time subagents tree, tool execution telemetry & Claude/Perplexity thinking stream
              </p>
            </div>
          </div>

          {/* Header Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleTriggerSimulation}
              disabled={isSimulating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              title="Run multi-agent swarm simulation"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>{isSimulating ? 'Starting...' : 'Test Live Swarm'}</span>
            </button>
            <button
              onClick={handleClearTelemetry}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              title="Clear Trace"
              aria-label="Clear Trace"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-label="Close Mission Control"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Multi-Agent & Subagent Hierarchy Visualizer Strip */}
        <div className="px-6 py-3.5 bg-muted/20 border-b border-border shrink-0">
          <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary" />
              <span>Multi-Agent Swarm Hierarchy</span>
            </span>
            <span className="text-[10px] text-muted-foreground">
              {swarmStatus.activeSubagents.length > 0
                ? `Active Subagents (${swarmStatus.activeSubagents.length})`
                : 'All Subagents Standby'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Stage 1 */}
            <div className={`p-2 rounded-md border text-xs transition-colors ${
              swarmStatus.activeAgent?.includes('Search')
                ? 'bg-primary/10 border-primary/40 text-primary ring-1 ring-primary/20'
                : 'bg-card/60 border-border/80 text-muted-foreground'
            }`}>
              <div className="font-mono font-medium flex items-center justify-between">
                <span>1. Strategist</span>
                <span className="text-[9px]">Query Engine</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1 truncate">Delhi Geospatial Queries</div>
            </div>

            {/* Stage 2 */}
            <div className={`p-2 rounded-md border text-xs transition-colors ${
              swarmStatus.activeAgent?.includes('Discovery')
                ? 'bg-primary/10 border-primary/40 text-primary ring-1 ring-primary/20'
                : 'bg-card/60 border-border/80 text-muted-foreground'
            }`}>
              <div className="font-mono font-medium flex items-center justify-between">
                <span>2. Discovery</span>
                <span className="text-[9px]">Apify Tools</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1 truncate">Google Maps & Ads Scraper</div>
            </div>

            {/* Stage 3: Subagent Swarm */}
            <div className={`p-2 rounded-md border text-xs transition-colors ${
              swarmStatus.activeSubagents.length > 0 || swarmStatus.activeAgent?.includes('Specialist')
                ? 'bg-primary/10 border-primary/40 text-primary ring-1 ring-primary/20'
                : 'bg-card/60 border-border/80 text-muted-foreground'
            }`}>
              <div className="font-mono font-medium flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                  3. Subagents Swarm
                </span>
                <span className="text-[9px] tabular-nums">{swarmStatus.activeSubagents.length} live</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1 truncate">Website, Ads & Maps Audits</div>
            </div>

            {/* Stage 4 */}
            <div className={`p-2 rounded-md border text-xs transition-colors ${
              swarmStatus.activeAgent?.includes('Outreach') || swarmStatus.activeAgent?.includes('Analyst')
                ? 'bg-primary/10 border-primary/40 text-primary ring-1 ring-primary/20'
                : 'bg-card/60 border-border/80 text-muted-foreground'
            }`}>
              <div className="font-mono font-medium flex items-center justify-between">
                <span>4. Pitch & Guard</span>
                <span className="text-[9px]">Vansh 7 Rules</span>
              </div>
              <div className="text-[10px] text-muted-foreground mt-1 truncate">Zero Hallucination Audit</div>
            </div>
          </div>

          {/* Active Subagents Badges */}
          {swarmStatus.activeSubagents.length > 0 && (
            <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
              <span className="text-[10px] font-mono text-muted-foreground uppercase mr-1">Active Subagents:</span>
              {swarmStatus.activeSubagents.map((sub) => (
                <span
                  key={sub}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono bg-primary/10 text-primary border border-primary/20"
                >
                  <Cpu className="w-2.5 h-2.5 animate-spin" />
                  <span>{sub}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Filter Bar */}
        <div className="px-6 py-2.5 border-b border-border bg-card flex items-center justify-between gap-2 shrink-0">
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
                  className={`px-2.5 py-1 rounded-md text-[11px] font-mono transition-colors cursor-pointer flex items-center gap-1.5 ${
                    isSel
                      ? 'bg-primary text-primary-foreground font-medium shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  {Icon && <Icon className="w-3 h-3 text-current" />}
                  <span>{f.label}</span>
                </button>
              );
            })}
          </div>

          <label className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded border-input text-primary focus-visible:ring-1 focus-visible:ring-primary w-3.5 h-3.5 bg-background"
            />
            <span>Auto-scroll</span>
          </label>
        </div>

        {/* Event Feed */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 font-mono text-xs">
          {filteredEvents.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
              <Brain className="w-10 h-10 text-muted-foreground/50 mb-3 animate-pulse" />
              <p className="text-sm font-medium text-foreground">No agent actions recorded yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Click <span className="text-primary font-medium">Test Live Swarm</span> above to watch the AI agents formulate queries, audit websites, and draft pitches in real-time.
              </p>
            </div>
          ) : (
            filteredEvents.map((evt) => {
              const isThinking = evt.type === 'thinking';
              const isToolCall = evt.type === 'tool_call';
              const isToolResult = evt.type === 'tool_result';
              const isDecision = evt.type === 'decision';
              const isGuardrail = evt.type.startsWith('guardrail_');

              const isThinkingOpen = expandedThinking[evt.id] ?? false;
              const isToolOpen = expandedTools[evt.id] ?? false;

              return (
                <div
                  key={evt.id}
                  className={`rounded-md border p-3.5 transition-colors ${
                    isThinking
                      ? 'bg-primary/5 border-primary/30 text-foreground'
                      : isToolCall
                        ? 'bg-card/80 border-border/80 text-foreground'
                        : isToolResult
                          ? 'bg-muted/30 border-border/80 text-foreground'
                          : isDecision
                            ? 'bg-[hsl(var(--success-bg))] border-[hsl(var(--success-border))] text-foreground'
                            : isGuardrail
                              ? 'bg-[hsl(var(--warning-bg))] border-[hsl(var(--warning-border))] text-foreground'
                              : 'bg-card/60 border-border/80 text-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-medium tracking-wide bg-muted text-foreground border border-border/80">
                        {evt.agentName}
                      </span>

                      {evt.subagentName && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                          <Cpu className="w-2.5 h-2.5" />
                          <span>Subagent: {evt.subagentName}</span>
                        </span>
                      )}

                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-medium uppercase tracking-wider ${
                        isThinking
                          ? 'bg-primary/15 text-primary'
                          : isToolCall
                            ? 'bg-muted text-muted-foreground'
                            : isToolResult
                              ? 'bg-muted text-muted-foreground'
                              : isDecision
                                ? 'bg-[hsl(var(--success-bg))] text-[hsl(var(--success-fg))]'
                                : isGuardrail
                                  ? 'bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning-fg))]'
                                  : 'bg-muted text-muted-foreground'
                      }`}>
                        {evt.type.replace('_', ' ')}
                      </span>
                    </div>

                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="font-medium text-xs text-foreground mb-1">{evt.title}</div>
                  <div className="text-muted-foreground text-xs leading-relaxed font-sans">{evt.content}</div>

                  {/* Thinking Process Block */}
                  {evt.thinkingProcess && (
                    <div className="mt-3 pt-2.5 border-t border-border/60">
                      <button
                        onClick={() => toggleThinking(evt.id)}
                        className="flex items-center gap-1.5 text-[11px] font-mono text-primary hover:text-primary/80 transition-colors cursor-pointer w-full text-left"
                      >
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <span className="font-medium">
                          {isThinkingOpen ? 'Hide Internal Reasoning Chain' : 'View Extended Thinking Process (Claude/Perplexity Stream)'}
                        </span>
                        {isThinkingOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      </button>

                      {isThinkingOpen && (
                        <div className="mt-2 p-3 rounded-md bg-muted/40 border border-border/80 text-foreground text-[11px] leading-relaxed font-mono whitespace-pre-wrap animate-in fade-in duration-150">
                          {evt.thinkingProcess}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tool Arguments / Result Block */}
                  {(evt.toolArgs || evt.toolResult) && (
                    <div className="mt-2.5 pt-2 border-t border-border/60">
                      <button
                        onClick={() => toggleTool(evt.id)}
                        className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                      >
                        <Terminal className="w-3 h-3" />
                        <span>{isToolOpen ? 'Hide Payload' : `Inspect Tool Payload (${evt.toolName || 'tool'})`}</span>
                        {evt.durationMs && (
                          <span className="text-muted-foreground font-mono tabular-nums">[{evt.durationMs}ms]</span>
                        )}
                        {isToolOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      </button>

                      {isToolOpen && (
                        <div className="mt-2 p-3 rounded-md bg-muted/40 border border-border/80 text-[10px] font-mono text-foreground overflow-x-auto max-h-48">
                          {evt.toolArgs && (
                            <div className="mb-2">
                              <span className="text-primary font-medium block mb-1">Arguments:</span>
                              <pre className="text-muted-foreground">{JSON.stringify(evt.toolArgs, null, 2)}</pre>
                            </div>
                          )}
                          {evt.toolResult && (
                            <div>
                              <span className="text-primary font-medium block mb-1">Return Result:</span>
                              <pre className="text-muted-foreground">{JSON.stringify(evt.toolResult, null, 2)}</pre>
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

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-card flex items-center justify-between text-xs font-mono text-muted-foreground shrink-0">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${swarmStatus.isActive ? 'bg-[hsl(var(--success-fg))] animate-ping' : 'bg-muted-foreground'}`} />
              <span className="text-foreground">{swarmStatus.isActive ? 'Executing Swarm...' : 'Ready'}</span>
            </span>
            <span>•</span>
            <span className="tabular-nums">Events Emitted: {events.length}</span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            LeadPulse AI Autonomous Agent Swarm
          </div>
        </div>

      </div>
    </div>
  );
}

/**
 * Header status pill for app shell in Vite client.
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
      className={`px-2 py-0.5 rounded-[4px] text-[11px] font-medium transition-colors duration-150 cursor-pointer flex items-center gap-1.5 border ${
        isActive
          ? 'bg-[hsl(var(--info-bg))] border-[hsl(var(--info-border))] text-[hsl(var(--info-fg))]'
          : 'bg-secondary text-muted-foreground border-border hover:text-foreground'
      }`}
      title="Open Real-Time AI Agent Mission Control"
      aria-label="Open Real-Time AI Agent Mission Control"
    >
      <div className="relative flex items-center justify-center">
        <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[hsl(var(--success))] motion-safe:animate-ping' : 'bg-muted-foreground'}`} />
        <div className={`absolute inset-0 w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[hsl(var(--success))]' : 'bg-muted-foreground'}`} />
      </div>
      <span className="flex items-center gap-1">
        <Brain className={`w-3 h-3 ${isActive ? 'text-[hsl(var(--primary))]' : 'text-muted-foreground'}`} />
        <span className="truncate max-w-[140px]">{isActive ? `Swarm: ${activeAgent || 'Active'}` : 'Agent Mission Control'}</span>
      </span>
      <span className="text-[10px] px-1 py-0.2 rounded bg-[hsl(var(--info-bg))] text-[hsl(var(--info-fg))] font-medium">
        LIVE
      </span>
    </button>
  );
}
