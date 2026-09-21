import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase, isSupabaseConfigured } from '@/lib/supabase';

function getWorkerUrl(): string {
  const url = process.env.AI_WORKER_URL || 'http://127.0.0.1:8000';
  return url.replace(/\/+$/, '');
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const researchRunId = searchParams.get('research_run_id');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // 1. Primary Production Source of Truth: Supabase
    if (isSupabaseConfigured) {
      const client = getServiceSupabase();
      let query = client
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (researchRunId && researchRunId.toLowerCase() !== 'all') {
        query = query.eq('research_run_id', researchRunId);
      }
      if (status && status.toLowerCase() !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        // Defensive filter against mock/test entries
        const filteredData = data.filter((lead: any) => {
          const id = String(lead.id || '');
          const name = String(lead.business_name || lead.title || '');
          if (id.startsWith('lead_live_test_') || id.startsWith('test_')) return false;
          if (name.startsWith('Test Clinic')) return false;
          if (['Metro Aesthetics & Smile Studio', 'Apex Dental Spa', 'Aura Dental Lounge'].includes(name)) return false;
          return true;
        });

        if (filteredData.length > 0) {
          return NextResponse.json({
            leads: filteredData.slice(offset, offset + limit),
            total: filteredData.length,
            source: 'supabase',
          });
        }
      }
      if (error) {
        console.warn('⚠️ Supabase query warning, falling back to AI Worker / SQLite mirror:', error.message);
      }
    }

    // 2. Secondary Local Proxy to AI Worker (/api/v1/leads backed by data/leadpulse_v2.db)
    const workerUrl = getWorkerUrl();
    try {
      const forwardParams = new URLSearchParams();
      if (researchRunId) forwardParams.set('research_run_id', researchRunId);
      if (status) forwardParams.set('status', status);
      forwardParams.set('limit', String(limit));
      forwardParams.set('offset', String(offset));

      const workerRes = await fetch(`${workerUrl}/api/v1/leads?${forwardParams.toString()}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });

      if (workerRes.ok) {
        const workerData = await workerRes.json();
        const items = Array.isArray(workerData) ? workerData : (workerData.items || workerData.leads || []);
        const total = workerData.total ?? items.length;
        return NextResponse.json({
          leads: items,
          total,
          source: 'ai_worker_sqlite',
        });
      }
    } catch (workerErr: any) {
      console.warn('⚠️ AI Worker leads endpoint unreachable:', workerErr.message);
    }

    // 3. Fallback when no leads found
    return NextResponse.json({
      leads: [],
      total: 0,
      source: 'empty',
    });
  } catch (error: any) {
    console.error('Error reading leads:', error);
    return NextResponse.json(
      { error: 'Failed to parse leads dataset', details: error.message },
      { status: 500 }
    );
  }
}

