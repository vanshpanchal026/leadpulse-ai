import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Lock, AlertTriangle } from 'lucide-react';

export function SafetyBoundaryBanner() {
  return (
    <Card className="border border-[hsl(var(--success-border))] bg-[hsl(var(--success-bg))] text-[hsl(var(--success-fg))] shadow-xs rounded-md">
      <CardContent className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-sm bg-[hsl(var(--success-bg))] border border-[hsl(var(--success-border))] text-[hsl(var(--success-fg))] shrink-0 mt-0.5">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-medium [font-family:var(--font-display)] text-[hsl(var(--success-fg))]">
                Safety Boundary: Human-Only Send Mode Active
              </h4>
              <Badge variant="success" className="text-xs">
                Human Approval Gate Active
              </Badge>
            </div>
            <p className="text-[hsl(var(--success-fg))]/90 text-xs leading-relaxed">
              Approving a draft does not send external messages. External sending remains manual. The platform strictly enforces zero automated WhatsApp, email, or DM dispatch.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-[hsl(var(--success-fg))] shrink-0 bg-[hsl(var(--success-bg))] px-3 py-1.5 rounded-sm border border-[hsl(var(--success-border))]">
          <Lock className="h-3.5 w-3.5" />
          <span>Manual Send Only</span>
        </div>
      </CardContent>
    </Card>
  );
}
