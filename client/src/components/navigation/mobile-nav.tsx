import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Menu, X, Zap, ShieldCheck } from 'lucide-react';
import { navItems } from './sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  const toggle = () => setIsOpen((prev) => !prev);
  const close = () => setIsOpen(false);

  return (
    <div className="md:hidden border-b border-border/80 bg-card/95 px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 border border-primary/30 text-primary">
            <Zap className="h-4 w-4 fill-primary/30" />
          </div>
          <span className="font-semibold [font-family:var(--font-display)] text-sm text-foreground">LeadPulse AI</span>
          <Badge variant="default" className="text-[9px] px-1 py-0 h-4">
            V2.0
          </Badge>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={toggle}
          aria-label={isOpen ? 'Close menu' : 'Open menu'}
          className="h-8 w-8"
        >
          {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Slide-down mobile navigation menu */}
      {isOpen && (
        <div className="pt-3 pb-2 space-y-2 animate-in fade-in-50 duration-200">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end={item.href === '/'}
                  onClick={close}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center justify-between px-3 py-2 rounded-md text-xs font-medium transition-colors duration-150',
                      isActive
                        ? 'bg-[hsl(var(--info-bg))] text-[hsl(var(--info-fg))]'
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    )
                  }
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.title}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] text-muted-foreground font-mono">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          <div className="p-2.5 rounded-md bg-[hsl(var(--success-bg))] border border-[hsl(var(--success-border))] text-[11px] flex items-center gap-2 text-[hsl(var(--success-fg))]">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--success))]" />
            <span className="font-medium">Safe Mode Enforced (Human Approval Gate)</span>
          </div>
        </div>
      )}
    </div>
  );
}
