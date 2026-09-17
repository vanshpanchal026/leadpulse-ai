import { NextRequest, NextResponse } from 'next/server';

function getWorkerUrl(): string {
  const url = process.env.AI_WORKER_URL || 'http://127.0.0.1:8000';
  return url.replace(/\/+$/, '');
}

export async function GET() {
  const workerUrl = getWorkerUrl();
  try {
    const res = await fetch(`${workerUrl}/api/v1/outreach`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Worker error ${res.status}: ${errText}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    // If worker is not running, return empty list gracefully
    return NextResponse.json([]);
  }
}

export async function POST(req: NextRequest) {
  const workerUrl = getWorkerUrl();
  try {
    const body = await req.json();
    const res = await fetch(`${workerUrl}/api/v1/outreach/draft`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to communicate with AI Worker outreach service',
        details: err.message,
      },
      { status: 502 }
    );
  }
}
