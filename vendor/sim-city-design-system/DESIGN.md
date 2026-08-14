# SIM CITY DESIGN SYSTEM — the bible

Interface chrome in the idiom of a 1993 city simulator. Read this whole file
before writing any component. Every rule here is absolute unless it says
otherwise. Study `src/components/Button/` as the canonical example of file
layout, CSS voice, and story format, and `src/tokens/tokens.css` +
`src/styles/base.css` for the raw material.

## The three laws

1. **Depth is drawn, not blurred.** Every raised surface is a flat mid-tone
   face with a 2px light edge on the top and left and a 2px dark edge on the
   bottom and right; every sunken one is the same trick inverted. There are
   **no box-shadows, no border-radius, no blur, no opacity fades and no smooth
   gradients anywhere**. Pressing something flips its bevel. That flip is the
   entire affordance vocabulary.
2. **Texture is dithered.** Where a gradient, tint or wash would normally go,
   use a hard-stop `repeating-linear-gradient` at 1–2px pitch (see `.dither`,
   `.warn-band`, the dialog scrim, the pinstriped title bar). A 256-colour
   display could not blend; neither do we.
3. **Type is small, monospaced, whole-pixel.** Base is 11px `var(--mono)`.
   Labels, headings, and buttons are UPPERCASE with letter-spacing (0.06em to
   0.14em). Numeric readouts use `font-variant-numeric: tabular-nums`. Nothing
   is fetched: no webfonts, no icon fonts, no external assets, no runtime deps
   beyond `react`/`react-dom`.

## Tokens (never hardcode a colour)

From `src/tokens/tokens.css`, themed via `data-chrome="dark|light"` on `<html>`
(Storybook has a Chrome toolbar switch — every component must look right in
both):

- Surfaces: `--face` (base), `--face-raised`, `--face-sunken`, `--face-deep`
  (app background / deepest wells)
- Edges: `--edge-light`, `--edge-dark` (the only two bevel colours)
- Ink: `--ink`, `--ink-dim` (secondary), `--ink-disabled`, `--ink-invert`
- Accent: `--accent` (amber; selection, focus, the active part of things) with
  `--accent-ink` text on it; `--accent-2` (teal; activity, progress)
- Status: `--ok`, `--warn`, `--danger`
- Map surface tokens (`--map-*`) exist for map-flavoured components only.

## Recipes

- **Raised bevel**: `border: 2px solid; border-color: var(--edge-light)
  var(--edge-dark) var(--edge-dark) var(--edge-light); background: var(--face)`
  (or `--face-raised` for interactive things).
- **Sunken bevel** (inputs, wells, pressed states): same with the colours
  swapped and `background: var(--face-sunken)`.
- **Hover** on an interactive raised surface: shift background one step
  (`--face-raised` → `--face`). **Active/pressed/selected**: invert the bevel
  and sink the face. Toggled-on things may also take `color: var(--accent)`.
- **Focus**: `:focus-visible { outline: 2px solid var(--accent); }` with
  `outline-offset: 1px` outside or `-2px` inside sunken fields. Never remove
  focus outlines without replacing them.
- **Disabled**: `color: var(--ink-disabled); cursor: default`. No opacity.
- **Selection/highlight** (menu items, listbox options): `background:
  var(--accent); color: var(--accent-ink)` — full-strength, hard-edged.
- **Separators**: the `.rule` groove (1px dark over 1px light) or a plain
  2px `--edge-dark` line.
- **Progress/activity**: marching hard blocks, never a smooth bar — see the
  `pulse` recipe in infinimap (repeating-linear-gradient of `--accent-2`
  blocks, `animation: steps(...)`). All animation uses `steps()`; nothing
  eases. Respect `prefers-reduced-motion` (base.css already kills animation).
- **Scrims** (behind modals): a 45° hard-stop checker of dark 2px stripes over
  `rgba(6,10,9,0.35)` — never a soft translucent wash.
- **Danger zones**: hatched bands (`--danger` 2px stripes on 8px pitch on a
  sunken face), not tinted backgrounds.
- Spacing: whole pixels, small values (2/3/4/6/8/12). Hit targets for tools
  ~42px, buttons `5px 12px` padding, compact `3px 6px`.

## Icons

`src/icons/PixelIcon.tsx`, backed by the vendored @gravity-ui/icons set in
`src/icons/gravity/` (MIT — see `LICENSE` and `VENDORED.md` there; the svgs
are byte-identical to the upstream tag and are never edited). Each name in
the fixed vocabulary maps onto one Gravity SVG, inlined at build time via a
Vite `?raw` import — no runtime fetches, no icon fonts. Icons are strictly
monochrome: every path carries `fill="currentColor"`, so glyphs follow
pressed and disabled states and never fight the chrome. Use only names in
the `ICONS` registry inside `PixelIcon.tsx`. If your component needs a glyph
that does not exist, pick the closest SVG in `icons/gravity/svgs/` and add
one `name: import` line to the registry — never edit an SVG, and never
inline SVG markup in a component. Render at multiples of 16px.

## Behaviour and accessibility (non-negotiable)

The look is 1993; the behaviour is current. Every component follows its WAI-ARIA
APG pattern by hand — no headless libraries:

- Full keyboard support per APG (arrow keys, Home/End, Escape, typeahead where
  the pattern calls for it). Roving tabindex for composite widgets.
- Modals trap focus, restore focus to the opener on close, close on Escape,
  and set `aria-modal`/labelled-by/described-by. Render overlays with
  `createPortal` to `document.body`.
- Proper roles/states: `aria-pressed`, `aria-expanded`, `aria-checked`,
  `aria-selected`, `aria-activedescendant` or roving tabindex, `aria-invalid`,
  `aria-describedby` for help/error text.
- Pointer interactions must not break keyboard or screen-reader flows.
- Controlled AND uncontrolled modes for stateful inputs (`value`/
  `defaultValue`, `open`/`defaultOpen`, plus `onChange`-style callbacks).

## Code conventions

- React 19 + TypeScript strict. Function components only, named exports, no
  `forwardRef` (React 19 passes `ref` as a normal prop if needed). No `"use
  client"` directives (this is not Next). No default exports except story meta.
- `tsconfig` has `noUnusedLocals`/`noUnusedParameters` — keep code clean.
- Imports use the `@/` alias for cross-folder references (`@/icons/PixelIcon`,
  `@/components/Button`).
- One folder per component: `src/components/<Name>/<Name>.tsx`, `<Name>.css`
  (imported by the tsx), `<Name>.stories.tsx`, `index.ts` re-exporting the
  public surface. Small sibling components may share the folder.
- CSS classes are namespaced BEM-lite: `.sc-<block>`, `.sc-<block>__<element>`,
  `.sc-<block>--<modifier>`. Never style bare tags outside your block. Do not
  edit shared files (`base.css`, `tokens.css`, other components' folders).
- Comment voice: sparse, declarative, explaining *why the design is what it
  is*, in the manner of the file headers in this repo. No boilerplate comments.
- Reuse existing components rather than re-rolling them (patterns import
  Button, TextField, etc.).
- Shared infrastructure in `src/lib/`: `cx` (class join),
  `useControllableState`, and `@/lib/overlays` — `Portal`, `useDismissable`
  (Escape + outside pointerdown), `useAnchorPosition` (fixed-position anchored
  placement with flip/clamp), `useFocusTrap` (trap + restore). Anything that
  floats uses these; do not write your own portal or positioning code.

## Stories

CSF3, `satisfies Meta<typeof X>`, `tags: ['autodocs']`. Title categories are
fixed — use exactly one of:
`Primitives/…`, `Forms/…`, `Overlays/…`, `Navigation/…`, `Data/…`,
`Feedback/…`, `Chrome/…`, `Icons/…`, `Patterns/Forms/…`, `Patterns/Layouts/…`.

Every component ships stories covering: each variant, disabled/error/empty
states where they exist, a composed "kitchen sink" story, and — for stateful
widgets — a controlled example. Copy in stories is in-world: this is city
government software (zoning, surveys, ordinances, budgets, permits), never
lorem ipsum. Keep story copy dry and municipal: "RESIDENTIAL ZONING PERMIT",
"Form R-1: Notice of Proposed Bulldozing", tax rates, water budgets.

Stories that need a fixed-size stage can set `parameters: { layout:
'padded' }` or `'fullscreen'` (page layouts use fullscreen).

Docs descriptions (`parameters.docs.description.*`) and prop JSDoc are
rendered as **markdown, with raw HTML passed through**. Always backtick tag
names in prose (`` `<body>` ``, `` `<label>` ``) — an unescaped structural tag
becomes a real element on the docs page; a literal `<body>` once hard-locked
a docs page in an infinite layout loop.

## What "done" means

`npx tsc -b` passes; stories render in both chrome variants; keyboard walk
works; no console errors; no rule of the three laws broken.
