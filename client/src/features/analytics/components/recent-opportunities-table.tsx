import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { NormalizedLead } from '@/features/leads/types';
import { ArrowUpRight, TrendingUp, ExternalLink, Eye } from 'lucide-react';
import { formatPercent } from '@/lib/utils';

interface RecentOpportunitiesTableProps {
  leads: NormalizedLead[];
  limit?: number;
}

export function RecentOpportunitiesTable({ leads, limit = 6 }: RecentOpportunitiesTableProps) {
  const highValueLeads = useMemo(() => {
    return [...leads]
      .sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0))
      .slice(0, limit);
  }, [leads, limit]);

  return (
    <Card className="bg-card/70 border-border/80">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-medium [font-family:var(--font-display)] flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span>Recent High-Value Opportunities</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Priority targets with synthesized conversion problems and ready-to-pitch automation offers.
          </CardDescription>
        </div>
        <Button asChild variant="ghost" size="sm" className="text-xs h-7 gap-1">
          <Link to="/leads">
            <span>View All Leads</span>
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-border text-[11px] font-mono uppercase text-muted-foreground">
                <th className="py-2.5 px-3">Business</th>
                <th className="py-2.5 px-3">Opportunity Score</th>
                <th className="py-2.5 px-3">Priority</th>
                <th className="py-2.5 px-3">Recommended Service</th>
                <th className="py-2.5 px-3">Primary Problem</th>
                <th className="py-2.5 px-3">Confidence</th>
                <th className="py-2.5 px-3">Research Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {highValueLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-muted-foreground">
                    No leads discovered yet. Run a research campaign to populate.
                  </td>
                </tr>
              ) : (
                highValueLeads.map((lead) => {
                  const score = lead.opportunityScore ?? 0;
                  const scoreClass =
                    score >= 80
                      ? 'bg-[hsl(var(--info-bg))] text-[hsl(var(--info-fg))] border-[hsl(var(--info-border))]'
                      : score >= 40
                      ? 'bg-secondary text-muted-foreground border-border'
                      : 'bg-secondary text-[hsl(var(--disabled))] border-border';

                  return (
                    <tr
                      key={lead.id}
                      className="hover:bg-secondary/60 transition-colors group"
                    >
                      <td className="py-2.5 px-3 font-medium text-foreground">
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-foreground group-hover:text-[hsl(var(--primary))] transition-colors truncate">
                            {lead.name}
                          </span>
                          <span className="text-[10px] text-muted-foreground truncate">
                            {lead.category || 'Local Business'} • {lead.location}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[11px] font-mono font-medium border tabular-nums ${scoreClass}`}
                        >
                          {score}/100
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={lead.opportunityTier === 'Immediate' ? 'info' : 'secondary'}
                          className="text-[10px] font-medium"
                        >
                          {lead.opportunityTier}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-medium text-foreground">
                          {lead.recommendedService}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 max-w-[200px] truncate text-muted-foreground" title={lead.primaryProblem || ''}>
                        {lead.primaryProblem || 'Booking friction & manual follow-ups'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-xs text-muted-foreground tabular-nums">
                        {formatPercent(lead.confidenceScore)}
                      </td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant={lead.researchStatus === 'complete' ? 'success' : 'secondary'}
                          className="text-xs"
                        >
                          {lead.researchStatus}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="h-7 px-2 text-xs font-medium gap-1.5"
                          aria-label={`View Profile for ${lead.name}`}
                        >
                          <Link to={`/leads/${lead.id}`}>
                            <Eye className="h-3.5 w-3.5" />
                            <span>View Profile</span>
                          </Link>
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
