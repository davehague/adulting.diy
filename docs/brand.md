# Adulting.DIY Brand Guide

## Brand Essence

**Tagline:** "Your home. Your dog. Your life. Managed."

**Brand personality:** Cozy, approachable, warm — like a well-organized kitchen with wood countertops. Adulting.DIY acknowledges that managing a household is work, but doesn't make it feel like *work*. It's the supportive friend who has a system for everything but never makes you feel bad about it.

**Target audience:** Adults (couples, roommates, families without young children) who share a household and want to stay on top of recurring responsibilities without the dread.

**Market positioning:** Sits in the gap between kid-focused gamified chore apps (OurHome, Homey) and cold productivity tools (Todoist, Cozi). Warm but not childish. Organized but not corporate. Encouraging but not patronizing.

---

## Color Palette

The palette is "Warm Bold" — deep charcoal anchors the design, warm amber/honey drives action, and warm neutrals create a cozy canvas.

### Primary Colors

| Name | Hex | Tailwind Token | Usage |
|------|-----|----------------|-------|
| **Charcoal** | `#1C1917` | `stone-900` | Headings, primary text, high-emphasis elements |
| **Honey** | `#D97706` | `amber-600` | Primary CTA buttons, active states, links, brand accent |
| **Honey Dark** | `#B45309` | `amber-700` | Hover state for primary buttons, pressed states |
| **Honey Light** | `#FEF3C7` | `amber-100` | Subtle amber backgrounds, selected states, highlights |

### Neutral Colors

| Name | Hex | Tailwind Token | Usage |
|------|-----|----------------|-------|
| **Warm White** | `#FAFAF9` | `stone-50` | Page background |
| **White** | `#FFFFFF` | `white` | Card/surface backgrounds |
| **Warm Gray 100** | `#F5F5F4` | `stone-100` | Subtle section backgrounds, table headers |
| **Warm Gray 200** | `#E7E5E4` | `stone-200` | Borders, dividers |
| **Warm Gray 300** | `#D6D3D1` | `stone-300` | Input borders, disabled states |
| **Warm Gray 500** | `#78716C` | `stone-500` | Muted/secondary text, placeholders |
| **Warm Gray 700** | `#44403C` | `stone-700` | Body text |

### Semantic Colors

| Name | Hex | Tailwind Token | Usage |
|------|-----|----------------|-------|
| **Success** | `#16A34A` | `green-600` | Completed tasks, positive feedback |
| **Success Light** | `#DCFCE7` | `green-100` | Success badges/backgrounds |
| **Warning** | `#EA580C` | `orange-600` | Overdue tasks, attention needed |
| **Warning Light** | `#FFF7ED` | `orange-50` | Warning backgrounds |
| **Error** | `#DC2626` | `red-600` | Destructive actions, errors |
| **Error Light** | `#FEF2F2` | `red-50` | Error backgrounds |
| **Info** | `#0284C7` | `sky-600` | Informational elements |
| **Info Light** | `#F0F9FF` | `sky-50` | Info backgrounds |

### Color Rules

1. **Never use cold blue as the primary action color.** Honey/amber is the brand color. Blue is reserved for informational elements only.
2. **Use `stone` scale instead of `gray`** everywhere — stone has warm undertones that match the brand.
3. **Page background is `stone-50`**, not pure white — this creates warmth without sacrificing readability.
4. **Cards are `white`** to lift off the warm background.
5. **Avoid pure black** (`#000000`). Use `stone-900` (`#1C1917`) for maximum contrast text.

---

## Typography

### Font Pairing

| Role | Font | Weight Range | Google Fonts |
|------|------|-------------|-------------|
| **Headings** | Lora | 500 (Medium), 600 (SemiBold), 700 (Bold) | `Lora:wght@500;600;700` |
| **Body / UI** | Plus Jakarta Sans | 400 (Regular), 500 (Medium), 600 (SemiBold) | `Plus+Jakarta+Sans:wght@400;500;600` |

**Why this pairing:** Lora is a warm, readable serif that adds personality and maturity to headings without feeling old-fashioned. Plus Jakarta Sans has slightly rounded terminals that give it a friendlier, warmer feel than Inter or system fonts — perfectly matching the cozy brand.

### Type Scale

| Element | Font | Size | Weight | Color |
|---------|------|------|--------|-------|
| Page title (h1) | Lora | `text-2xl` / `text-3xl` | 700 | `stone-900` |
| Section heading (h2) | Lora | `text-xl` / `text-2xl` | 600 | `stone-900` |
| Card heading (h3) | Lora | `text-lg` | 600 | `stone-900` |
| Subheading | Plus Jakarta Sans | `text-base` | 600 | `stone-700` |
| Body text | Plus Jakarta Sans | `text-sm` / `text-base` | 400 | `stone-700` |
| Small / caption | Plus Jakarta Sans | `text-xs` | 500 | `stone-500` |
| Button label | Plus Jakarta Sans | `text-sm` | 600 | varies |
| Table header | Plus Jakarta Sans | `text-xs` | 600 | `stone-500` |

### Typography Rules

1. **Headings always use Lora.** This is the single biggest differentiator from generic SaaS.
2. **Everything else uses Plus Jakarta Sans.** Buttons, labels, body text, navigation.
3. **Avoid `font-bold` (700) on body font** — use `font-semibold` (600) max for emphasis.
4. **Table headers:** Use `uppercase tracking-wider text-xs font-semibold` in Plus Jakarta Sans, NOT Lora.

---

## Logo & Wordmark

### Wordmark Treatment

The logo is text-based, using the heading font:

- **"Adulting"** — Lora, SemiBold (600), `stone-900`
- **".DIY"** — Lora, Medium (500), `amber-600`

This creates visual interest without requiring a graphic logo. The amber ".DIY" acts as the brand accent.

### Favicon / App Icon

Keep the existing house+wrench icon from `/public/`. It works well at small sizes and communicates the app's purpose.

### Usage Rules

1. Wordmark always appears in the header nav, left-aligned.
2. Never render the brand name in the body/UI font — always Lora.
3. The ".DIY" portion always uses the honey/amber accent color.

---

## Component Patterns

### Buttons

| Variant | Background | Text | Border | Hover |
|---------|-----------|------|--------|-------|
| **Primary** | `amber-600` | `white` | none | `amber-700` |
| **Secondary** | `white` | `stone-700` | `stone-300` | `stone-50` bg |
| **Ghost** | transparent | `stone-600` | none | `stone-100` bg |
| **Danger** | `red-600` | `white` | none | `red-700` |

All buttons: `rounded-lg px-4 py-2 text-sm font-semibold transition-colors duration-150`

### Cards

```
bg-white rounded-xl shadow-sm border border-stone-200
hover: shadow-md transition-shadow duration-200
padding: p-5 or p-6
```

Note: `rounded-xl` (not `rounded-lg`) — slightly softer corners reinforce the cozy feel.

### Form Inputs

```
bg-white border border-stone-300 rounded-lg px-3 py-2 text-sm
placeholder: text-stone-400
focus: border-amber-500 ring-2 ring-amber-500/20
```

Focus rings use amber (not blue) to match the brand.

### Badges / Status Pills

| Status | Background | Text |
|--------|-----------|------|
| Default / Created | `stone-100` | `stone-700` |
| Active / Assigned | `amber-100` | `amber-800` |
| Completed | `green-100` | `green-800` |
| Skipped | `stone-100` | `stone-500` |
| Overdue | `orange-100` | `orange-800` |
| Paused | `sky-100` | `sky-800` |
| Admin role | `amber-100` | `amber-800` |

All badges: `rounded-full px-2.5 py-0.5 text-xs font-semibold`

### Navigation

- Active link: `border-b-2 border-amber-500 text-stone-900`
- Inactive link: `border-b-2 border-transparent text-stone-600 hover:text-stone-900 hover:border-stone-300`

### Tables

- Header row: `bg-stone-50` with `text-xs font-semibold text-stone-500 uppercase tracking-wider`
- Row hover: `hover:bg-stone-50 transition-colors duration-150`
- Dividers: `divide-y divide-stone-200`

---

## Micro-Animations

### Principles

1. **Subtle, not showy.** Animations support the interaction, never distract.
2. **Fast.** 150-200ms for most transitions. 300ms max for page-level changes.
3. **Ease curves.** Use `ease-out` for entrances, `ease-in` for exits.

### Specific Animations

| Element | Animation | Duration |
|---------|-----------|----------|
| Button hover | Background color shift | `150ms ease` |
| Card hover | Shadow elevation | `200ms ease` |
| Page transitions | Fade + slight upward slide | `200ms ease-out` |
| Task completion checkbox | Scale bounce + color fill | `300ms ease` |
| Dropdown open | Fade in + scale from 95% | `150ms ease-out` |
| Dropdown close | Fade out | `100ms ease-in` |
| Toast notifications | Slide in from top-right | `200ms ease-out` |
| Badge status change | Brief pulse | `300ms ease` |

### CSS Utilities to Define

```css
/* Base transition for interactive elements */
.transition-interactive {
  transition: all 150ms ease;
}

/* Satisfying checkbox completion */
@keyframes check-bounce {
  0% { transform: scale(1); }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); }
}
```

---

## Personality & Voice (UI Copy)

### Approach: Subtle Warmth

The UI is clean and functional. Personality appears in **strategic moments only**:

| Context | Tone | Example |
|---------|------|---------|
| **Empty states** | Encouraging, light humor | "Nothing due today. Go enjoy your couch." |
| **Task completed** | Warm acknowledgment | "Done! One less thing to worry about." |
| **All tasks done** | Celebratory | "You're all caught up. Impressive." |
| **Error states** | Honest, helpful | "Something went wrong. Give it another shot." |
| **Onboarding** | Friendly guide | "Let's get your household set up." |
| **Standard UI** | Clear, functional | "Create task", "Save changes", "Assign" |

### Copy Rules

1. **Buttons and labels stay functional.** "Save", "Create task", "Assign" — not "Let's do this!"
2. **Personality lives in states**, not controls.
3. **Never be snarky about the user's habits.** The app is supportive, not judgmental.
4. **Use "household" not "team"** in user-facing copy (team is for code/docs only).

---

## Spacing & Layout

### Principles

- **Organized & Glanceable** — Information-rich but well-structured. Cards and sections give a dashboard overview.
- **Consistent rhythm** — Stick to Tailwind's spacing scale: `4, 6, 8, 12, 16, 24` (in Tailwind units).

### Page Layout

```
Page background: stone-50
Content max-width: max-w-7xl mx-auto
Page padding: px-4 sm:px-6 lg:px-8 py-6
Section spacing: space-y-6
Card grid gap: gap-5 or gap-6
```

### Card Density

Cards should be information-rich. Prefer showing key metadata (assignee, due date, status) inline rather than requiring a click to see details.

---

## Shadows & Depth

| Level | Class | Usage |
|-------|-------|-------|
| **Flat** | none | Inline elements, badges |
| **Resting** | `shadow-sm` | Cards at rest, form inputs |
| **Raised** | `shadow-md` | Cards on hover, dropdowns |
| **Overlay** | `shadow-lg` | Modals, popovers |

Keep shadows subtle — the warm color palette provides enough visual hierarchy without heavy shadows.

---

## Tailwind Configuration Summary

The following customizations should be added to `tailwind.config.ts`:

1. **Font families:** `heading: ['Lora', 'serif']` and `body: ['Plus Jakarta Sans', 'sans-serif']`
2. **Default font:** Set Plus Jakarta Sans as the default sans-serif
3. **Custom colors (optional):** Alias `honey` to amber scale for semantic clarity
4. **Border radius:** Default components use `rounded-lg` or `rounded-xl`

### Color Token Mapping

For ease of use across the codebase, consider these Tailwind `extend.colors` aliases:

```js
colors: {
  honey: {
    50: '#FFFBEB',   // amber-50
    100: '#FEF3C7',  // amber-100
    200: '#FDE68A',  // amber-200
    500: '#F59E0B',  // amber-500
    600: '#D97706',  // amber-600
    700: '#B45309',  // amber-700
    800: '#92400E',  // amber-800
  }
}
```

---

## What NOT to Do

1. **No cold blue as primary action color.** Blue is the old brand. Honey/amber is the new primary.
2. **No `gray-*` classes.** Always use `stone-*` for warm undertones.
3. **No `rounded-md` on cards.** Use `rounded-xl` for the cozy, soft feel.
4. **No system fonts.** Always load Lora + Plus Jakarta Sans.
5. **No personality in standard UI controls.** Save it for empty states and feedback moments.
6. **No pure black or pure white backgrounds.** Use `stone-900` and `stone-50`.
7. **No dark mode (for now).** Light mode only. Design for it and don't paint yourself into a corner, but don't implement it.
