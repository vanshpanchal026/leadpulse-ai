import React, { useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTheme } from '@/lib/use-theme';
import { toast } from 'sonner';
import {
  Activity,
  Database,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Server,
  Key,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react';

export function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [testingWorker, setTestingWorker] = useState(false);
  const [workerStatus, setWorkerStatus] = useState<'idle' | 'healthy' | 'offline'>('idle');

  const checkWorker = async () => {
    setTestingWorker(true);
    try {
      const res = await fetch('/api/v1/health');
      if (res.ok) {
        setWorkerStatus('healthy');
        toast.success('Python AI Worker Healthy', {
          description: 'Vite proxy successfully reached worker on http://127.0.0.1:8000',
        });
      } else {
        setWorkerStatus('offline');
        toast.error(`Worker responded with status ${res.status}`);
      }
    } catch (err: any) {
      setWorkerStatus('offline');
      toast.error('Worker unreachable via proxy', {
        description: err.message,
      });
    } finally {
      setTestingWorker(false);
    }
  };

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        title="System Settings & Diagnostics"
        description="Verify service health, remote Supabase schema parity, and model provider telemetry."
        breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Settings' }]}
        badge={
          <Badge variant="secondary" className="text-[10px]">
            System Architecture V2
          </Badge>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Appearance Section */}
        <Card className="border-border bg-card shadow-xs rounded-md md:col-span-2">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium [font-family:var(--font-display)] flex items-center gap-2 text-foreground">
                <Sun className="h-4 w-4 text-muted-foreground" />
                Interface Appearance
              </CardTitle>
              <Badge variant="secondary" className="text-[10px] font-mono capitalize">
                {theme} mode active
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Select your visual theme preference for the LeadPulse AI command center.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-3 gap-3 max-w-sm">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`p-3 rounded-md border text-center transition-[border-color,background-color] flex flex-col items-center gap-2 cursor-pointer ${
                  theme === 'light'
                    ? 'border-[hsl(var(--info-border))] bg-[hsl(var(--info-bg))] text-[hsl(var(--info-fg))]'
                    : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                <Sun className="h-4 w-4" />
                <span className="text-xs font-medium">Light</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`p-3 rounded-md border text-center transition-[border-color,background-color] flex flex-col items-center gap-2 cursor-pointer ${
                  theme === 'dark'
                    ? 'border-[hsl(var(--info-border))] bg-[hsl(var(--info-bg))] text-[hsl(var(--info-fg))]'
                    : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                <Moon className="h-4 w-4" />
                <span className="text-xs font-medium">Dark</span>
              </button>

              <button
                type="button"
                onClick={() => setTheme('system')}
                className={`p-3 rounded-md border text-center transition-[border-color,background-color] flex flex-col items-center gap-2 cursor-pointer ${
                  theme === 'system'
                    ? 'border-[hsl(var(--info-border))] bg-[hsl(var(--info-bg))] text-[hsl(var(--info-fg))]'
                    : 'border-border bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                <Monitor className="h-4 w-4" />
                <span className="text-xs font-medium">System</span>
              </button>
            </div>
          </CardContent>
        </Card>

        {/* AI Worker Connection Card */}
        <Card className="border-border bg-card shadow-xs rounded-md">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium [font-family:var(--font-display)] flex items-center gap-2 text-foreground">
                <Server className="h-4 w-4 text-muted-foreground" />
                Python AI Worker (FastAPI)
              </CardTitle>
              <Badge
                variant={
                  workerStatus === 'healthy'
                    ? 'success'
                    : workerStatus === 'offline'
                    ? 'destructive'
                    : 'secondary'
                }
              >
                {workerStatus === 'healthy'
                  ? 'Healthy (:8000)'
                  : workerStatus === 'offline'
                  ? 'Unreachable'
                  : 'Ready'}
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              FastAPI backend running OpenAI Agents SDK orchestration on port 8000.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-3 space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-border">
              <span className="text-muted-foreground">Proxy Path</span>
              <span className="font-mono text-foreground">/api/v1/* &rarr; :8000</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border">
              <span className="text-muted-foreground">Framework</span>
              <span className="font-mono text-foreground">Python 3.12 / FastAPI</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Agent Engine</span>
              <span className="font-mono text-foreground">OpenAI Agents SDK</span>
            </div>
          </CardContent>
          <CardFooter className="border-t border-border pt-3">
            <Button
              variant="outline"
              size="sm"
              onClick={checkWorker}
              disabled={testingWorker}
              className="w-full font-medium"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-1.5 ${testingWorker ? 'animate-spin' : ''}`}
              />
              {testingWorker ? 'Testing Connection...' : 'Test Worker Health (/api/v1/health)'}
            </Button>
          </CardFooter>
        </Card>

        {/* Remote Supabase Card */}
        <Card className="border-border bg-card shadow-xs rounded-md">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium [font-family:var(--font-display)] flex items-center gap-2 text-foreground">
                <Database className="h-4 w-4 text-muted-foreground" />
                Remote Supabase PostgreSQL
              </CardTitle>
              <Badge variant="success">Phase 8.1 PASS</Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground">
              Production source of truth with 19 V2 intelligence columns.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-3 space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-border">
              <span className="text-muted-foreground">Leads Schema</span>
              <span className="font-mono text-[hsl(var(--success-fg))] font-medium">
                19 V2 Columns Active
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-border">
              <span className="text-muted-foreground">Research Runs Table</span>
              <span className="font-mono text-[hsl(var(--success-fg))] font-medium">
                public.research_runs (Verified)
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-muted-foreground">Row Level Security</span>
              <span className="font-mono text-foreground">Active (Safe Policies)</span>
            </div>
          </CardContent>
          <CardFooter className="border-t border-border pt-3 text-[11px] text-muted-foreground">
            Supabase is the single source of truth across V1 and V2 pipelines.
          </CardFooter>
        </Card>

        {/* Guardrail Invariants */}
        <Card className="border-border bg-card shadow-xs rounded-md md:col-span-2">
          <CardHeader className="pb-3 border-b border-border">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium [font-family:var(--font-display)] flex items-center gap-2 text-foreground">
                <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                Deterministic Guardrails & Anti-Spam Safety Invariants
              </CardTitle>
              <Badge variant="secondary">Hard Enforced</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-md bg-secondary border border-border">
                <div className="font-medium text-foreground">Message Max Length</div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  Drafts exceeding 300 characters fail deterministic validation automatically.
                </div>
              </div>

              <div className="p-3 rounded-md bg-secondary border border-border">
                <div className="font-medium text-foreground">Sentence Constraint</div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  Drafts must consist of exactly 2–3 clear, value-focused sentences.
                </div>
              </div>

              <div className="p-3 rounded-md bg-secondary border border-border">
                <div className="font-medium text-foreground">Zero Autonomous Send</div>
                <div className="text-[11px] text-[hsl(var(--success-fg))] mt-1 font-mono">
                  external_send_executed = false is strictly enforced by code.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
