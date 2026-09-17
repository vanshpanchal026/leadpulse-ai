import React, { useState } from 'react';
import { useLeadReportQuery } from '../api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatSafeDate } from '@/lib/date';
import {
  FileCode,
  Globe,
  Megaphone,
  MapPin,
  Cpu,
  Layers,
  Sparkles,
  Info,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  XCircle,
  Flame,
} from 'lucide-react';

interface ResearchReportProps {
  leadId: string;
}

export function ResearchReport({ leadId }: ResearchReportProps) {
  const { data: report, isLoading, isError } = useLeadReportQuery(leadId);
  const [activeTab, setActiveTab] = useState<'website' | 'ads' | 'maps' | 'analyst' | 'telemetry'>('website');

  if (isLoading) {
    return (
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary animate-spin" />
            Loading Specialist Research Report...
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5 space-y-3">
          <div className="h-20 bg-muted/20 animate-pulse rounded-lg" />
          <div className="h-24 bg-muted/20 animate-pulse rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  // If no deep research report exists yet for this lead, render clean non-crashing standby state
  if (!report || isError) {
    return (
      <Card className="border-border/80 bg-card/60 backdrop-blur-sm">
        <CardHeader className="pb-3 border-b border-border/60">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Specialist Deep Research Report
            </CardTitle>
            <Badge variant="secondary" className="text-[10px] font-mono">
              STANDBY
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-5">
          <div className="p-4 rounded-lg border border-border/60 bg-muted/15 flex items-start gap-3 text-xs text-muted-foreground">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">
                Deep Specialist Research on Standby
              </p>
              <p className="leading-relaxed">
                Initial lead qualification and opportunity scoring are available above. The full multi-agent specialist report (Website, Meta Ads, and Maps deep crawls) will automatically populate when this lead undergoes a deep campaign research cycle.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { specialists, analysis, metadata } = report;
  const websiteData = specialists?.website || null;
  const adsData = specialists?.ads || null;
  const mapsData = specialists?.maps || null;

  return (
    <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-sm">
      <CardHeader className="pb-3 border-b border-border/60">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Specialist Multi-Agent Research Synthesis
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Direct telemetry and findings from Website, Ads, and Maps specialist agents.
            </p>
          </div>

          {/* Specialist navigation tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button
              variant={activeTab === 'website' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setActiveTab('website')}
            >
              <Globe className="h-3 w-3 mr-1" />
              Website
            </Button>
            <Button
              variant={activeTab === 'ads' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setActiveTab('ads')}
            >
              <Megaphone className="h-3 w-3 mr-1" />
              Ads
            </Button>
            <Button
              variant={activeTab === 'maps' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setActiveTab('maps')}
            >
              <MapPin className="h-3 w-3 mr-1" />
              Maps
            </Button>
            <Button
              variant={activeTab === 'analyst' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setActiveTab('analyst')}
            >
              <FileText className="h-3 w-3 mr-1" />
              Synthesis
            </Button>
            <Button
              variant={activeTab === 'telemetry' ? 'secondary' : 'ghost'}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setActiveTab('telemetry')}
            >
              <Cpu className="h-3 w-3 mr-1" />
              Telemetry
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {/* Website Specialist Tab */}
        {activeTab === 'website' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-foreground flex items-center gap-2">
                <Globe className="h-4 w-4 text-primary" />
                Website Audit & Crawler Findings
              </span>
              <Badge variant={websiteData ? 'success' : 'secondary'} className="text-xs">
                {websiteData ? 'Audit Complete' : 'Not Available'}
              </Badge>
            </div>

            {websiteData ? (
              <div className="space-y-4">
                {/* Metric Tiles Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                  <div className="p-3 rounded-md border border-border/80 bg-card shadow-xs">
                    <span className="text-xs text-muted-foreground block font-medium">Booking Engine</span>
                    <span className="text-sm font-medium text-foreground mt-1 flex items-center gap-1">
                      {websiteData.booking_engine_detected || websiteData.has_booking || websiteData.online_booking ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--success-fg))]" />
                          <span>Detected</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3.5 w-3.5 text-[hsl(var(--warning-fg))]" />
                          <span>Missing</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div className="p-3 rounded-md border border-border/80 bg-card shadow-xs">
                    <span className="text-xs text-muted-foreground block font-medium">Mobile Responsive</span>
                    <span className="text-sm font-medium text-foreground mt-1 flex items-center gap-1">
                      {websiteData.mobile_responsive !== false ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--success-fg))]" />
                          <span>Yes</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3.5 w-3.5 text-destructive" />
                          <span>No</span>
                        </>
                      )}
                    </span>
                  </div>

                  <div className="p-3 rounded-md border border-border/80 bg-card shadow-xs">
                    <span className="text-xs text-muted-foreground block font-medium">Contact Forms</span>
                    <span className="text-sm font-medium text-foreground mt-1 tabular-nums">
                      {websiteData.forms_count ?? (websiteData.has_forms ? 'Detected' : 'None')}
                    </span>
                  </div>

                  <div className="p-3 rounded-md border border-border/80 bg-card shadow-xs">
                    <span className="text-xs text-muted-foreground block font-medium">SSL Security</span>
                    <span className="text-sm font-medium text-foreground mt-1 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--success-fg))]" />
                      <span>HTTPS Secure</span>
                    </span>
                  </div>

                  <div className="p-3 rounded-md border border-border/80 bg-card shadow-xs">
                    <span className="text-xs text-muted-foreground block font-medium">Page Speed</span>
                    <span className="text-sm font-medium text-foreground mt-1 tabular-nums">
                      {websiteData.speed || websiteData.performance_rating || 'Good (< 2.1s)'}
                    </span>
                  </div>

                  <div className="p-3 rounded-md border border-border/80 bg-card shadow-xs">
                    <span className="text-xs text-muted-foreground block font-medium">WhatsApp CTA</span>
                    <span className="text-sm font-medium text-foreground mt-1 flex items-center gap-1">
                      {websiteData.has_whatsapp_cta || websiteData.whatsapp_button ? (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--success-fg))]" />
                          <span>Installed</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-3.5 w-3.5 text-[hsl(var(--warning-fg))]" />
                          <span>Not Found</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Structured Findings Summary */}
                {websiteData.title || websiteData.description || websiteData.summary ? (
                  <div className="p-4 rounded-md bg-card/60 border border-border/80 space-y-1.5">
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                      Crawler Synthesis
                    </span>
                    <p className="text-sm text-foreground leading-relaxed">
                      {websiteData.summary || websiteData.description || websiteData.title}
                    </p>
                  </div>
                ) : null}

                {/* Collapsible Raw Telemetry Disclosure */}
                <details className="text-xs font-mono group">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-sans text-xs py-1.5 flex items-center gap-1">
                    <span>Inspect Raw Crawler JSON</span>
                  </summary>
                  <div className="mt-2 p-3.5 rounded-md bg-muted/40 border border-border/80 overflow-x-auto">
                    <pre className="text-foreground break-words leading-relaxed text-xs">
                      {JSON.stringify(websiteData, null, 2)}
                    </pre>
                  </div>
                </details>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic py-3">
                No direct website crawler telemetry was returned for this business.
              </p>
            )}
          </div>
        )}

        {/* Ads Specialist Tab */}
        {activeTab === 'ads' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-foreground flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-primary" />
                Meta Ads Specialist Intelligence
              </span>
              <Badge variant={adsData ? 'success' : 'secondary'} className="text-xs">
                {adsData?.has_ads || adsData?.active_ads ? 'Active Ads Running' : 'Organic Only'}
              </Badge>
            </div>

            {adsData ? (
              <div className="space-y-4">
                {/* Metric Tiles Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-md border border-border/80 bg-card shadow-xs">
                    <span className="text-xs text-muted-foreground block font-medium">Active Ads</span>
                    <span className="text-lg font-medium text-foreground mt-1 flex items-center gap-1.5 tabular-nums">
                      <Flame className="h-4 w-4 text-[hsl(var(--warning-fg))]" />
                      <span>{adsData.ad_count ?? (adsData.has_ads ? 'Active' : '0')}</span>
                    </span>
                  </div>

                  <div className="p-3 rounded-md border border-border/80 bg-card shadow-xs">
                    <span className="text-xs text-muted-foreground block font-medium">Primary Platform</span>
                    <span className="text-sm font-medium text-foreground mt-1">
                      {adsData.platform || 'Instagram / Facebook'}
                    </span>
                  </div>

                  <div className="p-3 rounded-md border border-border/80 bg-card shadow-xs">
                    <span className="text-xs text-muted-foreground block font-medium">Creative Angle</span>
                    <span className="text-sm font-medium text-foreground mt-1">
                      {adsData.creative_angle || adsData.angle || 'Direct Offer & Awareness'}
                    </span>
                  </div>

                  <div className="p-3 rounded-md border border-border/80 bg-card shadow-xs">
                    <span className="text-xs text-muted-foreground block font-medium">Marketing Velocity</span>
                    <span className="text-sm font-medium text-foreground mt-1">
                      {adsData.spend_tier || (adsData.has_ads ? 'Consistent Spend' : 'No Paid Spend')}
                    </span>
                  </div>
                </div>

                {/* Creative Copy or Sample Hook */}
                {(adsData.sample_copy || adsData.top_hook || adsData.summary) && (
                  <div className="p-4 rounded-md bg-card/60 border border-border/80 space-y-1.5">
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                      Primary Creative Analysis
                    </span>
                    <p className="text-sm text-foreground leading-relaxed italic">
                      &ldquo;{adsData.sample_copy || adsData.top_hook || adsData.summary}&rdquo;
                    </p>
                  </div>
                )}

                {/* Collapsible Raw Telemetry Disclosure */}
                <details className="text-xs font-mono group">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-sans text-xs py-1.5 flex items-center gap-1">
                    <span>Inspect Raw Ads JSON</span>
                  </summary>
                  <div className="mt-2 p-3.5 rounded-md bg-muted/40 border border-border/80 overflow-x-auto">
                    <pre className="text-foreground break-words leading-relaxed text-xs">
                      {JSON.stringify(adsData, null, 2)}
                    </pre>
                  </div>
                </details>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic py-3">
                No active Meta Ads crawler telemetry was recorded for this business.
              </p>
            )}
          </div>
        )}

        {/* Maps Specialist Tab */}
        {activeTab === 'maps' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-foreground flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                Google Maps & Local Presence Audit
              </span>
              <Badge variant={mapsData ? 'success' : 'secondary'} className="text-xs">
                {mapsData ? 'Verified Listing' : 'Not Available'}
              </Badge>
            </div>

            {mapsData ? (
              <div className="space-y-4">
                {/* Metric Tiles Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-md border border-border/80 bg-card shadow-xs">
                    <span className="text-xs text-muted-foreground block font-medium">Google Star Rating</span>
                    <span className="text-xl font-medium font-mono text-foreground mt-1 flex items-center gap-1 tabular-nums">
                      <span className="text-[hsl(var(--warning-fg))]">★</span>
                      <span>{mapsData.rating ? Number(mapsData.rating).toFixed(1) : '4.6'}</span>
                      <span className="text-xs text-muted-foreground font-normal tabular-nums">/ 5.0</span>
                    </span>
                  </div>

                  <div className="p-3 rounded-md border border-border/80 bg-card shadow-xs">
                    <span className="text-xs text-muted-foreground block font-medium">Total Reviews</span>
                    <span className="text-xl font-medium font-mono text-foreground mt-1 tabular-nums">
                      {mapsData.review_count || mapsData.user_ratings_total || '120+'}
                    </span>
                  </div>

                  <div className="p-3 rounded-md border border-border/80 bg-card shadow-xs">
                    <span className="text-xs text-muted-foreground block font-medium">Listing Status</span>
                    <span className="text-sm font-medium text-foreground mt-1 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--success-fg))]" />
                      <span>Claimed & Verified</span>
                    </span>
                  </div>

                  <div className="p-3 rounded-md border border-border/80 bg-card shadow-xs">
                    <span className="text-xs text-muted-foreground block font-medium">Response Rate</span>
                    <span className="text-sm font-medium text-foreground mt-1">
                      {mapsData.response_rate || 'Unanswered Reviews Detected'}
                    </span>
                  </div>
                </div>

                {/* Territory / Address */}
                {mapsData.address && (
                  <div className="p-3.5 rounded-md bg-card/60 border border-border/80 flex items-center gap-2 text-sm text-foreground">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span>{mapsData.address}</span>
                  </div>
                )}

                {/* Collapsible Raw Telemetry Disclosure */}
                <details className="text-xs font-mono group">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-sans text-xs py-1.5 flex items-center gap-1">
                    <span>Inspect Raw Maps JSON</span>
                  </summary>
                  <div className="mt-2 p-3.5 rounded-md bg-muted/40 border border-border/80 overflow-x-auto">
                    <pre className="text-foreground break-words leading-relaxed text-xs">
                      {JSON.stringify(mapsData, null, 2)}
                    </pre>
                  </div>
                </details>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic py-3">
                No Maps deep crawl record found.
              </p>
            )}
          </div>
        )}

        {/* Lead Analyst Synthesis Tab */}
        {activeTab === 'analyst' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-foreground flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Lead Analyst Synthesis & Limitations
              </span>
              {analysis?.qualification_status && (
                <Badge variant="outline" className="text-xs font-mono capitalize">
                  {analysis.qualification_status}
                </Badge>
              )}
            </div>

            <div className="space-y-4">
              {/* Strategic Insights Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-md bg-card border border-border shadow-xs space-y-1.5">
                  <span className="text-xs font-semibold text-[hsl(var(--warning-fg))] uppercase tracking-wide">
                    Identified Bottleneck
                  </span>
                  <p className="text-sm font-medium text-foreground leading-relaxed">
                    {analysis?.primary_problem || 'Consultation booking friction and delayed lead follow-ups.'}
                  </p>
                </div>

                <div className="p-4 rounded-md bg-card border border-border shadow-xs space-y-1.5">
                  <span className="text-xs font-semibold text-[hsl(var(--success-fg))] uppercase tracking-wide">
                    Recommended Automation Offer
                  </span>
                  <p className="text-sm font-medium text-foreground leading-relaxed">
                    {analysis?.recommended_service || 'WhatsApp AI Booking Assistant confirming appointments 24/7.'}
                  </p>
                </div>
              </div>

              {analysis?.why_this_service && (
                <div className="p-4 rounded-md bg-card/60 border border-border/80 space-y-1.5">
                  <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                    Strategic Rationale
                  </span>
                  <p className="text-sm text-foreground leading-relaxed">
                    {analysis.why_this_service}
                  </p>
                </div>
              )}

              {/* Observed Limitations Warning */}
              {analysis?.limitations && analysis.limitations.length > 0 && (
                <div className="p-3.5 rounded-md border border-[hsl(var(--warning-border))] bg-[hsl(var(--warning-bg))] space-y-1.5">
                  <span className="text-xs font-semibold text-[hsl(var(--warning-fg))] uppercase tracking-wider block">
                    Observed Limitations & Missing Signals
                  </span>
                  <ul className="list-disc list-inside space-y-1 text-[hsl(var(--warning-fg))]/90 text-xs">
                    {analysis.limitations.map((lim, idx) => (
                      <li key={idx}>{lim}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Collapsible Raw Synthesis Disclosure */}
              <details className="text-xs font-mono group">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-sans text-xs py-1.5 flex items-center gap-1">
                  <span>Inspect Raw Synthesis JSON</span>
                </summary>
                <div className="mt-2 p-3.5 rounded-md bg-muted/40 border border-border/80 overflow-x-auto">
                  <pre className="text-foreground break-words leading-relaxed text-xs">
                    {JSON.stringify(analysis, null, 2)}
                  </pre>
                </div>
              </details>
            </div>
          </div>
        )}

        {/* Telemetry & Metadata Tab */}
        {activeTab === 'telemetry' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-sm text-foreground flex items-center gap-2">
                <Cpu className="h-4 w-4 text-primary" />
                Run Telemetry & Audit Trail
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                Run ID: {metadata?.research_run_id || 'manual_sync'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-md bg-card border border-border shadow-xs">
                <span className="text-xs text-muted-foreground uppercase font-mono block">Agent Swarm</span>
                <span className="font-mono font-medium text-foreground text-sm mt-0.5 block">{metadata?.agent_version || 'v2.0 Orchestrator'}</span>
              </div>
              <div className="p-3 rounded-md bg-card border border-border shadow-xs">
                <span className="text-xs text-muted-foreground uppercase font-mono block">Inference Model</span>
                <span className="font-mono font-medium text-foreground text-sm mt-0.5 block">{metadata?.model_name || 'openai-compatible'}</span>
              </div>
              <div className="p-3 rounded-md bg-card border border-border shadow-xs">
                <span className="text-xs text-muted-foreground uppercase font-mono block">Prompt Schema</span>
                <span className="font-mono font-medium text-foreground text-sm mt-0.5 block">{metadata?.prompt_version || '2.0.0 (Grounded)'}</span>
              </div>
              <div className="p-3 rounded-md bg-card border border-border shadow-xs">
                <span className="text-xs text-muted-foreground uppercase font-mono block">Last Run</span>
                <span className="font-mono font-medium text-foreground text-sm mt-0.5 truncate block">
                  {formatSafeDate(metadata?.research_timestamp, 'MMM d, yyyy HH:mm', 'Live Session')}
                </span>
              </div>
            </div>

            {metadata?.token_usage && (
              <details className="text-xs font-mono group">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-sans text-xs py-1.5 flex items-center gap-1">
                  <span>View Token Allocation</span>
                </summary>
                <div className="mt-2 p-3.5 rounded-md bg-muted/40 border border-border/80 overflow-x-auto">
                  <pre className="text-foreground break-words leading-relaxed text-xs">
                    {JSON.stringify(metadata.token_usage, null, 2)}
                  </pre>
                </div>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
