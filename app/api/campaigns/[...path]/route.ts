import { NextRequest, NextResponse } from 'next/server';

function getWorkerUrl(): string {
  const url = process.env.AI_WORKER_URL || 'http://127.0.0.1:8000';
  return url.replace(/\/+$/, '');
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  const subpath = path.join('/');
  const workerUrl = getWorkerUrl();

  try {
    const res = await fetch(`${workerUrl}/api/v1/campaigns/${subpath}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'AI Worker campaigns endpoint unreachable', details: err.message },
      { status: 502 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  const subpath = path.join('/');
  const workerUrl = getWorkerUrl();

  try {
    const body = await req.json();
    const res = await fetch(`${workerUrl}/api/v1/campaigns/${subpath}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'AI Worker campaigns endpoint unreachable', details: err.message },
      { status: 502 }
    );
  }
}
