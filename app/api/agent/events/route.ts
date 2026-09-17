import { NextRequest, NextResponse } from 'next/server';
import {
  getAgentTelemetryState,
  runLiveSwarmSimulation,
  clearAgentTelemetry,
  emitAgentEvent,
} from '@/lib/agent-telemetry';

export const dynamic = 'force-dynamic';

export async function GET() {
  const state = getAgentTelemetryState();
  return NextResponse.json(state);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'simulate';

    if (action === 'clear') {
      clearAgentTelemetry();
      return NextResponse.json({ success: true, message: 'Telemetry cleared' });
    }

    if (action === 'simulate') {
      const targetBusiness = body.business_name || 'Dr. Smile Dental & Implant Centre';
      // Run simulation asynchronously in the background so request returns immediately
      runLiveSwarmSimulation(targetBusiness).catch((err) => {
        console.error('Simulation error:', err);
      });

      return NextResponse.json({
        success: true,
        message: 'Swarm simulation launched',
        targetBusiness,
      });
    }

    if (action === 'emit' && body.event) {
      const emitted = emitAgentEvent(body.event);
      return NextResponse.json({ success: true, event: emitted });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
