import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  FlaskConical,
  Send,
  Settings,
  ShieldCheck,
  Zap,
  Activity,
  Database
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

export const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    title: 'Leads Intelligence',
    href: '/leads',
    icon: Building2,
    badge: 'v9.3',
  },
  {
    title: 'Research Engine',
    href: '/research',
    icon: FlaskConical,
  },
  {
    title: 'Outreach Review',
    href: '/outreach',
    icon: Send,
  },
  {
    title: 'System & Diagnostics',
    href: '/settings',
    icon: Settings,
  },
];

interface SidebarProps extends React.HTMLAttributes<HTMLElement> {}

export function Sidebar({ className, ...props }: SidebarProps) {
  return (
    <aside
      className={cn(
        'w-[220px] border-r border-border bg-card flex flex-col justify-between h-screen select-none shrink-0',
        className
      )}
      {...props}
    >
      {/* Top Header / Brand */}
      <div className="p-3.5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[hsl(var(--info-bg))] text-[hsl(var(--primary))] border border-[hsl(var(--info-border))]">
            <Zap className="h-4 w-4 fill-current" />
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-medium text-xs tracking-tight text-foreground [font-family:var(--font-display)]">
                LeadPulse AI
              </span>
              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 font-normal">
                V2.0
              </Badge>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono truncate">
              Intelligence Swarm
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation Links */}
      <div className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        <nav className="space-y-0.5" aria-label="Main Navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.href === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors duration-150',
                    isActive
                      ? 'bg-[hsl(var(--info-bg))] text-[hsl(var(--info-fg))]'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 transition-colors duration-150',
                        isActive ? 'text-[hsl(var(--primary))]' : 'text-muted-foreground'
                      )}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 truncate">{item.title}</span>
                    {item.badge && (
                      <span className="text-[10px] text-muted-foreground ml-auto font-mono">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* System Status & Guardrail Footer */}
      <div className="p-3 border-t border-border bg-card space-y-2">
        <div className="flex items-center gap-1.5 px-1">
          <ShieldCheck className="h-3.5 w-3.5 text-[hsl(var(--success))] shrink-0" />
          <span className="text-[10px] text-muted-foreground font-medium">Human Gate Active</span>
        </div>

        <div className="flex items-center justify-between px-1 text-[10px] text-muted-foreground font-mono">
          <span className="flex items-center gap-1">
            <Activity className="h-3 w-3 text-muted-foreground" />
            Worker: 8000
          </span>
          <span className="flex items-center gap-1">
            <Database className="h-3 w-3 text-muted-foreground" />
            Supabase
          </span>
        </div>
      </div>
    </aside>
  );
}
