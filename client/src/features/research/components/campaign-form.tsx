import React, { useState } from 'react';
import { CampaignFormData, SpecialistType, ResearchDepth } from '../types';
import { CampaignConfigSchema } from '../schema';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Settings2,
  Play,
  MapPin,
  Building2,
  Layers,
  Globe,
  Megaphone,
  CheckSquare,
  Square,
  Sparkles,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface CampaignFormProps {
  onSubmit: (data: CampaignFormData) => void;
  isRunning: boolean;
}

const LOCATION_PRESETS = ['South Delhi', 'Gurgaon', 'Noida', 'Delhi NCR'];
const VERTICAL_PRESETS = ['Dermatology', 'Dental Clinic', 'MedSpa', 'Luxury Salon'];

export function CampaignForm({ onSubmit, isRunning }: CampaignFormProps) {
  const [campaignName, setCampaignName] = useState('Delhi Aesthetic & Laser Q3');
  const [location, setLocation] = useState('South Delhi');
  const [vertical, setVertical] = useState('Dermatology & Aesthetics');
  const [leadLimit, setLeadLimit] = useState<number>(15);
  const [researchDepth, setResearchDepth] = useState<ResearchDepth>('deep');
  const [enabledSpecialists, setEnabledSpecialists] = useState<SpecialistType[]>([
    'website',
    'ads',
    'maps',
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggleSpecialist = (type: SpecialistType) => {
    if (enabledSpecialists.includes(type)) {
      if (enabledSpecialists.length <= 1) return; // Must keep at least one
      setEnabledSpecialists(enabledSpecialists.filter((s) => s !== type));
    } else {
      setEnabledSpecialists([...enabledSpecialists, type]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRunning) return;

    const data: CampaignFormData = {
      campaignName: campaignName.trim(),
      location: location.trim(),
      vertical: vertical.trim(),
      leadLimit: Number(leadLimit),
      researchDepth,
      enabledSpecialists,
    };

    const result = CampaignConfigSchema.safeParse(data);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const fieldName = issue.path[0] as string;
        fieldErrors[fieldName] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    onSubmit(data);
  };

  return (
    <Card className="border-border bg-card shadow-xs rounded-md">
      <CardHeader className="pb-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium [font-family:var(--font-display)] flex items-center gap-2 text-foreground">
              <Settings2 className="h-4 w-4 text-muted-foreground" />
              Campaign Configuration Panel
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Configure search strategist targets, seed verticals, and specialist execution limits.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="text-[10px] font-mono">
            Bounded Autonomy
          </Badge>
        </div>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="pt-4 space-y-4 text-xs">
          {/* Campaign Name */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <span>Campaign Identifier</span>
              {errors.campaignName && (
                <span className="text-destructive font-sans lowercase text-[10px]">
                  ({errors.campaignName})
                </span>
              )}
            </label>
            <input
              type="text"
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              disabled={isRunning}
              placeholder="e.g. South Delhi Laser Clinics"
              className="w-full h-8 px-3 rounded-md bg-secondary border border-border text-foreground text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50"
            />
          </div>

          {/* Location & Vertical Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Location Input & Presets */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3 text-muted-foreground" />
                <span>Target Geography</span>
                {errors.location && (
                  <span className="text-destructive font-sans lowercase text-[10px]">
                    ({errors.location})
                  </span>
                )}
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                disabled={isRunning}
                placeholder="e.g. South Delhi, Gurgaon"
                className="w-full h-8 px-3 rounded-md bg-secondary border border-border text-foreground text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50"
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {LOCATION_PRESETS.map((loc) => (
                  <button
                    key={loc}
                    type="button"
                    disabled={isRunning}
                    onClick={() => setLocation(loc)}
                    className="text-[10px] px-1.5 py-0.5 rounded-sm bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border"
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>

            {/* Vertical Input & Presets */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Building2 className="h-3 w-3 text-muted-foreground" />
                <span>Seed Vertical / Niche</span>
                {errors.vertical && (
                  <span className="text-destructive font-sans lowercase text-[10px]">
                    ({errors.vertical})
                  </span>
                )}
              </label>
              <input
                type="text"
                value={vertical}
                onChange={(e) => setVertical(e.target.value)}
                disabled={isRunning}
                placeholder="e.g. Dermatology, Dental Clinic"
                className="w-full h-8 px-3 rounded-md bg-secondary border border-border text-foreground text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50"
              />
              <div className="flex flex-wrap gap-1 pt-1">
                {VERTICAL_PRESETS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    disabled={isRunning}
                    onClick={() => setVertical(v)}
                    className="text-[10px] px-1.5 py-0.5 rounded-sm bg-secondary hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Limits & Depth Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Lead Limit */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Max Candidates ({leadLimit})
              </label>
              <input
                type="range"
                min="5"
                max="50"
                step="5"
                value={leadLimit}
                onChange={(e) => setLeadLimit(Number(e.target.value))}
                disabled={isRunning}
                className="w-full accent-[hsl(var(--primary))] h-1.5 bg-secondary rounded-md cursor-pointer disabled:opacity-50"
              />
              <div className="flex justify-between text-[9px] font-mono text-muted-foreground">
                <span>5 candidates</span>
                <span>25 candidates</span>
                <span>50 candidates</span>
              </div>
            </div>

            {/* Research Depth */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                Research Depth
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {(['standard', 'deep', 'comprehensive'] as ResearchDepth[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    disabled={isRunning}
                    onClick={() => setResearchDepth(d)}
                    className={`h-7 text-[10px] capitalize rounded-sm font-medium transition-colors border ${
                      researchDepth === d
                        ? 'bg-[hsl(var(--info-bg))] text-[hsl(var(--info-fg))] border-[hsl(var(--info-border))]'
                        : 'bg-secondary text-muted-foreground border-border hover:bg-muted'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Enabled Specialists */}
          <div className="space-y-2 pt-1 border-t border-border">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-3 w-3 text-muted-foreground" />
                <span>Specialist Execution Agents</span>
              </label>
              {errors.enabledSpecialists && (
                <span className="text-destructive text-[10px]">
                  {errors.enabledSpecialists}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Website Specialist */}
              <button
                type="button"
                disabled={isRunning}
                onClick={() => toggleSpecialist('website')}
                className={`p-2.5 rounded-md border text-left transition-colors flex items-start gap-2 ${
                  enabledSpecialists.includes('website')
                    ? 'border-[hsl(var(--info-border))] bg-[hsl(var(--info-bg))]'
                    : 'border-border bg-secondary opacity-60'
                }`}
              >
                {enabledSpecialists.includes('website') ? (
                  <CheckSquare className="h-3.5 w-3.5 text-[hsl(var(--info-fg))] shrink-0 mt-0.5" />
                ) : (
                  <Square className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="text-xs font-medium text-foreground">Website Specialist</div>
                  <div className="text-[10px] text-muted-foreground">UX, forms & booking friction</div>
                </div>
              </button>

              {/* Ads Specialist */}
              <button
                type="button"
                disabled={isRunning}
                onClick={() => toggleSpecialist('ads')}
                className={`p-2.5 rounded-md border text-left transition-colors flex items-start gap-2 ${
                  enabledSpecialists.includes('ads')
                    ? 'border-[hsl(var(--info-border))] bg-[hsl(var(--info-bg))]'
                    : 'border-border bg-secondary opacity-60'
                }`}
              >
                {enabledSpecialists.includes('ads') ? (
                  <CheckSquare className="h-3.5 w-3.5 text-[hsl(var(--info-fg))] shrink-0 mt-0.5" />
                ) : (
                  <Square className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="text-xs font-medium text-foreground">Ads Specialist</div>
                  <div className="text-[10px] text-muted-foreground">Active Meta Ads campaigns</div>
                </div>
              </button>

              {/* Maps Specialist */}
              <button
                type="button"
                disabled={isRunning}
                onClick={() => toggleSpecialist('maps')}
                className={`p-2.5 rounded-md border text-left transition-colors flex items-start gap-2 ${
                  enabledSpecialists.includes('maps')
                    ? 'border-[hsl(var(--info-border))] bg-[hsl(var(--info-bg))]'
                    : 'border-border bg-secondary opacity-60'
                }`}
              >
                {enabledSpecialists.includes('maps') ? (
                  <CheckSquare className="h-3.5 w-3.5 text-[hsl(var(--info-fg))] shrink-0 mt-0.5" />
                ) : (
                  <Square className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="text-xs font-medium text-foreground">Maps Specialist</div>
                  <div className="text-[10px] text-muted-foreground">Ratings & local positioning</div>
                </div>
              </button>
            </div>
          </div>
        </CardContent>

        <CardFooter className="border-t border-border justify-between gap-3 pt-3 pb-3">
          <div className="text-[11px] text-muted-foreground font-mono">
            {isRunning ? (
              <span className="text-[hsl(var(--warning-fg))] flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Research run in progress...
              </span>
            ) : (
              <span>Ready for campaign launch</span>
            )}
          </div>

          <Button
            type="submit"
            size="sm"
            disabled={isRunning}
            className="gap-1.5 text-xs font-medium active:scale-[0.99] active:translate-y-px"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Running Pipeline...</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Start Research Campaign</span>
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
