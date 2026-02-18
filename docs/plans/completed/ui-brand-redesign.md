# UI Brand Redesign — Implementation Plan

**Reference:** [docs/brand.md](../brand.md)

## Scope

Transform the Adulting.DIY UI from generic Tailwind defaults to the Cozy & Approachable "Warm Bold" brand defined in the brand guide. 27 Vue files need changes across layouts, pages, and components.

---

## Phase 1: Foundation (do first — everything else depends on this)

### 1.1 — Add Google Fonts to nuxt.config.ts
- Add Lora (500, 600, 700) and Plus Jakarta Sans (400, 500, 600) via `<link>` tags in `app.head.link`
- ~5 min

### 1.2 — Update tailwind.config.ts
- Add `fontFamily` overrides: `heading: ['Lora', 'serif']`, `sans: ['Plus Jakarta Sans', 'sans-serif']`
- Add `honey` color alias mapping to amber scale
- Optionally extend `borderRadius` defaults
- ~5 min

### 1.3 — Add global base styles
- Create `assets/css/main.css` (or add to nuxt.config.ts CSS array)
- Set default body font to Plus Jakarta Sans
- Define `.font-heading` utility or configure `@layer` for heading elements
- Add micro-animation keyframes (check-bounce, fade-in, etc.)
- Add `transition-interactive` utility class
- ~10 min

---

## Phase 2: Layouts (do second — sets the frame for everything)

### 2.1 — Update layouts/default.vue
- **Background**: `bg-gray-100` → `bg-stone-50`
- **Header**: White bg stays, but brand name becomes Lora wordmark ("Adulting" in stone-900, ".DIY" in amber-600)
- **Nav links**: `border-blue-500` active → `border-amber-500`, text colors to stone scale
- **Avatar fallback**: `bg-blue-500` → `bg-amber-600`
- **Dropdown**: Ring/shadow stays, text colors to stone scale
- **Footer**: Text color `text-gray-500` → `text-stone-500`
- **All gray-***: Convert to stone-* equivalents
- ~15 min

### 2.2 — Update layouts/landing.vue
- **Background gradient**: `from-blue-50 to-white` → `from-stone-50 to-white` (or `from-amber-50/30 to-white` for warmth)
- **Brand name**: Same Lora wordmark treatment as default layout
- **Footer**: gray → stone
- ~5 min

---

## Phase 3: Landing Page (high-visibility, do early)

### 3.1 — Redesign pages/index.vue
- **Hero section**: Replace dark gray gradient with warm treatment. Options:
  - Warm white bg with charcoal text (matches app interior)
  - Subtle warm gradient: `from-stone-900 to-stone-800` (keeps drama but warmer)
- **CTA buttons**: `bg-blue-600` → `bg-amber-600`, hover → `bg-amber-700`
- **Feature cards**: `bg-gray-800` → styled for warm palette (could be white cards on warm bg, or `bg-stone-800`)
- **Feature icons**: `text-blue-400` → `text-amber-400`
- **All gray text**: `text-gray-400` → `text-stone-400`
- **Typography**: Hero text in Lora, feature headings in Lora, descriptions in Plus Jakarta Sans
- **Section headings**: Apply `font-heading` (Lora)
- **Rounded corners**: `rounded-lg` → `rounded-xl` on cards
- ~20 min

---

## Phase 4: Global Color Swap (bulk of the work)

This phase is mostly mechanical find-and-replace within each file, but requires manual review to ensure context-appropriate replacements.

### 4.1 — Gray → Stone conversion (all 23 files)

Straightforward replacements:
| Find | Replace |
|------|---------|
| `gray-50` | `stone-50` |
| `gray-100` | `stone-100` |
| `gray-200` | `stone-200` |
| `gray-300` | `stone-300` |
| `gray-400` | `stone-400` |
| `gray-500` | `stone-500` |
| `gray-600` | `stone-600` |
| `gray-700` | `stone-700` |
| `gray-800` | `stone-800` |
| `gray-900` | `stone-900` |

This can be done as a bulk operation across all `.vue` files.

### 4.2 — Blue → Amber/Honey conversion (22 files)

Requires more judgment — not all blues map the same way:

| Context | Find | Replace |
|---------|------|---------|
| Primary buttons | `bg-blue-500` / `bg-blue-600` | `bg-amber-600` |
| Button hover | `hover:bg-blue-600` / `hover:bg-blue-700` | `hover:bg-amber-700` |
| Active nav | `border-blue-500` | `border-amber-500` |
| Links | `text-blue-600` | `text-amber-700` |
| Link hover | `hover:text-blue-800` | `hover:text-amber-800` |
| Focus rings | `focus:ring-blue-500` / `ring-blue-200` | `focus:ring-amber-500` / `ring-amber-200` |
| Focus borders | `focus:border-blue-500` | `focus:border-amber-500` |
| Badge (info) | `bg-blue-100 text-blue-800` | `bg-amber-100 text-amber-800` |
| Checkbox active | `border-blue-600 bg-blue-600` | `border-amber-600 bg-amber-600` |
| Avatar fallback | `bg-blue-500` | `bg-amber-600` |
| Feature icons | `text-blue-400` | `text-amber-400` |

### 4.3 — Files to update (in recommended order)

**Layouts** (2 files):
1. `layouts/default.vue`
2. `layouts/landing.vue`

**Pages** (13 files):
3. `pages/index.vue` (landing)
4. `pages/login.vue`
5. `pages/home.vue`
6. `pages/setup-household.vue`
7. `pages/tasks/index.vue`
8. `pages/tasks/create/index.vue`
9. `pages/tasks/[id]/index.vue`
10. `pages/tasks/[id]/edit/index.vue`
11. `pages/tasks/[id]/occurrences/index.vue`
12. `pages/occurrences/index.vue`
13. `pages/occurrences/[id]/index.vue`
14. `pages/household/index.vue`
15. `pages/profile/index.vue`

**Components** (10 files):
16. `components/AppHeader.vue`
17. `components/AppFooter.vue`
18. `components/TaskDetails.vue`
19. `components/NotificationPreferences.vue`
20. `components/tasks/TaskCreateForm.vue`
21. `components/tasks/TaskEditForm.vue`
22. `components/occurrences/OccurrenceEditForm.vue`
23. `components/occurrences/OccurrenceTimeline.vue`
24. `components/occurrences/SkipModal.vue`
25. `components/DevUserSwitcher.vue`
26. `components/DevUserSwitcherDebug.vue`

---

## Phase 5: Typography Pass

After colors are done, go through each file and apply heading fonts:

### 5.1 — Add `font-heading` class to all headings
- Page titles (`text-2xl font-bold`) → add `font-heading`
- Section headings → add `font-heading`
- Card headings → add `font-heading`
- Brand name in nav → add `font-heading`

### 5.2 — Review font weights
- Replace `font-bold` on body text with `font-semibold` where appropriate
- Ensure table headers use body font (Plus Jakarta Sans), not heading font

---

## Phase 6: Component Refinement

### 6.1 — Card styling
- Update all card containers: `rounded-lg` → `rounded-xl`
- Ensure `border border-stone-200` on all cards
- Add `hover:shadow-md transition-shadow duration-200` where interactive

### 6.2 — Button consistency
- Audit all buttons match the brand guide patterns
- Primary: `bg-amber-600 hover:bg-amber-700 text-white rounded-lg`
- Secondary: `bg-white border border-stone-300 text-stone-700 hover:bg-stone-50 rounded-lg`
- Danger: `bg-red-600 hover:bg-red-700 text-white rounded-lg`
- All: `px-4 py-2 text-sm font-semibold transition-colors duration-150`

### 6.3 — Form inputs
- Focus states: `focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20`
- Border: `border-stone-300`
- Rounded: `rounded-lg`

### 6.4 — Badge/pill updates
- Match the status color mappings in brand guide
- Ensure consistent `rounded-full px-2.5 py-0.5 text-xs font-semibold`

---

## Phase 7: Micro-Animations

### 7.1 — Page transitions
- Add Nuxt page transition with fade + slight upward slide
- Configure in `nuxt.config.ts` or `app.vue`

### 7.2 — Interactive element transitions
- Ensure all buttons have `transition-colors duration-150`
- Cards with hover: `transition-shadow duration-200`
- Dropdowns: `transition-all duration-150` with scale/opacity

### 7.3 — Task completion animation
- Add satisfying scale-bounce keyframe on checkbox/complete action
- CSS-only, defined in global styles

---

## Phase 8: Review & Polish

### 8.1 — Visual QA
- Walk through every page in the app and verify:
  - No remnant blue-* or gray-* classes
  - All headings use Lora
  - All body text uses Plus Jakarta Sans
  - Focus rings are amber, not blue
  - Cards have consistent rounded-xl + border treatment
  - Badges match the brand guide status mapping

### 8.2 — Responsive check
- Verify landing page looks good on mobile
- Verify nav/header on small screens
- Check card grids collapse properly

### 8.3 — Performance
- Confirm Google Fonts load efficiently (preconnect, font-display: swap)
- No layout shift from font loading

---

## Estimated Effort

| Phase | Files | Effort |
|-------|-------|--------|
| Phase 1: Foundation | 3 | Small |
| Phase 2: Layouts | 2 | Small |
| Phase 3: Landing Page | 1 | Medium |
| Phase 4: Color Swap | 27 | Large (but mechanical) |
| Phase 5: Typography | 27 | Medium |
| Phase 6: Component Refinement | 15 | Medium |
| Phase 7: Micro-Animations | 3-5 | Small |
| Phase 8: Review | 0 | Small |

**Recommended approach:** Phases 1-3 first (foundation + most visible changes), then Phase 4 as a bulk operation, then 5-7 as refinement passes. Phase 4 (gray→stone) can be partially automated with find-and-replace.

---

## Parallelization Opportunities

These phases can be worked on independently by separate agents:

- **Agent A**: Phase 1 (foundation) → Phase 2 (layouts) → Phase 3 (landing page)
- **Agent B** (after Phase 1 completes): Phase 4 (color swap across all files)
- **Agent C** (after Phase 4 completes): Phase 5 (typography) + Phase 6 (component refinement)
- **Agent D** (after Phase 1 completes): Phase 7 (micro-animations in global CSS)

Or sequentially by a single agent, following phase order.
