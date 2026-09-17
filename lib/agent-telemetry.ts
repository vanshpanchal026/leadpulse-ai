/**
 * lib/agent-telemetry.ts
 *
 * Real-Time Agent Telemetry & Event Streaming Engine.
 * Provides live observability into:
 * - Parent Agent lifecycle
 * - Subagent execution hierarchy (Website Auditor, Meta Ads Inspector, Maps Sentiment Evaluator, etc.)
 * - Claude/Perplexity-style internal "Thinking..." reasoning streams
 * - Tool calls with arguments, latencies, and return values
 * - Multi-agent validation checkpoints & guardrails
 */

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

// In-memory event buffer (keeps last 200 events)
const MAX_EVENTS = 200;
const eventHistory: AgentActivityEvent[] = [];
const subscribers = new Set<(event: AgentActivityEvent) => void>();

let currentSwarmStatus: SwarmStatus = {
  isActive: false,
  activeAgent: null,
  activeSubagents: [],
  totalEventsEmitted: 0,
  currentStage: 'idle',
  startedAt: null,
  lastActiveAt: new Date().toISOString(),
};

/**
 * Emit an agent activity event to all active subscribers and in-memory ring buffer.
 */
export function emitAgentEvent(
  eventData: Omit<AgentActivityEvent, 'id' | 'timestamp'> & { timestamp?: string }
): AgentActivityEvent {
  const event: AgentActivityEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: eventData.timestamp || new Date().toISOString(),
    ...eventData,
  };

  eventHistory.push(event);
  if (eventHistory.length > MAX_EVENTS) {
    eventHistory.shift();
  }

  // Update Swarm Status
  currentSwarmStatus.lastActiveAt = event.timestamp;
  currentSwarmStatus.totalEventsEmitted += 1;

  if (event.type === 'agent_spawn') {
    currentSwarmStatus.isActive = true;
    currentSwarmStatus.activeAgent = event.agentName;
    if (!currentSwarmStatus.startedAt) currentSwarmStatus.startedAt = event.timestamp;
  } else if (event.type === 'subagent_start' && event.subagentName) {
    if (!currentSwarmStatus.activeSubagents.includes(event.subagentName)) {
      currentSwarmStatus.activeSubagents.push(event.subagentName);
    }
  } else if (event.type === 'subagent_finish' && event.subagentName) {
    currentSwarmStatus.activeSubagents = currentSwarmStatus.activeSubagents.filter(
      (s) => s !== event.subagentName
    );
  } else if (event.type === 'agent_complete') {
    if (currentSwarmStatus.activeSubagents.length === 0) {
      currentSwarmStatus.isActive = false;
      currentSwarmStatus.activeAgent = null;
    }
  }

  // Notify active SSE listeners
  subscribers.forEach((cb) => {
    try {
      cb(event);
    } catch (e) {
      console.warn('Error in agent event listener:', e);
    }
  });

  return event;
}

/**
 * Subscribe to real-time agent events.
 */
export function subscribeToAgentEvents(callback: (event: AgentActivityEvent) => void): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

/**
 * Get recent event history and status.
 */
export function getAgentTelemetryState() {
  return {
    events: [...eventHistory],
    status: { ...currentSwarmStatus },
  };
}

/**
 * Clear in-memory event buffer.
 */
export function clearAgentTelemetry() {
  eventHistory.length = 0;
  currentSwarmStatus = {
    isActive: false,
    activeAgent: null,
    activeSubagents: [],
    totalEventsEmitted: 0,
    currentStage: 'idle',
    startedAt: null,
    lastActiveAt: new Date().toISOString(),
  };
}

/**
 * Runs a realistic live simulation of the full multi-agent swarm
 * with parent agents, subagents, and Perplexity/Claude-style thinking streams.
 */
export async function runLiveSwarmSimulation(targetBusiness = 'Dr. Smile Dental & Implant Centre') {
  clearAgentTelemetry();

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // 1. Search Strategist
  emitAgentEvent({
    agentName: 'LeadPulse Autonomous Swarm',
    agentRole: 'search_strategist',
    type: 'agent_spawn',
    title: 'Multi-Agent Research Swarm Activated',
    content: 'Initiating high-intent Delhi NCR local business discovery and operational audit.',
  });

  await sleep(400);

  emitAgentEvent({
    agentName: 'Search Strategist',
    agentRole: 'search_strategist',
    parentAgent: 'LeadPulse Autonomous Swarm',
    type: 'thinking',
    title: 'Evaluating Search Strategy & Geo Constraints',
    content: 'Formulating high-intent search queries based on Vansh ICP (Clinics with ~15+ staff, high inquiry volume).',
    thinkingProcess:
      'Analyzing target verticals: Dental & Dermatology clinics in South Delhi (GK, Saket, Green Park). Checking Apify actor rate limits and setting boundary radius to 25km. Selected query: "Dental Clinic in South Delhi" with review threshold >= 30.',
  });

  await sleep(800);

  emitAgentEvent({
    agentName: 'Search Strategist',
    agentRole: 'search_strategist',
    type: 'tool_call',
    title: 'Calling Apify Google Maps Scraper',
    content: 'Dispatching discovery query: "Dental Clinic in South Delhi"',
    toolName: 'apify_google_maps_search',
    toolArgs: {
      query: 'Dental Clinic in South Delhi',
      maxPlaces: 10,
      zoomLevel: 14,
      extractReviews: true,
    },
  });

  await sleep(1000);

  emitAgentEvent({
    agentName: 'Discovery Layer',
    agentRole: 'discovery_scraper',
    parentAgent: 'LeadPulse Autonomous Swarm',
    type: 'tool_result',
    title: 'Discovery Batch Fetched',
    content: `Found candidate: ${targetBusiness}. Rating: 4.8★ (124 reviews). Address: Greater Kailash 1, New Delhi.`,
    toolName: 'apify_google_maps_search',
    durationMs: 980,
    toolResult: {
      business_name: targetBusiness,
      reviews: 124,
      phone: '+919871122334',
      website: 'https://drsmiledentaldelhi.in',
      has_ads: true,
    },
  });

  await sleep(600);

  // 2. Lead Triage Fast-Path
  emitAgentEvent({
    agentName: 'Lead Triage Agent',
    agentRole: 'lead_triage',
    parentAgent: 'LeadPulse Autonomous Swarm',
    type: 'thinking',
    title: 'Fast-Path Zero-Token Triage',
    content: `Assessing ${targetBusiness} against rejection criteria.`,
    thinkingProcess:
      'Checking ICP exclusions: Is this a solo practitioner micro-shop (<5 staff)? Negative — 124 verified reviews and active facility address indicates established clinic with reception staff. Is it a student or other freelancer? No. Review count >= 50 satisfies high-ticket volume criteria. Candidate passed to Specialist Swarm.',
  });

  await sleep(700);

  emitAgentEvent({
    agentName: 'Lead Triage Agent',
    agentRole: 'lead_triage',
    type: 'decision',
    title: 'Candidate Qualified for Deep Specialist Audit',
    content: `${targetBusiness} scored 9/10 on preliminary scorecard. Spawning specialist subagent swarm.`,
  });

  await sleep(500);

  // 3. Specialist Swarm (Subagents in Parallel)
  emitAgentEvent({
    agentName: 'Specialist Orchestrator',
    agentRole: 'specialist_swarm',
    parentAgent: 'LeadPulse Autonomous Swarm',
    type: 'subagent_start',
    subagentName: 'Website & Booking Friction Auditor',
    title: 'Subagent Spawned: Website & Booking Friction Auditor',
    content: 'Auditing clinic website DOM for direct calendar links, booking widgets, and mobile responsiveness.',
  });

  emitAgentEvent({
    agentName: 'Specialist Orchestrator',
    agentRole: 'specialist_swarm',
    parentAgent: 'LeadPulse Autonomous Swarm',
    type: 'subagent_start',
    subagentName: 'Meta Ads & Traffic Inspector',
    title: 'Subagent Spawned: Meta Ads & Traffic Inspector',
    content: 'Scanning Meta Ad Library for active ad spend, landing page routing, and form abandonment points.',
  });

  emitAgentEvent({
    agentName: 'Specialist Orchestrator',
    agentRole: 'specialist_swarm',
    parentAgent: 'LeadPulse Autonomous Swarm',
    type: 'subagent_start',
    subagentName: 'Maps Reputation & Inquiry Evaluator',
    title: 'Subagent Spawned: Maps Reputation & Inquiry Evaluator',
    content: 'Parsing Google Maps review sentiment for mentions of telephone wait times and booking delays.',
  });

  await sleep(1100);

  // Subagent 1 Thinking & Tool
  emitAgentEvent({
    agentName: 'Specialist Swarm',
    agentRole: 'website_auditor',
    subagentName: 'Website & Booking Friction Auditor',
    type: 'thinking',
    title: 'Inspecting DOM & Conversion Pathways',
    content: 'Crawling https://drsmiledentaldelhi.in for self-serve appointment scheduling.',
    thinkingProcess:
      'Found 3 contact buttons on mobile viewport. All 3 buttons link to standard telephone dialer (tel:+91...). No Calendly, Cal.com, or embedded booking widget detected. Clinic relies 100% on manual telephone receptionist. Patient inquiry loss during non-operating hours (8 PM - 9 AM) estimated at 35%.',
  });

  await sleep(900);

  // Subagent 2 Thinking & Tool
  emitAgentEvent({
    agentName: 'Specialist Swarm',
    agentRole: 'ads_inspector',
    subagentName: 'Meta Ads & Traffic Inspector',
    type: 'tool_result',
    title: 'Meta Ad Library Scan Complete',
    content: 'Active campaigns detected: 3 live ad creatives targeting "Invisalign South Delhi". Ad traffic routed to static web page with standard lead form.',
    toolName: 'meta_ad_library_scraper',
    durationMs: 840,
    toolResult: {
      active_ads: 3,
      creative_type: 'video_and_carousel',
      landing_page: 'https://drsmiledentaldelhi.in/invisalign',
      form_drop_off_risk: 'High (no instant speed-to-lead follow-up detected)',
    },
  });

  await sleep(800);

  // Subagents finish
  emitAgentEvent({
    agentName: 'Specialist Orchestrator',
    agentRole: 'specialist_swarm',
    type: 'subagent_finish',
    subagentName: 'Website & Booking Friction Auditor',
    title: 'Website Audit Completed',
    content: 'Identified primary friction: Missing self-serve calendar booking and after-hours inquiry capture.',
  });

  emitAgentEvent({
    agentName: 'Specialist Orchestrator',
    agentRole: 'specialist_swarm',
    type: 'subagent_finish',
    subagentName: 'Meta Ads & Traffic Inspector',
    title: 'Meta Ads Audit Completed',
    content: 'Active paid ad spend confirmed with delayed lead follow-up.',
  });

  emitAgentEvent({
    agentName: 'Specialist Orchestrator',
    agentRole: 'specialist_swarm',
    type: 'subagent_finish',
    subagentName: 'Maps Reputation & Inquiry Evaluator',
    title: 'Maps Audit Completed',
    content: '124 reviews confirmed. High-intent local reputation verified.',
  });

  await sleep(600);

  // 4. Opportunity Analyst
  emitAgentEvent({
    agentName: 'Opportunity Analyst',
    agentRole: 'opportunity_analyst',
    parentAgent: 'LeadPulse Autonomous Swarm',
    type: 'thinking',
    title: 'Synthesizing Canonical Service Recommendation',
    content: 'Matching detected friction points against the 7 canonical services.',
    thinkingProcess:
      'Candidate has active ads + high reviews (124) + missing direct calendar scheduling. While active ads qualify for speed-to-lead (lead_automation), the dominant front-desk bottleneck reported in reviews is phone scheduling. Primary recommended service assigned: booking_automation (Online Booking & Calendar Scheduling). Secondary service: whatsapp_automation (Inquiry Capture). Confidence: 0.94.',
  });

  await sleep(700);

  emitAgentEvent({
    agentName: 'Opportunity Analyst',
    agentRole: 'opportunity_analyst',
    type: 'decision',
    title: 'Service Recommendation Finalized',
    content: 'Recommended Service: booking_automation. Prospect Score: 10/10 (Immediate Outreach Priority).',
  });

  await sleep(500);

  // 5. Outreach Copywriter & Guardrails
  emitAgentEvent({
    agentName: 'Outreach Copywriter',
    agentRole: 'outreach_copywriter',
    parentAgent: 'LeadPulse Autonomous Swarm',
    type: 'thinking',
    title: 'Drafting First-Contact Outreach with Vansh Constraints',
    content: 'Applying 7 strict outreach invariants for Vansh (Solo peer voice, <=3 sentences, zero meeting asks).',
    thinkingProcess:
      'Formulating pitch: (1) Technical observation: Saw Dr. Smile Dental has 120+ patient reviews on Maps, but scheduling currently requires calling the desk. (2) Outcome benefit: An automated calendar link lets patients pick consultation slots directly without phone tag. Checking character count: 242 chars (under 300 char limit). Checking banned words: No "we", no "streamline", no "call", no "pricing".',
  });

  await sleep(800);

  const draftPitch =
    'Hi, saw Dr. Smile Dental has great patient reviews on Maps, but scheduling currently requires calling the front desk. An automated calendar link lets patients pick consultation slots directly without telephone delays.';

  emitAgentEvent({
    agentName: 'Outreach Copywriter',
    agentRole: 'outreach_copywriter',
    type: 'decision',
    title: 'Pitch Draft Generated',
    content: draftPitch,
    metadata: {
      charCount: draftPitch.length,
      sentences: 2,
    },
  });

  await sleep(600);

  // 6. Guardrail Validator
  emitAgentEvent({
    agentName: 'Guardrail Validator',
    agentRole: 'guardrail_validator',
    parentAgent: 'LeadPulse Autonomous Swarm',
    type: 'guardrail_pass',
    title: 'Strict Invariant Validation Passed (7/7)',
    content: 'Zero banned buzzwords. No call/meeting request. Character count: 226/300. Solo peer tone verified. No past client claims.',
  });

  await sleep(400);

  emitAgentEvent({
    agentName: 'LeadPulse Autonomous Swarm',
    agentRole: 'search_strategist',
    type: 'agent_complete',
    title: 'Research Swarm Cycle Finished',
    content: `Successfully audited ${targetBusiness}. Lead saved to database and queued for human review.`,
  });
}
