import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Inbox, FileText, FilterX, Search } from 'lucide-react';

interface OutreachEmptyStateProps {
  title?: string;
  description?: string;
  icon?: 'queue' | 'detail' | 'filter' | 'search';
  action?: React.ReactNode;
}

export function OutreachEmptyState({
  title = 'No outreach items',
  description = 'No outreach drafts match your selected criteria.',
  icon = 'queue',
  action,
}: OutreachEmptyStateProps) {
  const renderIcon = () => {
    switch (icon) {
      case 'detail':
        return <FileText className="h-8 w-8 text-muted-foreground/60" />;
      case 'filter':
        return <FilterX className="h-8 w-8 text-muted-foreground/60" />;
      case 'search':
        return <Search className="h-8 w-8 text-muted-foreground/60" />;
      case 'queue':
      default:
        return <Inbox className="h-8 w-8 text-muted-foreground/60" />;
    }
  };

  return (
    <Card className="border-border/80 bg-card/40 border-dashed">
      <CardContent className="p-8 text-center flex flex-col items-center justify-center space-y-3">
        <div className="p-3 rounded-full bg-muted/20 border border-border/50">
          {renderIcon()}
        </div>
        <div className="space-y-1 max-w-sm">
          <h4 className="text-sm font-semibold text-foreground">{title}</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>
        {action && <div className="pt-1">{action}</div>}
      </CardContent>
    </Card>
  );
}
