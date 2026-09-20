import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/navigation/sidebar';
import { MobileNav } from '@/components/navigation/mobile-nav';
import { ShieldCheck, Activity, Database, LogOut } from 'lucide-react';
import { ConnectivityBanner } from '@/components/layout/connectivity-banner';
import { AgentMissionControl, AgentSwarmStatusPill } from '@/components/agent/agent-mission-control';

export function AppShell() {
  const [isMissionControlOpen, setIsMissionControlOpen] = useState(false);

  const pillBase =
    'flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-secondary border border-border text-[11px]';

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/login', { method: 'DELETE' });
    } finally {
      window.location.href = '/login';
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground antialiased font-sans">
      {/* Desktop Persistent Sidebar */}
      <Sidebar className="hidden md:flex flex-col shrink-0" />

      {/* Main Column */}
      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        {/* Real-Time Connectivity Warning Banner */}
        <ConnectivityBanner />

        {/* Mobile Navigation Header */}
        <MobileNav />

        {/* Desktop Top Header Bar (40px) */}
        <header className="hidden md:flex items-center justify-between px-6 py-1.5 border-b border-border bg-card shrink-0 select-none">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex h-2 w-2 rounded-full bg-[hsl(var(--success))] motion-safe:animate-pulse" />
            <span className="font-medium text-foreground [font-family:var(--font-display)]">LeadPulse AI</span>
            <span>/</span>
            <span className="font-mono text-[11px] text-muted-foreground">Swarm V2</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Supabase Status Pill */}
            <div className={pillBase}>
              <Database className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">DB:</span>
              <span className="font-medium text-foreground">Supabase</span>
            </div>

            {/* AI Worker Status Pill */}
            <div className={pillBase}>
              <Activity className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Worker:</span>
              <span className="font-medium text-foreground">:8000</span>
            </div>

            {/* Real-Time Agent Swarm Status Pill */}
            <AgentSwarmStatusPill onClick={() => setIsMissionControlOpen(true)} />

            {/* Safe Mode Lock Guardrail */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[hsl(var(--success-bg))] border border-[hsl(var(--success-border))] text-[hsl(var(--success-fg))] text-[11px]">
              <ShieldCheck className="h-3.5 w-3.5 text-[hsl(var(--success))] shrink-0" />
              <span className="font-medium">Autonomous Send: Locked</span>
            </div>

            {/* Lock / Sign Out */}
            <button
              onClick={handleLogout}
              title="Lock Dashboard Session"
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-secondary hover:bg-destructive/10 border border-border hover:border-destructive/30 text-muted-foreground hover:text-destructive text-[11px] transition-colors cursor-pointer"
            >
              <LogOut className="h-3 w-3 shrink-0" />
              <span>Lock</span>
            </button>
          </div>
        </header>

        {/* Independent Scrollable Workspace Content View */}
        <main className="flex-1 overflow-y-auto min-h-0 p-5 md:p-8 bg-background">
          <Outlet />
        </main>
      </div>

      {/* Real-Time Agent Mission Control Drawer */}
      <AgentMissionControl
        isOpen={isMissionControlOpen}
        onClose={() => setIsMissionControlOpen(false)}
      />
    </div>
  );
}
