---
### `IMPLEMENTATION-PLAN V3.md`
```markdown
# LeadPulse AI — Port 3500 Frontend Redesign — Implementation Plan
> Reference: DESIGN-V3.md | Stack: Vite + React 19 + TailwindCSS v4 + Lucide React + Sonner
> Rule: Never break functionality. Test at localhost:3500 after every phase.
---
## Pre-Flight
- [ ] npm run client:dev running at port 3500
- [ ] All 5 pages load without runtime errors  
- [ ] Take before screenshots of current state
---
## Phase 1 — Token System (globals.css + UI primitives)
**Impact: Biggest visual change per line. Risk: Low.**
### Step 1.1 — Replace client/src/styles/globals.css
Replace ENTIRE file with token system from DESIGN-V3.md §2.
Key additions vs current:
- New HSL vars: --success, --warning, --info and their -bg/-border/-fg variants
- Remove: --evidence-observed-bg etc. (domain tokens now handled by semantic system)
- Add: global td/th tabular-nums rule
- Add: *:focus-visible ring rule  
- Add: prefers-reduced-motion block
- Add: scroll-behavior: smooth to body
Verify: Background shifts to warm stone #FAFAF9. Borders are warmer gray.
### Step 1.2 — Update client/src/components/ui/button.tsx
```tsx
// In buttonVariants cva, update variants:
// "default" (primary):
// "bg-primary text-primary-foreground hover:bg-primary/90"
// ADD: "transition-[background-color,transform,box-shadow] duration-150"
// ADD: "active:scale-[0.99] active:translate-y-px"
// ADD: "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
// "outline":
// "border border-border bg-transparent hover:bg-secondary hover:border-border-strong"
// ADD: "transition-[background-color,border-color] duration-150"
// "ghost":
// "hover:bg-secondary hover:text-foreground"
// ADD: "transition-colors duration-150"
// ALL variants:
// REMOVE any "transition-all" → replace with explicit property list
// ADD "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
Step 1.3 — Update client/src/components/ui/badge.tsx
tsx


// Change border-radius to rounded-sm (4px via --radius-sm)
// Add new variants:
// "success":     "bg-[hsl(var(--success-bg))] text-[hsl(var(--success-fg))] border-[hsl(var(--success-border))] border"
// "warning":     "bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning-fg))] border-[hsl(var(--warning-border))] border"
// "info":        "bg-[hsl(var(--info-bg))] text-[hsl(var(--info-fg))] border-[hsl(var(--info-border))] border"
// "destructive": "bg-[hsl(var(--destructive-bg))] text-destructive border-[hsl(var(--destructive-border))] border"
// "secondary":   "bg-secondary text-muted-foreground border border-border" (neutral)
Step 1.4 — Update client/src/components/ui/card.tsx
tsx


// Card:    "bg-card rounded-md border border-border shadow-xs"
// ADD:     "transition-[border-color,box-shadow] duration-200 ease"
// Hover (for interactive cards with onClick/Link):
//          "hover:border-[hsl(var(--border-strong))] hover:shadow-sm"
// CardTitle: ADD "[font-family:var(--font-display)]"
Verify: Cards should look crisper — 6px radius, minimal shadow, clean hairline border.

Phase 2 — Sidebar
Step 2.1 — client/src/components/navigation/sidebar.tsx
<aside className="w-[220px] ..."> (from w-64)
Remove: <div className="px-3 pb-2 text-[10px]...">Navigation</div>
Active NavLink class:
Remove: bg-primary/15 text-primary border border-primary/30 shadow-xs font-semibold
Add: bg-[hsl(var(--info-bg))] text-[hsl(var(--info-fg))]
Inactive/hover: text-muted-foreground hover:text-foreground hover:bg-secondary
Logo icon wrap: bg-[hsl(var(--info-bg))] text-[hsl(var(--primary))]
V2.0 Badge: <Badge variant="secondary" ...>V2.0</Badge>
Phase badge: <span className="text-[10px] text-muted-foreground ml-auto">v9.3</span>
Footer — replace green card:
tsx


<div className="flex items-center gap-1.5">
  <ShieldCheck className="h-3 w-3 text-[hsl(var(--success))]" />
  <span className="text-[10px] text-muted-foreground">Human Gate Active</span>
</div>
Verify: Sidebar is 220px, violet-tint active (no border box), no NAVIGATION label, clean footer.

Phase 3 — Header Bar
Step 3.1 — client/src/layouts/app-shell.tsx
Header padding: py-2.5 → py-1.5
Standardize all 4 pills to same base class: const pillBase = "flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-secondary border border-border text-[11px]"
DB pill: apply pillBase, icons = text-muted-foreground
Worker pill: apply pillBase, icons = text-muted-foreground
Agent MC pill: apply pillBase; inside LIVE badge: className="bg-[hsl(var(--info-bg))] text-[hsl(var(--info-fg))] px-1 rounded text-[10px] font-medium"
Autonomous Send pill: ONLY exception to pillBase: className="flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[hsl(var(--success-bg))] border border-[hsl(var(--success-border))] text-[hsl(var(--success-fg))] text-[11px]"
Remove Sun/Moon toggle <Button> from header entirely
Add aria-label to any remaining icon-only buttons
Step 3.2 — Add theme toggle to Settings
In settings-page.tsx, add an "Appearance" section:

tsx


// Move toggleTheme logic to lib/use-theme.ts (useTheme hook)
// In settings: "Appearance" section with Light/Dark/System control
// Persist to localStorage('theme')
Verify: Header is 40px, all pills same gray style, green Locked pill stands out.

Phase 4 — Dashboard Page
Step 4.1 — Remove max-width (dashboard-page.tsx)
tsx


// Line 114 (error state):
<div className="space-y-6 w-full">  // was max-w-7xl mx-auto
// Line 139 (main):
<div className="space-y-6 w-full">  // was max-w-7xl mx-auto
Step 4.2 — Uniform KPI icon chips
tsx


// ALL 4 cards replace colored chip with:
const chipCls = "w-8 h-8 rounded-md bg-secondary flex items-center justify-center";
const iconCls = "h-4 w-4 text-muted-foreground";
// EXCEPTION: Card 3 "Awaiting Review":
const chipClsWarning = "w-8 h-8 rounded-md bg-secondary flex items-center justify-center";
const iconClsWarning = "h-4 w-4 text-[hsl(var(--warning))]";
// KPI number on all cards:
// Remove: "text-3xl font-bold font-mono"
// Add:    "text-3xl font-semibold tracking-tight tabular-nums [font-family:var(--font-display)]"
// Card 3 number ONLY:
// Add: "text-[hsl(var(--warning))]"
// Card 3 subtext (line 256):
// Remove: "text-amber-800 dark:text-amber-300"
// Add: "text-[hsl(var(--warning-fg))]"
Step 4.3 — Desktop-only grids
tsx


// Line 197: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
// → "grid grid-cols-4 gap-4"
// Line 288: "grid grid-cols-1 lg:grid-cols-2 gap-6"
// → "grid grid-cols-2 gap-4"
// Line 402: "grid grid-cols-1 md:grid-cols-4 gap-3"
// → "grid grid-cols-4 gap-3"
Step 4.4 — Fix AI HUD gradient (live-thinking-hud.tsx)
Find and replace:

Any from-violet-*, from-indigo-*, from-purple-*, bg-gradient-* → remove gradient
Container: bg-card border border-border rounded-md shadow-xs overflow-hidden
Header strip: bg-secondary border-b border-border px-4 py-2.5
"SWARM READY" or similar pill: bg-[hsl(var(--info-bg))] text-[hsl(var(--info-fg))] text-[10px] rounded px-1.5 py-0.5
Agent step active: bg-[hsl(var(--info-bg))] text-[hsl(var(--info-fg))] rounded px-2 py-1
"Test Live Swarm" CTA: bg-primary text-white rounded-full h-8 px-4 text-xs font-medium
Step 4.5 — Fix chart card header icons
tsx


// BarChart3 (Score Distribution):   remove text-blue-600 → text-muted-foreground
// PieChart  (Service Distribution): remove text-purple-600 → text-muted-foreground
// TrendingUp (Funnel):              remove text-emerald-600 → text-muted-foreground
// Globe2    (Geographic):           remove text-amber-600 → text-muted-foreground
Verify: No lavender HUD, uniform KPI chips, neutral chart header icons, full-width layout.

Phase 5 — Leads Intelligence Page
Step 5.1 — Filter tabs (leads-page.tsx)
tsx


// Active tab: 
// "bg-[hsl(var(--info-bg))] text-[hsl(var(--info-fg))] rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150"
// Inactive tab:
// "text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md px-3 py-1.5 text-xs transition-colors duration-150"
Step 5.2 — Score badge 2-tier
tsx


function getScoreBadgeClass(score: number): string {
  if (score >= 80) 
    return "bg-[hsl(var(--info-bg))] text-[hsl(var(--info-fg))] border border-[hsl(var(--info-border))]";
  if (score >= 40) 
    return "bg-secondary text-muted-foreground border border-border";
  return "bg-secondary text-[hsl(var(--disabled))] border border-border";
}
// className={cn("text-[10px] font-medium rounded-sm px-1.5 py-0.5", getScoreBadgeClass(score))}
Step 5.3 — Status/tier + VERIFIED + META ADS badges
tsx


// Tier badges:
// "Immediate"    → getScoreBadgeClass(80) — same as high score
// "High Potential"/"Medium"/"Low" → "bg-secondary text-muted-foreground border border-border rounded-sm px-1.5 py-0.5 text-[10px]"
// VERIFIED → replace colored pill with:
// <CheckCircle2 className="h-3 w-3 text-muted-foreground flex-shrink-0" aria-label="Verified" />
// ACTIVE META ADS → 
// <span className="bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning-fg))] border border-[hsl(var(--warning-border))] rounded-sm px-1.5 py-0.5 text-[10px] font-medium">Active Meta Ads</span>
Step 5.4 — KPI header cards
Same treatment as Dashboard Phase 4.2:

All chips: bg-secondary + icon text-muted-foreground
"Active Meta Ads" chip: icon text-[hsl(var(--warning))]
Numbers: tabular-nums Inter Tight 600
Phase 6 — Research Engine Page
Step 6.1 — Info hierarchy (research-page.tsx)
tsx


// Add eyebrow labels before section cards:
// "Campaign Configuration Panel" header:
// <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-medium mb-1">
//   Configuration
// </p>
// "Live Research Run Telemetry" header:
// <p className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground font-medium mb-1">
//   Live Telemetry
// </p>
Step 6.2 — Run status pills
tsx


const runStatusConfig: Record<string, string> = {
  partial:   "bg-[hsl(var(--warning-bg))] text-[hsl(var(--warning-fg))] border-[hsl(var(--warning-border))]",
  complete:  "bg-[hsl(var(--success-bg))] text-[hsl(var(--success-fg))] border-[hsl(var(--success-border))]",
  running:   "bg-[hsl(var(--info-bg))] text-[hsl(var(--info-fg))] border-[hsl(var(--info-border))]",
  failed:    "bg-[hsl(var(--destructive-bg))] text-destructive border-[hsl(var(--destructive-border))]",
  cancelled: "bg-secondary text-muted-foreground border-border",
};
// className={cn("text-[11px] rounded-sm px-1.5 py-0.5 border font-medium", runStatusConfig[status?.toLowerCase()] ?? runStatusConfig.cancelled)}
Step 6.3 — Active run time + agent tiles
tsx


// Active run time (the highlighted "374" / burn rate cell):
// Remove: amber/orange treatment
// Add: "bg-[hsl(var(--info-bg))] text-[hsl(var(--info-fg))] tabular-nums"
// Active specialist tile:
// "bg-[hsl(var(--info-bg))] border border-[hsl(var(--primary))] rounded-md p-2"
// All others: "bg-secondary border border-border rounded-md p-2"
Phase 7 — Outreach Review Page
Step 7.1 — Badge normalization (outreach-page.tsx)
tsx


// "High Priority" → <Badge variant="info">High Priority</Badge>
// "Pending Review" → <Badge variant="secondary">Pending Review</Badge>
// "PASS (284 ch)" → <span className="text-[10px] text-muted-foreground">{chars} ch</span>
// "Approved" → <Badge variant="success">Approved</Badge>
// "Needs Revision" → <Badge variant="destructive">Needs Revision</Badge>
// "Disqualified" → <Badge variant="destructive">Disqualified</Badge>
// Score "100/100": className="[font-family:var(--font-display)] font-semibold tabular-nums text-foreground"
// Platform: className="font-mono text-[10px] text-muted-foreground"
Step 7.2 — Approval gate
tsx


// "HUMAN APPROVAL REQUIRED" box:
// className="bg-[hsl(var(--warning-bg))] border border-[hsl(var(--warning-border))] rounded-md p-3"
// "Approve Draft" button — use success green (completing workflow):
// className="bg-[hsl(var(--success))] text-white hover:bg-[hsl(var(--success)/0.9)] h-8 px-4 rounded text-xs font-medium transition-colors duration-150"
// "Copy Pitch", "Regenerate Draft" → variant="outline"
// "Ask for Re-write", "Disqualify Lead" → destructive outline
Phase 8 — Settings Page
Step 8.1 — Badge colors (settings-page.tsx)
tsx


// "Ready" → <Badge variant="success">Ready</Badge>
// "Phase 8.1 PASS" → <Badge variant="success">Phase 8.1 PASS</Badge>
// "HARD ENFORCED" → <Badge variant="secondary">Hard Enforced</Badge>
// Code values → className="font-mono text-[11px] text-[hsl(var(--primary))]"
Step 8.2 — Add theme toggle
tsx


// Create: client/src/lib/use-theme.ts
export function useTheme() {
  const [theme, setTheme] = useState<'light'|'dark'|'system'>(() => 
    (localStorage.getItem('theme') as any) || 'system'
  );
  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme === 'dark' || 
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    root.classList.toggle('dark', isDark);
    localStorage.setItem('theme', theme);
  }, [theme]);
  return { theme, setTheme };
}
// In settings-page.tsx, add "Appearance" section:
// Three buttons: Light / Dark / System
// Active: bg-secondary border border-border-strong
// Inactive: text-muted-foreground hover:bg-raised
Phase 9 — Accessibility Pass
Step 9.1 — aria-labels
tsx


// RefreshCw buttons: aria-label="Refresh data"
// Export button: aria-label="Export leads to Excel"
// Column sort buttons: aria-label="Sort by {column}"
// Search input: aria-label="Search leads"
// All icon-only buttons: add descriptive aria-label
Step 9.2 — text-wrap: balance
tsx


// Add to globals.css:
.text-wrap-balance { text-wrap: balance; }
// Apply to PageHeader title, CardTitle, all h1/h2 elements:
// className="... text-wrap-balance"
// Or use: style={{ textWrap: 'balance' as any }}
Step 9.3 — prefers-reduced-motion
tsx


// Replace: className="animate-pulse"
// With:    className="motion-safe:animate-pulse"
// Replace: className="animate-ping"
// With:    className="motion-safe:animate-ping"
// Replace: className="animate-spin"
// With:    className="motion-safe:animate-spin"
Step 9.4 — min-w-0 on flex text children
Scan all files for: className="flex items-center gap-...
Add min-w-0 to any direct flex child containing text:

tsx


<span className="min-w-0 truncate">{businessName}</span>
Phase 10 — Final Audit
Typography checklist
 All h1: Inter Tight 500 text-xl tracking-tight text-wrap-balance
 All CardTitle: Inter Tight 500 text-sm tracking-tight
 All eyebrow labels: Inter 500 text-[10px] uppercase tracking-[0.08em]
 All KPI numbers: Inter Tight 600 tabular-nums (NOT font-mono)
 All run IDs / API paths: font-mono text-[11px] text-muted-foreground
 No font-bold (700) anywhere on headings
Color checklist
 Only #5E6AD2 accent appears per page (within budget)
 No text-blue-600, text-emerald-700, text-purple-600, text-amber-700 remaining
 Only 3 semantic colors: success, warning, destructive
 Safe Mode / approved: success green ✓
 Active nav / high-intent: info (accent-dim) ✓
 
 Success Criteria
✅ Zero ad-hoc color classes (text-blue-*, text-emerald-*, text-purple-*, text-amber-*) ✅ Single accent #5E6AD2 per page within budget ✅ All KPI numbers: tabular-nums + Inter Tight (not font-mono) ✅ Sidebar: 220px, no NAVIGATION label, flat violet active state ✅ Header: uniform gray pills, green Locked pill, no sun/moon toggle ✅ Live AI HUD: no gradient background ✅ All icon-only buttons: aria-label present ✅ No transition-all anywhere ✅ Dashboard: no max-w-7xl constraint ✅ All 5 pages: no runtime errors at 1280px, 1440px, 1920px