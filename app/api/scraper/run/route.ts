import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action || 'reanalyze';

    const scriptName = action === 'scrape' ? 'run_reddit_scraper.py' : 'analyze_leads.py';
    const scriptPath = path.join(process.cwd(), 'scripts', scriptName);

    // Run python script
    const py = spawn('python', [scriptPath], {
      cwd: process.cwd(),
      env: process.env,
    });

    let output = '';
    let errorOutput = '';

    py.stdout.on('data', (data) => {
      output += data.toString();
    });

    py.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    const exitCode = await new Promise<number>((resolve) => {
      py.on('close', resolve);
    });

    if (exitCode === 0) {
      return NextResponse.json({
        success: true,
        message: `Executed ${scriptName} successfully`,
        output,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          message: `Script ${scriptName} exited with code ${exitCode}`,
          error: errorOutput || output,
        },
        { status: 500 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
