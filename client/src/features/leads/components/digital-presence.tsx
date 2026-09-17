import React from 'react';
import { NormalizedLead } from '../types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Globe,
  MapPin,
  Megaphone,
  Phone,
  ExternalLink,
  CheckCircle2,
  XCircle,
  MessageSquare,
} from 'lucide-react';

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

interface DigitalPresenceProps {
  lead: NormalizedLead;
}

export function DigitalPresence({ lead }: DigitalPresenceProps) {
  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="pb-3 border-b border-border">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          Digital Presence & Marketing Footprint
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Website Card */}
        <div className="p-3.5 rounded-md border border-border/70 bg-card/60 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                Website
              </span>
              {lead.hasWebsite ? (
                <Badge variant="success" className="text-xs px-2 py-0.2">
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs px-2 py-0.2">
                  Missing
                </Badge>
              )}
            </div>
            <div className="text-xs font-medium text-foreground truncate" title={lead.websiteUrl || 'No website'}>
              {lead.websiteUrl ? (
                <a
                  href={lead.websiteUrl.startsWith('http') ? lead.websiteUrl : `https://${lead.websiteUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline flex items-center gap-1 text-primary"
                >
                  <span className="truncate">{lead.websiteUrl.replace(/^https?:\/\/(www\.)?/, '')}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              ) : (
                <span className="text-muted-foreground italic">No official website</span>
              )}
            </div>
          </div>
        </div>

        {/* Google Maps Card */}
        <div className="p-3.5 rounded-md border border-border/70 bg-card/60 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                Google Maps
              </span>
              {lead.googleMapsUrl ? (
                <Badge variant="success" className="text-xs px-2 py-0.2">
                  Verified
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs px-2 py-0.2">
                  Listed
                </Badge>
              )}
            </div>
            <div className="text-xs">
              <div className="flex items-baseline gap-1 text-foreground font-medium tabular-nums">
                <span>{lead.rating ? `★ ${lead.rating.toFixed(1)}` : '★ Unrated'}</span>
                <span className="text-muted-foreground font-normal text-xs tabular-nums">
                  ({lead.reviewCount} reviews)
                </span>
              </div>
              {lead.googleMapsUrl && (
                <a
                  href={lead.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-0.5 mt-0.5"
                >
                  View Profile <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Meta Ads Card */}
        <div className="p-3.5 rounded-md border border-border/70 bg-card/60 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span className="flex items-center gap-1.5">
                <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
                Meta Ads
              </span>
              {lead.hasActiveAds ? (
                <Badge variant="success" className="text-xs px-2 py-0.2">
                  Active
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs px-2 py-0.2">
                  Inactive
                </Badge>
              )}
            </div>
            <div className="text-xs font-medium text-foreground">
              {lead.hasActiveAds ? (
                <span className="text-[hsl(var(--success-fg))] font-medium flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Active Ad Campaigns
                </span>
              ) : (
                <span className="text-muted-foreground italic">No active ads detected</span>
              )}
            </div>
          </div>
        </div>

        {/* Instagram Card */}
        <div className="p-3.5 rounded-md border border-border/70 bg-card/60 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span className="flex items-center gap-1.5">
                <InstagramIcon className="h-3.5 w-3.5 text-muted-foreground" />
                Instagram
              </span>
              {lead.instagramUrl ? (
                <Badge variant="success" className="text-xs px-2 py-0.2">
                  Linked
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs px-2 py-0.2">
                  None
                </Badge>
              )}
            </div>
            <div className="text-xs font-medium text-foreground truncate">
              {lead.instagramUrl ? (
                <a
                  href={lead.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline flex items-center gap-1 text-primary"
                >
                  <span className="truncate">View Instagram</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              ) : (
                <span className="text-muted-foreground italic">Not connected</span>
              )}
            </div>
          </div>
        </div>

        {/* Phone / WhatsApp Card */}
        <div className="p-3.5 rounded-md border border-border/70 bg-card/60 flex flex-col justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
              <span className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                Phone / WhatsApp
              </span>
              {lead.phone ? (
                <Badge variant="outline" className="text-xs px-2 py-0.2 font-mono">
                  Direct
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs px-2 py-0.2">
                  None
                </Badge>
              )}
            </div>
            <div className="text-xs font-mono text-foreground truncate tabular-nums">
              {lead.phone ? (
                <span className="font-medium text-foreground">{lead.phone}</span>
              ) : (
                <span className="text-muted-foreground italic font-sans">Not listed</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
