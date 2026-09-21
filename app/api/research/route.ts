import { NextRequest, NextResponse } from 'next/server';

function getWorkerUrl(): string {
  const url = process.env.AI_WORKER_URL || 'http://127.0.0.1:8000';
  return url.replace(/\/+$/, '');
}

export async function GET(req: NextRequest) {
  const workerUrl = getWorkerUrl();
  const { searchParams } = new URL(req.url);
  const queryString = searchParams.toString();
  const endpoint = queryString ? `${workerUrl}/api/v1/research-runs?${queryString}` : `${workerUrl}/api/v1/research-runs`;

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `Worker error ${res.status}: ${errText}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ items: [], total: 0, limit: 50, offset: 0 });
  }
}

export async function POST(req: NextRequest) {
  const workerUrl = getWorkerUrl();
  try {
    const body = await req.json();
    const res = await fetch(`${workerUrl}/api/v1/research-runs`, {
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
        error: 'Failed to communicate with AI Worker research service',
        details: err.message,
      },
      { status: 502 }
    );
  }
}
