import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, Clock, UserCheck, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { OutreachHistoryItem } from '../types';

interface OutreachHistoryProps {
  history?: OutreachHistoryItem[];
}

export function OutreachHistory({ history = [] }: OutreachHistoryProps) {
  return (
    <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-sm">
      <CardHeader className="pb-2.5 border-b border-border/60">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 text-muted-foreground">
            <History className="h-3.5 w-3.5 text-primary" />
            Outreach Review History
          </CardTitle>
          <Badge variant="outline" className="font-mono text-[9px]">
            {history.length} {history.length === 1 ? 'Record' : 'Records'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-3">
        {history.length === 0 ? (
          <div className="py-4 text-center">
            <p className="text-xs text-muted-foreground italic font-sans">
              No outreach history available.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {history.map((item) => (
              <div
                key={item.id}
                className="p-2.5 rounded-md bg-muted/20 border border-border/60 text-xs space-y-1 font-sans"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <Badge variant="outline" className="text-[9px] font-mono px-1 py-0">
                      {item.channel}
                    </Badge>
                    <span className="font-semibold text-foreground capitalize">
                      {item.action.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {item.timestamp ? new Date(item.timestamp).toLocaleString() : 'Recent'}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <UserCheck className="h-3 w-3" />
                    Reviewer: {item.reviewer}
                  </span>
                </div>

                {item.notes && (
                  <p className="text-[11px] text-zinc-300 bg-black/20 p-1.5 rounded border border-border/40 font-mono">
                    {item.notes}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
