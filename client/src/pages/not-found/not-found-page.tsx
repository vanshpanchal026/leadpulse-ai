import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full border-border/80 bg-card/70 text-center p-6">
        <CardContent className="space-y-4 pt-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning-fg))]">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold [font-family:var(--font-display)] tracking-tight text-foreground">
              404 — Page Not Found
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              The path you requested does not exist within the LeadPulse AI V2 Command Center.
            </p>
          </div>
          <Button asChild size="sm" className="mt-2">
            <Link to="/" className="flex items-center gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              Return to Dashboard
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
