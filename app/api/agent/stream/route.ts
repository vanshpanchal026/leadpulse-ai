import { NextRequest } from 'next/server';
import { subscribeToAgentEvents, getAgentTelemetryState, AgentActivityEvent } from '@/lib/agent-telemetry';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new TransformStream();
  const writer = stream.writable.getWriter();

  const sendEvent = async (event: string, data: any) => {
    try {
      const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
      await writer.write(encoder.encode(payload));
    } catch {
      // client disconnected
    }
  };

  // Initial handshake: send recent history and current swarm state
  const { events, status } = getAgentTelemetryState();
  await sendEvent('init', { events, status });

  // Subscribe to live incoming events
  const unsubscribe = subscribeToAgentEvents((event: AgentActivityEvent) => {
    sendEvent('agent_event', event);
  });

  // Heartbeat keep-alive every 15s to prevent cloud proxy timeout
  const interval = setInterval(() => {
    sendEvent('heartbeat', { time: new Date().toISOString() });
  }, 15000);

  req.signal.addEventListener('abort', () => {
    clearInterval(interval);
    unsubscribe();
    writer.close().catch(() => {});
  });

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
