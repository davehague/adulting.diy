# Button Style Refresh

## Problem
Current buttons use a "traffic light" pattern — amber, yellow, red side-by-side — that feels too colorful, too plain, too chunky, and too similar to each other. The style reads as generic Material UI rather than intentional design.

## Design: Icon-Forward Compact + Ghost Hierarchy

Compact buttons with Lucide icons. Only the primary action per context gets a filled style; everything else is ghost (transparent background, visible on hover).

### Variants

| Variant | Classes |
|---------|---------|
| **Primary** | `inline-flex items-center gap-1.5 bg-amber-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50` |
| **Ghost** | `inline-flex items-center gap-1.5 text-stone-600 text-sm font-medium px-2.5 py-1.5 rounded-lg hover:bg-stone-100 transition-colors disabled:opacity-50` |
| **Ghost Destructive** | `inline-flex items-center gap-1.5 text-red-500 text-sm font-medium px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50` |

### Icon Mapping (Lucide, 16px via :size="16")

- Edit / Pencil → `Pencil`
- Pause → `Pause`
- Unpause / Resume → `Play`
- Delete → `Trash2`
- Save / Create → `Check`
- Cancel → `X`
- Complete → `CheckCircle`
- Skip → `SkipForward`
- Back / Navigate → `ArrowLeft`
- Copy → `Copy`
- Add Comment → `MessageSquare`
- View → `Eye`
- Settings / Manage → `Settings`
- Logout / Sign out → `LogOut`
- Login → `LogIn`
- New Task → `Plus`
- Catch Up → `FastForward`
- Share → `Share`
- Refresh / Regenerate → `RefreshCw`

### Hierarchy Rule

One filled (primary) button per context. All other actions are ghost. Destructive actions use ghost-destructive.

### Exclusions

- Landing page hero buttons (`pages/index.vue`) — keep their existing large CTA style
- Dropdown menu items — keep existing text-style items unchanged
- Tab toggles (e.g. Create/Join on setup-household) — keep existing toggle style
- Inline text links (e.g. "View all occurrences →") — keep as text links
