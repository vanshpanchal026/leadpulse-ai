# Lead Pipeline Dashboard — UI Redesign Spec v2
**"Quiet analyst's desk" — full-bleed, desktop-only, one accent color**
**Supersedes `design.md` v1.** Keep v1's *structural* additions (funnel strip, KPI icon chips, kanban card layout, Signals bento with heatmap/donut/velocity chart) — this doc replaces the *skin* (color, type, radius, shadow) and the *shell* (width/layout) entirely.

---

## 0. Why v2 — what's changing and why

Feedback on v1: the warm cream + gold/ember palette didn't land, and the dashboard was centered in a `max-w-7xl` column that left dead space on both sides of the screen on a real monitor. Two separate problems, two separate fixes:

1. **Color/type system** → move from "warm cream + multiple pastel accent colors" to a near-monochrome **stone-neutral palette with exactly one chromatic accent (cyan)**, inspired by the attached Seline Analytics style reference. We are *not* copying Seline wholesale — Seline is a marketing landing page (spacious, one CTA per screen); this is a working dashboard (many cards, many statuses, many actions per screen). Section 4 below is the creative adaptation: how a "one accent color" rule survives contact with a real data app.
2. **Shell/width** → drop the centered `max-w-7xl` container entirely. This is a desktop-only internal tool now, not a responsive public site — design for **1280–2560px**, full-bleed, no mobile breakpoints, no hamburger menu, no stacking-to-1-column fallback. If someone opens it at phone width, it's allowed to look cramped; that's out of scope by your own requirement.

---

## 1. Design Tokens — replace the `@theme` block in `app/globals.css` again

```css
@import "tailwindcss";

@theme {
  /* Surfaces */
  --color-canvas: #FAFAF9;        /* page background — warm-stone, near-white paper. was #F4EFE4 */
  --color-paper: #FFFFFF;         /* card surface — unchanged role, now the ONLY surface above canvas */
  --color-stone-100: #F5F4F1;     /* inset panels (pain point box, pitch box) — a step between canvas and white, since a dense dashboard needs this middle tier that a landing page doesn't */

  /* Text */
  --color-ink: #0C0A09;           /* primary text/headings — Seline's ink-black. was #15130E */
  --color-ink-soft: #292524;      /* secondary headings */
  --color-warm-gray: #78716C;     /* body/meta text — Seline's warm-gray. was #8C8370 */
  --color-ash-gray: #A8A29E;      /* placeholders, disabled, icon strokes */
  --color-hairline: #E8E6E5;      /* borders — THE primary structural device now, not shadows. was #E7DFCB */
  --color-stone-muted: #D6D3D1;   /* secondary borders, progress-bar tracks */

  /* The one accent */
  --color-cyan: #3BA6F1;          /* primary CTA fill, the single most important signal per screen */
  --color-cyan-edge: #3398E1;     /* links, outlined emphasis, chart line color — do not promote to CTA fill */
  --color-sky-wash: #C1E1F7;      /* highlight-span background, High-Intent pill background */

  /* Dark contrast panel — used ONCE, same as v1's rule */
  --color-soot: #1C1917;          /* active nav pill fill, Discovery Heatmap panel background */
  --color-soot-dot-off: #33302C;  /* empty heatmap dot on the soot panel */

  --font-inter: 'Inter', ui-sans-serif, system-ui, sans-serif;
  --font-inter-tight: 'Inter Tight', ui-sans-serif, system-ui, sans-serif; /* heading substitute for Seline's Roobert */

  /* Radius — tightened from v1's bubbly 24–32px down to Seline's crisp range */
  --radius-shell: 20px;   /* outer bento / kanban-column / header containers. was 32px */
  --radius-cards: 12px;   /* standard cards. was 24px */
  --radius-panel: 10px;   /* inset panels. was 20px */
  --radius-buttons: 999px;
  --radius-badges: 999px;
  --radius-inputs: 8px;
  --radius-chip: 8px;

  /* Shadows — hairline-first; shadow is the exception, not the default */
  --shadow-subtle: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 16px rgba(0, 0, 0, 0.05);
  --shadow-xl: 0 12px 45px rgba(17, 12, 46, 0.12); /* reserved for exactly ONE element — see §5.5 */
}

body {
  background-color: var(--color-canvas);
  color: var(--color-ink);
  font-family: var(--font-inter);
  -webkit-font-smoothing: antialiased;
}

/* Cards are flat by default. The border IS the structure. */
.card-flat {
  box-shadow: var(--shadow-subtle);
  transition: box-shadow 0.15s ease;
}
.card-flat:hover {
  box-shadow: var(--shadow-md);
}

::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--color-hairline); border-radius: 9999px; }
::-webkit-scrollbar-thumb:hover { background: var(--color-stone-muted); }
```

**Font swap:** in `app/layout.tsx`, replace the `Geist` import with `Inter` (body) and `Inter Tight` (headings) — both are available via `next/font/google`, so this is a drop-in change, not a new dependency:

```tsx
import { Inter, Inter_Tight } from 'next/font/google';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });
const interTight = Inter_Tight({ variable: '--font-inter-tight', subsets: ['latin'] });
```
Apply both variable classNames to `<html>`. Headings use `font-[family-name:var(--font-inter-tight)] font-normal tracking-tight` (weight 400 — do not bump headings to 600/700, per Seline's "whisper-weight authority" rule in §0/§6).

---

## 2. The Full-Bleed Shell (this is the width fix)

Replace **every** instance of `max-w-7xl mx-auto` in `app/page.tsx` (header container, main content container) with a fluid full-width container:

```
w-full px-10 xl:px-14 2xl:px-20
```

No `max-w-*` cap, no `mx-auto` centering. On a 1440px or 1920px monitor the dashboard should visually touch both edges of the browser window (minus the padding above) — that's the point. If you want a guard rail against absurd line-lengths on a 34"+ ultrawide monitor, the *only* acceptable cap is `max-w-[2400px] mx-auto` — apply this only if you actually test on an ultrawide and it looks bad without it; the default should be no cap at all.

This has a useful side effect for §7 (anti-clipping): wider kanban columns and wider bento cells mean lead titles, pain-point text, and chart labels all get more real room before wrapping — the full-bleed layout isn't just cosmetic, it directly reduces clipping pressure everywhere else in the app.

**Grids at this width** (desktop-only, so these are the *only* breakpoints that matter — delete any `sm:`/`md:` fallback that exists purely for phone widths):
- KPI cards: `grid-cols-4` always. Card padding goes up to `32px` (from the old `p-6`/24px) — at this width the cards have room to breathe, use it.
- Kanban: `grid-cols-4` always. Columns are `1fr` each — they grow with the viewport instead of being capped at a fixed max width.
- Signals bento: `grid-cols-3` always, col-1 `row-span-2` as in v1 §5.6 — cells get taller/wider, so the heatmap dots and donut can be drawn larger too.
- Feed view: keep the 7/5 split (`col-span-7` / `col-span-5` of a 12-col grid) — at full width both panels get meaningfully more horizontal room than they did inside `max-w-7xl`.

---

## 3. Desktop-Only, Explicitly

Design for **1280px minimum, 1440–1920px ideal, up to 2560px**. Do not:
- Add a mobile nav (hamburger, drawer nav, bottom tab bar)
- Add `grid-cols-1` mobile fallbacks anywhere
- Test at or worry about phone widths (360/390/430px) — that was in v1's spec, drop it entirely from your test pass this time.

Do test at **1280px, 1440px, 1920px, and 2560px** before calling a section done — that's the desktop-only version of v1's responsive checklist.

---

## 4. The Color & Status System (the real creative work in this doc)

Seline's rule is "exactly one chromatic accent, everything else neutral, use it once per viewport." A marketing page can do that because it has one CTA. A pipeline dashboard has to represent 5 lead statuses, a high-intent flag, several buttons, and multiple charts *on screen at the same time* — the rule can't survive unmodified. Here's the adaptation:

**Everything defaults to neutral stone.** Status pills, borders, secondary buttons, inactive nav — all ink-on-stone or ink-on-white, differentiated by *icon and label*, not color:

| Status | Pill style | Icon (lucide) |
|---|---|---|
| New Lead | `var(--color-stone-100)` bg, `var(--color-ink-soft)` text, hairline border | `Sparkle` |
| Pitch Sent | same neutral pill | `Send` |
| Replied | same neutral pill | `MessageSquare` |
| Meeting Booked | same neutral pill | `CalendarCheck` |
| Archived | same neutral pill, `var(--color-ash-gray)` text | `Archive` |

No green/red/violet/gold badges anywhere in this status set — the kanban column position already tells you the stage; color was never doing real work there in v1, it was just decoration.

**Cyan is spent on exactly two things, deliberately:**
1. **The High-Intent flag** (`confidence_score >= 8`) — `var(--color-sky-wash)` background, `var(--color-cyan-edge)` text. This is now the *only* colored badge in the entire pipeline/feed views, which makes it actually pop the way it's supposed to (in v1 it competed with a red ember badge, a blue "Replied" badge, and a green "Meeting Booked" badge — nothing stood out because everything was colored).
2. **Primary actions** — "Export Leads", "Copy Pitch to Clipboard", the drawer's main CTA: cyan fill (`var(--color-cyan)`), white text, pill shape. Every *secondary* action (Inspect Pitch, Sync, the status `<select>`, "Mark Pitched", "Booked Call") is a **ghost button**: transparent fill, `var(--color-hairline)` border, `var(--color-ink)` text.

**Soot (near-black) is reserved for structural emphasis, not accent color:** the active view-switcher pill (Pipeline/Feed View/Signals) stays `var(--color-soot)` fill + white text — this is a direct carry-over from Seline's Tab Pill Group component and happens to match what v1 already had, so no change needed there.

**The funnel strip (§5.2 in v1, unchanged in structure):** track color becomes `var(--color-stone-muted)`; the first three bars fill `var(--color-ink)` (structural, not chromatic); the **last bar only — "Overall Conversion"** — fills `var(--color-cyan)`. That's the single most important number on the strip, so it gets the single accent color. Everything else earns its emphasis from being black-on-white, not from competing for color.

**Charts (Signals tab, same three widgets as v1 §5.6/§6, recolored):**
- Lead Velocity line: `var(--color-cyan-edge)` stroke, `var(--color-sky-wash)` fill underneath, on a plain white card.
- Discovery Heatmap: `var(--color-soot)` panel, filled dots `var(--color-cyan)`, empty dots `var(--color-soot-dot-off)`.
- Source Mix donut: two-tone only — `var(--color-cyan)` for the largest segment, `var(--color-stone-muted)` for the remainder (don't give each of the 3 platforms its own color; if you need to distinguish reddit/x/instagram specifically, do it in the legend labels, not with 3 competing hues).

---

## 5. Component Deltas (only what changes from v1 — structure stays, skin doesn't)

### 5.1 Header
Full-bleed per §2. Background `var(--color-canvas)` (it should read as part of the page, not a separate white bar). Nav pill container: `var(--color-paper)` bg, hairline border. Active pill: soot fill (unchanged from v1). "Export Leads" becomes the cyan primary button; any secondary header button (Sync, etc.) becomes a ghost button per §4.

### 5.2 Greeting + Funnel Strip
Headline typeface changes to Inter Tight, weight 400, tight tracking (`tracking-tight` / `-0.02em`) instead of `font-bold` — this is the single biggest typographic shift from v1's bold-black-SaaS voice to the quieter editorial voice. Apply Seline's **highlight span** trick once, on the number that matters most in the headline (e.g. wrap the lead count in a `var(--color-sky-wash)` pill with `var(--color-cyan-edge)` text) — this is the one inline color moment in the whole headline. Funnel bars per §4.

### 5.3 KPI Cards
`var(--radius-cards)` (12px, down from 24px), `32px` padding, `var(--shadow-subtle)`/`.card-flat` instead of the old heavier hover shadow. Icon chip background becomes `var(--color-stone-100)`. High-Intent card's badge uses the sky-wash/cyan-edge treatment from §4 (this replaces its old red flame badge).

### 5.4 Kanban Columns & Lead Cards
Column shell: `var(--color-stone-100)`, `var(--radius-shell)` (20px). Lead card: `var(--color-paper)`, `var(--radius-cards)` (12px), `.card-flat`. Author initials chip (kept from v1) — recolor to a single neutral treatment (`var(--color-stone-100)` bg, `var(--color-ink)` text) rather than per-platform colors, to stay inside the one-accent system; if you want platform to still be visually distinguishable, use the platform's lucide icon next to the author name instead of a colored chip. Pain point box: `var(--color-stone-100)`. Status select and "Inspect Pitch": ghost button style. All anti-clipping rules from v1 §7 still apply unchanged — do not reintroduce `line-clamp`/`truncate`.

### 5.5 Feed View + Inspector Panel
Feed rows: same treatment as lead cards above. **The Inspector Panel is the one element in this entire redesign allowed the deep `--shadow-xl` treatment** (Seline's "Floating Dashboard Preview" is the one card per page allowed to feel elevated — this is our equivalent). Everything else in the app stays flat/hairline-bordered; this panel is the deliberate exception, which makes it feel like the focal point it actually is. Inset boxes inside it (Identified Problem, Original Post Context, AI Pitch) use `var(--color-stone-100)`.

### 5.6 Signals Tab
Same bento structure as v1 §5.6 (Bottleneck Categories / High-Intent Prospects / Lead Velocity / Discovery Heatmap / Source Mix / Recommended Next Action banner). Recolor per §4's chart rules above. "Recommended Next Action" banner: drop the emerald-tinted treatment from v1, use `var(--color-stone-100)` background with a cyan-edge left border accent (`border-l-2 border-[var(--color-cyan-edge)]`) instead — keeps the one-accent discipline while still visually flagging it as a callout.

### 5.7 Drawer
Same slide-over mechanics as v1. Restyle to `var(--color-paper)` background, hairline border instead of heavy `shadow-2xl` — or, if you'd rather keep one more "elevated" moment, the drawer *or* the inspector panel gets `--shadow-xl`, not both (pick one; don't spend the deep-shadow exception twice).

---

## 6. Typography Application

| Role | Font | Weight | Size | Tracking |
|---|---|---|---|---|
| Page headline ("4 leads across…") | Inter Tight | 400 | 32px | -0.02em |
| Section eyebrow (PIPELINE OVERVIEW, uppercase labels) | Inter | 500 | 11px | 0.05em |
| Card heading (column titles, widget titles) | Inter Tight | 500 | 15px | -0.01em |
| Body / lead titles / pain point text | Inter | 400 | 14px | normal |
| Micro/meta text (author, timestamps, counts) | Inter | 400 | 12px | normal |

Never set a heading in weight 600/700 to "make it pop" — per §0, the restraint is the point; if something needs emphasis, give it the cyan accent or more size, not more weight.

---

## 7. Anti-Clipping — still in force, unchanged from v1

This requirement doesn't get weaker just because the shell is wider. Keep every rule from v1 §7 (no `line-clamp`/`truncate` on unbounded text, `overflow-hidden` only paired with a scrolling child, `flex-wrap` on every badge row, SVG viewBox padding, no fixed-width selects). The wider full-bleed layout should make this *easier* to satisfy, not be treated as a reason to skip re-checking it.

---

## 8. File Map

| File | Change |
|---|---|
| `app/globals.css` | Replace `@theme` + helper classes with §1 in full. |
| `app/layout.tsx` | Swap `Geist` for `Inter` + `Inter Tight` per §1. |
| `app/page.tsx` | Remove `max-w-7xl mx-auto` everywhere (§2); apply the color/status system in §4; apply component deltas in §5; keep all v1 structural additions (funnel strip, KPI icon chips, initials chips, Signals bento widgets) as-is, recolored only. |
| `components/*.tsx` | Still unused/dead code — still out of scope. |

---

## 9. Non-Goals

- No new npm dependencies (still hand-rolled SVG/CSS for charts, per v1 §6).
- No mobile support of any kind in this pass — that's an explicit, deliberate scope cut, not an oversight.
- No change to data model, filtering logic, localStorage schema, or API routes.
