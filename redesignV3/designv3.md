# LeadPulse AI — Port 3500 Frontend — Design Document V3
> "Surgical data desk" — Linear × Datadog remix. One accent, hairline borders, hierarchy over decoration.
> Target: client/src/ (Vite + React SPA at localhost:3500)
---
## 0. Design System Selection
🎨 **Awesome Claude Design Readout:**
- **Detected Vibe:** Data-dense SaaS intelligence dashboard — AI agent telemetry, pipeline tables, outreach workflows
- **Selected System:** Linear × Datadog remix
- **Color Tokens:** Background `#FAFAF9` | Accent `#5E6AD2` | Text `#0D0D0D`
- **Typography:** Inter 400/500 body · Inter Tight 500/600 headings · tabular-nums on all data
- **Why:** Linear's surgical restraint for UI chrome. Datadog's data-density pragmatics for tables and telemetry.
  Together: professional-grade internal tool that feels earned, not templated.
---
## 1. Audit Findings
### 🔴 Critical Issues
| # | Finding | Location | Fix |
|---|---------|----------|-----|
| C1 | 7+ competing accent hues simultaneously | All pages | Single #5E6AD2; all others → neutral |
| C2 | `max-w-7xl mx-auto` container | dashboard-page.tsx:139 | Remove entirely |
| C3 | AI gradient purple/lavender HUD panel | live-thinking-hud.tsx | bg-card flat card |
| C4 | 4 different colored KPI icon chips | dashboard-page.tsx:205,227,249,269 | Uniform bg-secondary chips |
| C5 | Status badge color explosion | outreach-page.tsx, research-page.tsx | Icon+label; 3 semantic only |
| C6 | font-bold font-mono text-3xl on KPI numbers | dashboard-page.tsx:209 | Inter Tight 600, tabular-nums |
| C7 | Per-card colored chart header icons | Multiple chart cards | All → text-muted-foreground |
### 🟡 Important Issues
| # | Finding | Location | Fix |
|---|---------|----------|-----|
| I1 | "NAVIGATION" label in sidebar | sidebar.tsx:88 | Remove |
| I2 | 256px sidebar | sidebar.tsx:59 | 220px |
| I3 | Sun/Moon toggle in header | app-shell.tsx:79 | Move to Settings |
| I4 | Missing tabular-nums | Multiple | Add via CSS globally |
| I5 | No text-wrap: balance on headings | Multiple | Add to all h1/h2/CardTitle |
| I6 | Flex children missing min-w-0 | outreach-page.tsx | Add min-w-0 |
| I7 | Leads score badges — 4 colors | leads-page.tsx | 2-tier: accent (≥80), neutral (rest) |
| I8 | "Phase 9.3" dev badge on nav | sidebar.tsx:34 | text-[10px] text-muted-foreground |
| I9 | Research page equal visual weight | research-page.tsx | Eyebrow → heading → body hierarchy |
| I10 | Missing aria-labels on icon buttons | app-shell.tsx | Add aria-label everywhere |
| I11 | No focus-visible ring consistency | Multiple | focus-visible:ring-2 ring-ring |
| I12 | transition: all in hover handlers | Multiple | Explicit property transitions |
---
## 2. Token System — Replace client/src/styles/globals.css
```css
@import "tailwindcss";
@theme {
  --color-background: #FAFAF9;
  --color-card: #FFFFFF;
  --color-raised: #F4F3F0;
  --color-foreground: #0D0D0D;
  --color-foreground-secondary: #3B3935;
  --color-muted-foreground: #78716C;
  --color-disabled: #A8A29E;
  --color-primary: #5E6AD2;
  --color-primary-hover: #4F5BC0;
  --color-primary-foreground: #FFFFFF;
  --color-primary-dim: #ECEEF9;
  --color-border: #E5E5E3;
  --color-border-strong: #CCCBC8;
  --color-input: #E5E5E3;
  --color-ring: #5E6AD2;
  --color-success: #16A34A;
  --color-success-bg: #F0FAF4;
  --color-success-border: #BBF7D0;
  --color-success-foreground: #14532D;
  --color-warning: #D97706;
  --color-warning-bg: #FFFBEB;
  --color-warning-border: #FDE68A;
  --color-warning-foreground: #78350F;
  --color-destructive: #DC2626;
  --color-destructive-bg: #FEF2F2;
  --color-destructive-border: #FECACA;
  --color-destructive-foreground: #FFFFFF;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-display: 'Inter Tight', 'Inter', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;
  --radius: 0.375rem;
  --radius-sm: 0.25rem;
  --radius-full: 9999px;
  --shadow-xs: 0 1px 2px rgba(0,0,0,0.04);
  --shadow-sm: 0 2px 8px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 16px rgba(0,0,0,0.07);
  --shadow-lg: 0 8px 32px rgba(0,0,0,0.10);
}
:root {
  --background: 60 4.8% 97.9%;
  --foreground: 20 14.3% 4.1%;
  --card: 0 0% 100%;
  --card-foreground: 20 14.3% 4.1%;
  --primary: 235 53% 60%;
  --primary-foreground: 0 0% 100%;
  --secondary: 40 6% 95%;
  --secondary-foreground: 20 7% 22%;
  --muted: 40 6% 95%;
  --muted-foreground: 25 5.3% 44.7%;
  --accent: 40 6% 95%;
  --accent-foreground: 20 14.3% 4.1%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 0 0% 98%;
  --border: 30 6% 90%;
  --input: 30 6% 90%;
  --ring: 235 53% 60%;
  --radius: 0.375rem;
  --success: 142 71% 45%;
  --success-bg: 138 76% 97%;
  --success-border: 142 71% 75%;
  --success-fg: 142 71% 20%;
  --warning: 38 92% 50%;
  --warning-bg: 48 100% 97%;
  --warning-border: 45 93% 67%;
  --warning-fg: 32 81% 29%;
  --info: 235 53% 60%;
  --info-bg: 232 67% 97%;
  --info-border: 235 53% 80%;
  --info-fg: 235 53% 35%;
}
.dark {
  --background: 240 8% 7%;
  --foreground: 240 9% 96%;
  --card: 240 8% 10%;
  --card-foreground: 240 9% 96%;
  --primary: 235 53% 60%;
  --primary-foreground: 0 0% 100%;
  --secondary: 240 7% 13%;
  --secondary-foreground: 240 9% 82%;
  --muted: 240 7% 13%;
  --muted-foreground: 240 5% 55%;
  --accent: 240 7% 13%;
  --accent-foreground: 240 9% 96%;
  --destructive: 0 72% 51%;
  --destructive-foreground: 0 0% 98%;
  --border: 240 6% 17%;
  --input: 240 6% 17%;
  --ring: 235 53% 60%;
  --success: 142 69% 58%;
  --success-bg: 142 69% 8%;
  --success-border: 142 69% 20%;
  --success-fg: 142 69% 70%;
  --warning: 38 92% 50%;
  --warning-bg: 38 80% 8%;
  --warning-border: 38 80% 22%;
  --warning-fg: 43 93% 66%;
  --info: 235 53% 65%;
  --info-bg: 235 40% 10%;
  --info-border: 235 40% 22%;
  --info-fg: 235 53% 75%;
}
body {
  background-color: hsl(var(--background));
  color: hsl(var(--foreground));
  font-family: var(--font-sans);
  font-feature-settings: 'cv02','cv03','cv04','cv11';
  -webkit-font-smoothing: antialiased;
  scroll-behavior: smooth;
}
td, th, .tabular-nums, [data-value], .kpi-value {
  font-variant-numeric: tabular-nums;
}
*:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: hsl(var(--border)); border-radius: 9999px; }
::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground) / 0.4); }
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
3. Typography System
Role	Font	Weight	Size	Tracking
Page title (h1)	Inter Tight	500	text-xl	-0.02em
Section heading (h2)	Inter Tight	500	text-sm	-0.01em
Eyebrow label	Inter	500	text-[10px]	0.08em uppercase
Body / table cells	Inter	400	text-xs	normal
Meta / timestamps	Inter	400	text-[11px]	normal
KPI value	Inter Tight	600	text-3xl	tabular-nums
Code / IDs	JetBrains Mono	400	text-[11px]	normal
Rules: Max heading weight 600. text-wrap: balance on all h1/h2/CardTitle. min-w-0 on all flex text children.

4. Sidebar (client/src/components/navigation/sidebar.tsx)
Width: 220px (from 256px)
Remove "NAVIGATION" section label entirely
Active nav state: bg-[hsl(var(--info-bg))] text-[hsl(var(--info-fg))] — flat fill, NO border, NO shadow
Inactive: text-muted-foreground hover:text-foreground hover:bg-secondary
"V2.0" Badge: variant="secondary" (neutral, NOT primary colored)
"Phase 9.3": <span className="text-[10px] text-muted-foreground ml-auto">v9.3</span>
Footer Safe Mode card → 1-line: <ShieldCheck h-3 text-success /> "Human Gate Active" text-[10px] muted
5. Header Bar (client/src/layouts/app-shell.tsx)
Height: 40px
All 4 pills — SAME anatomy: bg-secondary border border-border rounded px-2 py-0.5 text-[11px]
Remove: Sun/Moon theme toggle (move to Settings page)
"Autonomous Send: Locked" pill only: bg-[hsl(var(--success-bg))] border-[hsl(var(--success-border))] text-[hsl(var(--success-fg))]
"LIVE" badge inside Agent Mission Control pill: bg-[hsl(var(--info-bg))] text-[hsl(var(--info-fg))]
Add aria-label to all icon-only buttons
6. Dashboard KPI Cards (dashboard-page.tsx)
Grid: grid-cols-4 gap-4 (remove sm: breakpoints)
Remove: max-w-7xl mx-auto from wrapper div
All 4 icon chips: w-8 h-8 rounded-md bg-secondary + icon text-muted-foreground
EXCEPTION: "Awaiting Review" chip → icon text-[hsl(var(--warning))]
KPI numbers: text-3xl font-semibold tracking-tight tabular-nums [font-family:var(--font-display)]
EXCEPTION: "Awaiting Review" number → text-[hsl(var(--warning))]
7. Live AI HUD (live-thinking-hud.tsx)
REMOVE: Purple/lavender/indigo gradient background
Container: bg-card border border-border rounded-md shadow-xs
Header: bg-secondary border-b border-border (NOT gradient)
"SWARM READY": bg-[hsl(var(--info-bg))] text-[hsl(var(--info-fg))]
Agent step tabs active: bg-[hsl(var(--info-bg))] text-[hsl(var(--info-fg))]
"Test Live Swarm" button: bg-primary text-white rounded-full
8. Leads Intelligence (leads-page.tsx)
Score badge 2-tier system:

≥80: bg-[hsl(var(--info-bg))] text-[hsl(var(--info-fg))] border-[hsl(var(--info-border))]
40-79: bg-secondary text-muted-foreground border-border
<40: bg-secondary text-[hsl(var(--disabled))] border-border
Status/tier: "Immediate" → info-bg+info-fg; all others → neutral secondary VERIFIED badge: plain <CheckCircle2 className="h-3 w-3 text-muted-foreground" /> ACTIVE META ADS: bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning-fg))] (genuine urgency signal)

9. Research Engine (research-page.tsx)
Run status pills:



partial:   warning-bg + warning-fg + warning-border
complete:  success-bg + success-fg + success-border
running:   info-bg + info-fg + info-border
failed:    destructive-bg + destructive + destructive-border
cancelled: secondary + muted-foreground + border
Active run time highlight: bg-[hsl(var(--info-bg))] text-[hsl(var(--info-fg))] (NOT amber) "Start Research Campaign": bg-primary text-white rounded-full h-9 — only filled button

10. Outreach Review (outreach-page.tsx)
"High Priority": bg-[hsl(var(--info-bg))] text-[hsl(var(--info-fg))] (accent)
"Pending Review": bg-secondary text-muted-foreground (NOT amber)
"PASS (284 ch)": plain text-[10px] text-muted-foreground (NO pill)
"Disqualified": bg-[hsl(var(--destructive-bg))] text-destructive
Score "100/100": Inter Tight 600 tabular-nums text-foreground (not colored)
"Approve Draft": bg-[hsl(var(--success))] text-white (completing workflow = success semantic)
"HUMAN APPROVAL REQUIRED" box: bg-[hsl(var(--warning-bg))] border border-[hsl(var(--warning-border))]
11. Settings (settings-page.tsx)
"Ready" badge: variant="success"
"Phase 8.1 PASS": variant="success"
"HARD ENFORCED": variant="secondary" (neutral — config state, not error)
Code values: font-mono text-[11px] text-[hsl(var(--primary))]
ADD: "Appearance" section with theme toggle (moved from header)
12. Accent Budget Per Page
Page	Max	Uses
Dashboard	3	New Campaign CTA, active nav, Awaiting Review number
Leads Intelligence	3	Active filter tab, ≥80 score badges, active nav
Research Engine	3	Start Campaign CTA, active agent tile, active run time
Outreach Review	2	High Priority badge, active nav
Settings	1	Active nav only
13. Accessibility
 All icon-only buttons: aria-label
 All form inputs: label or aria-label
 prefers-reduced-motion: guard on animate-pulse, animate-ping, animate-spin
 tabular-nums: globally via CSS td/th selector
 text-wrap: balance on all h1, h2, CardTitle
 min-w-0 on every flex child containing text
 focus-visible:ring-2 on all interactive elements
 Never outline-none without replacement
 Leads table: semantic table/thead/th/td (not divs)
14. File Map
File	Change
client/src/styles/globals.css	Full replacement — Linear×Datadog tokens
client/src/layouts/app-shell.tsx	Standardize pills, remove toggle, aria-labels
client/src/components/navigation/sidebar.tsx	220px, no label, new active state, simple footer
client/src/components/ui/button.tsx	Hover/active states, focus ring, no transition-all
client/src/components/ui/badge.tsx	4px radius, semantic variants
client/src/components/ui/card.tsx	shadow-xs, hover transition
client/src/components/agent/live-thinking-hud.tsx	Strip gradient, plain card
client/src/pages/dashboard/dashboard-page.tsx	Remove max-w-7xl, uniform chips, fix grid
client/src/pages/leads/leads-page.tsx	Score 2-tier, filter active states
client/src/pages/outreach/outreach-page.tsx	Status badge normalization
client/src/pages/research/research-page.tsx	Info hierarchy, run status pills
client/src/pages/settings/settings-page.tsx	Badge colors + theme toggle
15. Non-Goals
No new npm dependencies
No mobile/responsive support (1280px+ desktop only)
No data model, API, or Supabase changes
No Next.js app/ files (port 3000 scope)