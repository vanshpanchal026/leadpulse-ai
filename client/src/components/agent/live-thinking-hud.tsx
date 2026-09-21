import React, { useState, useEffect, useRef } from 'react';
import {
  Brain,
  Terminal,
  Play,
  Sparkles,
  Layers,
  CheckCircle2,
  Clock,
  RotateCcw,
  Cpu,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { AgentActivityEvent, SwarmStatus } from './agent-mission-control';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface LiveThinkingHudProps {
  onOpenFullMissionControl?: () => void;
}

export function LiveThinkingHud({ onOpenFullMissionControl }: LiveThinkingHudProps) {
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
  const [isSimulating, setIsSimulating] = useState(false);
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource('/api/agent/stream');
      es.addEventListener('init', (e: MessageEvent) => {
        try {
          const payload = JSON.parse(e.data);
          if (Array.isArray(payload.events)) setEvents(payload.events);
          if (payload.status) setSwarmStatus(payload.status);
        } catch {
          // ignore
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
          if (newEvent.type === 'agent_spawn') {
            setSwarmStatus((prev) => ({ ...prev, isActive: true, activeAgent: newEvent.agentName }));
          } else if (newEvent.type === 'agent_complete') {
            setSwarmStatus((prev) => ({ ...prev, isActive: false, activeAgent: null }));
          }
        } catch {
          // ignore
        }
      });
    } catch {
      // ignore
    }

    // Polling fallback
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/agent/events');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.events) && data.events.length > events.length) {
            setEvents(data.events);
          }
          if (data.status) setSwarmStatus(data.status);
        }
      } catch {
        // silent
      }
    }, 3000);

    return () => {
      es?.close();
      clearInterval(interval);
    };
  }, [events.length]);

  const handleRunSimulation = async () => {
    setIsSimulating(true);
    try {
      await fetch('/api/agent/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'simulate' }),
      });
    } catch (err) {
      console.error(err);
    } finally {
      setTimeout(() => setIsSimulating(false), 2000);
    }
  };

  const recentEvents = events.slice(-6).reverse();

  return (
    <Card className="border border-border bg-card rounded-md shadow-xs overflow-hidden">
      {/* HUD Header */}
      <CardHeader className="px-4 py-2.5 border-b border-border bg-secondary flex flex-row items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative flex items-center justify-center">
            <div className={`w-2 h-2 rounded-full ${swarmStatus.isActive ? 'bg-[hsl(var(--success))] motion-safe:animate-ping' : 'bg-muted-foreground'}`} />
            <div className={`absolute inset-0 w-2 h-2 rounded-full ${swarmStatus.isActive ? 'bg-[hsl(var(--success))]' : 'bg-muted-foreground'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-medium tracking-tight [font-family:var(--font-display)] flex items-center gap-1.5 text-foreground">
                <Brain className="w-4 h-4 text-muted-foreground" />
                <span>Real-Time AI Swarm Telemetry &amp; Thinking Stream</span>
              </CardTitle>
              <span className="bg-[hsl(var(--info-bg))] text-[hsl(var(--info-fg))] border border-[hsl(var(--info-border))] text-[10px] rounded px-1.5 py-0.5 font-mono font-medium">
                {swarmStatus.isActive ? 'SWARM EXECUTING' : 'SWARM READY'}
              </span>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-0.5">
              Live reasoning trace, active subagent hierarchy, and tool invocations.
            </CardDescription>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleRunSimulation}
            disabled={isSimulating}
            className="h-8 px-4 rounded-full text-xs font-medium bg-primary hover:bg-primary/90 text-white cursor-pointer shadow-xs transition-colors duration-150"
            aria-label="Test Live Swarm"
          >
            <Play className="w-3 h-3 fill-current" />
            <span>{isSimulating ? 'Simulating...' : 'Test Live Swarm'}</span>
          </Button>

          {onOpenFullMissionControl && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenFullMissionControl}
              className="h-8 gap-1.5 text-xs font-medium cursor-pointer"
              aria-label="Open Full Mission Control Drawer"
            >
              <span>Full Drawer</span>
              <ExternalLink className="w-3 h-3" />
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {/* Multi-Agent Swarm Hierarchy Bar */}
        <div className="grid grid-cols-4 gap-2 text-xs font-mono">
          <div className="p-2 rounded-md bg-secondary border border-border">
            <span className="text-[10px] text-muted-foreground block">1. STRATEGIST</span>
            <span className="font-medium text-foreground truncate block">Query Formulation</span>
          </div>
          <div className="p-2 rounded-md bg-secondary border border-border">
            <span className="text-[10px] text-muted-foreground block">2. DISCOVERY</span>
            <span className="font-medium text-foreground truncate block">Apify Maps &amp; Ads</span>
          </div>
          <div className="p-2 rounded-md bg-[hsl(var(--info-bg))] border border-[hsl(var(--info-border))] text-[hsl(var(--info-fg))]">
            <span className="text-[10px] text-[hsl(var(--info-fg))] block flex items-center gap-1 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))] motion-safe:animate-pulse" />
              3. SUBAGENT SWARM
            </span>
            <span className="font-medium truncate block">Website, Ads &amp; Maps</span>
          </div>
          <div className="p-2 rounded-md bg-secondary border border-border">
            <span className="text-[10px] text-muted-foreground block">4. OUTREACH GUARD</span>
            <span className="font-medium text-foreground truncate block">Deterministic Invariants</span>
          </div>
        </div>

        {/* Live Feed Items */}
        <div className="space-y-2 max-h-72 overflow-y-auto font-mono text-xs pr-1">
          {recentEvents.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground text-xs">
              <p>No active agent events in buffer.</p>
              <p className="text-[11px] mt-1">
                Click <strong className="text-[hsl(var(--primary))]">Test Live Swarm</strong> above to stream real-time agent thoughts and tool calls.
              </p>
            </div>
          ) : (
            recentEvents.map((evt) => {
              const isThinking = evt.type === 'thinking';
              const isTool = evt.type === 'tool_call' || evt.type === 'tool_result';
              const isDecision = evt.type === 'decision';
              const isExpanded = expandedThinking[evt.id] ?? false;

              return (
                <div
                  key={evt.id}
                  className={`p-3 rounded-md border text-xs transition-colors duration-150 ${
                    isThinking
                      ? 'bg-[hsl(var(--info-bg))] border-[hsl(var(--info-border))] text-foreground'
                      : isTool
                        ? 'bg-secondary border-border text-foreground'
                        : isDecision
                          ? 'bg-[hsl(var(--success-bg))] border-[hsl(var(--success-border))] text-foreground'
                          : 'bg-secondary border-border text-foreground'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                        {evt.agentName}
                      </Badge>
                      {evt.subagentName && (
                        <span className="text-[10px] font-mono bg-secondary text-muted-foreground border border-border rounded px-1.5 py-0">
                          Subagent: {evt.subagentName}
                        </span>
                      )}
                      <span className="text-[9px] uppercase font-medium text-muted-foreground">
                        {evt.type}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono tabular-nums">
                      {new Date(evt.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="font-medium text-xs text-foreground">{evt.title}</div>
                  <div className="text-muted-foreground text-xs mt-0.5">{evt.content}</div>

                  {/* Thinking trace collapsible */}
                  {evt.thinkingProcess && (
                    <div className="mt-2 pt-2 border-t border-border/60">
                      <button
                        onClick={() =>
                          setExpandedThinking((prev) => ({ ...prev, [evt.id]: !isExpanded }))
                        }
                        className="flex items-center gap-1.5 text-[11px] font-mono text-[hsl(var(--primary))] hover:underline cursor-pointer"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))] motion-safe:animate-ping" />
                        <span>{isExpanded ? 'Hide Thinking' : 'Reasoning Stream'}</span>
                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                      </button>

                      {isExpanded && (
                        <div className="mt-1.5 p-2.5 rounded bg-secondary border border-border text-foreground text-[11px] leading-relaxed whitespace-pre-wrap font-mono">
                          {evt.thinkingProcess}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
