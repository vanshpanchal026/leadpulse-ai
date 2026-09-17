import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Lock } from 'lucide-react';

export function SafetyBoundaryCard() {
  return (
    <Card className="border border-[hsl(var(--warning-border))] bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning-fg))] shadow-xs rounded-md">
      <CardContent className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-2.5">
          <div className="w-8 h-8 rounded-sm bg-[hsl(var(--warning-bg))] border border-[hsl(var(--warning-border))] flex items-center justify-center shrink-0 text-[hsl(var(--warning-fg))]">
            <Lock className="h-4 w-4" />
          </div>
          <div className="space-y-0.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-medium [font-family:var(--font-display)] text-[hsl(var(--warning-fg))] text-sm">
                Human-Only Send Boundary Active
              </span>
              <Badge
                variant="warning"
                className="text-[10px] px-1.5 py-0.5"
              >
                Human-Only Send Mode
              </Badge>
            </div>
            <p className="text-xs text-[hsl(var(--warning-fg))]/90 leading-relaxed">
              Zero automated messaging. Pipeline only gathers intelligence and synthesizes opportunities. All outreach requires operator approval and manual dispatch.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-xs font-medium shrink-0 px-2.5 py-1 rounded-sm border border-[hsl(var(--warning-border))] bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning-fg))]">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Safety Gate Enforced</span>
        </div>
      </CardContent>
    </Card>
  );
}
