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
    const res = await fetch(`${workerUrl}/api/v1/research-runs/${subpath}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'AI Worker research endpoint unreachable', details: err.message },
      { status: 502 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  const subpath = path.join('/');
  const workerUrl = getWorkerUrl();

  try {
    let body = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const res = await fetch(`${workerUrl}/api/v1/research-runs/${subpath}`, {
      method: 'POST',
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
      { error: 'AI Worker research endpoint unreachable', details: err.message },
      { status: 502 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  const subpath = path.join('/');
  const workerUrl = getWorkerUrl();

  try {
    const res = await fetch(`${workerUrl}/api/v1/research-runs/${subpath}`, {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'AI Worker research endpoint unreachable', details: err.message },
      { status: 502 }
    );
  }
}

