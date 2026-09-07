import { NextResponse } from 'next/server';
import { getLeadsAndStats } from '@/lib/lead-parser';

export async function GET() {
  try {
    const data = await getLeadsAndStats();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error reading leads:', error);
    return NextResponse.json(
      { error: 'Failed to parse leads dataset', details: error.message },
      { status: 500 }
    );
  }
}
