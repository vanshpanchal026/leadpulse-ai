import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // 1. Primary Production Source of Truth: Supabase
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return NextResponse.json({
          leads: data,
          total: data.length,
          source: 'supabase',
        });
      }
      if (error) {
        console.warn('⚠️ Supabase query warning, falling back to local storage:', error.message);
      }
    }

    // 2. Secondary Local JSON fallback (data/leads.json)
    const jsonPath = path.join(process.cwd(), 'data', 'leads.json');
    if (fs.existsSync(jsonPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        if (Array.isArray(raw) && raw.length > 0) {
          return NextResponse.json({
            leads: raw,
            total: raw.length,
            source: 'local_json',
          });
        }
      } catch (err: any) {
        console.warn('⚠️ data/leads.json parse error:', err.message);
      }
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
