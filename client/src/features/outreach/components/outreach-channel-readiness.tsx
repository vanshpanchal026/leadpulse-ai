import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Phone,
  Mail,
  Globe,
  CheckCircle2,
  XCircle,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';

interface ChannelReadinessProps {
  phone: string | null;
  websiteUrl: string | null;
  instagramUrl: string | null;
}

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

export function OutreachChannelReadiness({
  phone,
  websiteUrl,
  instagramUrl,
}: ChannelReadinessProps) {
  const hasPhone = Boolean(phone && phone.trim());
  const hasWebsite = Boolean(websiteUrl && websiteUrl.trim());
  const hasInstagram = Boolean(instagramUrl && instagramUrl.trim());

  return (
    <Card className="border-border/80 bg-card/60 backdrop-blur-sm shadow-sm">
      <CardHeader className="pb-2.5 border-b border-border/60">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5 text-primary" />
            Outreach Channel Readiness (Manual Dispatch Only)
          </CardTitle>
          <Badge variant="outline" className="text-[9px] font-mono">
            No Auto-Send
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-3 grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
        {/* WhatsApp Channel */}
        <div className="p-2.5 rounded-md border border-border/60 bg-muted/15 space-y-1">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 font-semibold text-[11px] text-foreground">
              <Phone className="h-3 w-3 text-muted-foreground" />
              WhatsApp
            </span>
            {hasPhone ? (
              <Badge variant="success" className="text-[8px] px-1 py-0 font-mono">
                Available
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[8px] px-1 py-0 font-mono">
                Missing
              </Badge>
            )}
          </div>
          <div className="font-mono text-[11px] text-foreground truncate tabular-nums">
            {phone || 'Unknown'}
          </div>
          <span className="text-[9px] text-muted-foreground block font-mono">
            Mode: Manual copy
          </span>
        </div>

        {/* Website Contact Form */}
        <div className="p-2.5 rounded-md border border-border/60 bg-muted/15 space-y-1">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 font-semibold text-[11px] text-foreground">
              <Globe className="h-3 w-3 text-muted-foreground" />
              Website Form
            </span>
            {hasWebsite ? (
              <Badge variant="success" className="text-[8px] px-1 py-0 font-mono">
                Available
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[8px] px-1 py-0 font-mono">
                Missing
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-foreground truncate">
            {websiteUrl ? (
              <a
                href={websiteUrl.startsWith('http') ? websiteUrl : `https://${websiteUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline text-primary flex items-center gap-0.5 truncate"
              >
                <span>Visit site</span>
                <ExternalLink className="h-2.5 w-2.5 shrink-0" />
              </a>
            ) : (
              'Unknown'
            )}
          </div>
          <span className="text-[9px] text-muted-foreground block font-mono">
            Mode: Manual entry
          </span>
        </div>

        {/* Instagram DM */}
        <div className="p-2.5 rounded-md border border-border/60 bg-muted/15 space-y-1">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 font-semibold text-[11px] text-foreground">
              <InstagramIcon className="h-3 w-3 text-muted-foreground" />
              Instagram DM
            </span>
            {hasInstagram ? (
              <Badge variant="success" className="text-[8px] px-1 py-0 font-mono">
                Available
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[8px] px-1 py-0 font-mono">
                Missing
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-foreground truncate">
            {instagramUrl ? (
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:underline text-primary flex items-center gap-0.5 truncate"
              >
                <span>Profile</span>
                <ExternalLink className="h-2.5 w-2.5 shrink-0" />
              </a>
            ) : (
              'Unknown'
            )}
          </div>
          <span className="text-[9px] text-muted-foreground block font-mono">
            Mode: Manual DM
          </span>
        </div>

        {/* Direct Email */}
        <div className="p-2.5 rounded-md border border-border/60 bg-muted/15 space-y-1">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1 font-semibold text-[11px] text-foreground">
              <Mail className="h-3 w-3 text-muted-foreground" />
              Email
            </span>
            <Badge variant="secondary" className="text-[8px] px-1 py-0 font-mono">
              Unknown
            </Badge>
          </div>
          <div className="text-[11px] text-muted-foreground italic truncate">
            Not scraped
          </div>
          <span className="text-[9px] text-muted-foreground block font-mono">
            Mode: Manual
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
