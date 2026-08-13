# Installing the SIM CITY DESIGN SYSTEM in another project

The design system is distributed as a **versioned source tarball** that you
vendor into each consuming project — no npm registry, no git submodules. You
unpack it to a predictable path, commit it like any other code, and your
bundler compiles it alongside your app. The tarball contains plain
TypeScript + CSS with **zero import aliases and zero runtime dependencies
beyond React**, so it drops into any modern toolchain untouched.

## Requirements

- **React 19+** (components use React 19's ref-as-prop; React 18 will not work)
- TypeScript 5+ with `"jsx": "react-jsx"`
- A bundler that understands `import './x.css'` from TS/TSX — Vite, Next.js,
  and anything webpack-based all qualify out of the box

## Building the tarball (in this repo)

```sh
npm run dist
# → dist/sim-city-design-system-<version>.tar.gz
```

## Installing (in the consuming project)

```sh
mkdir -p vendor
tar -xzf path/to/sim-city-design-system-<version>.tar.gz -C vendor
```

This creates exactly one directory: `vendor/sim-city-design-system/`,
containing the library plus its machinery: `VERSION` (version + source
commit), `MANIFEST.txt` (per-file checksums), `INSTRUCTIONS.md` (the local
modification playbook), `LOCAL_CHANGELOG.md`, `check-local-changes.mjs`
(integrity checker), `DESIGN.md`, and this guide. **Commit the vendored
directory** to the child repo — that is the point: the child builds forever
without reaching anywhere.

### 1. Load the global styles once

At your app entry (e.g. `main.tsx`, or `app/layout.tsx` in Next):

```ts
import '../vendor/sim-city-design-system/tokens/tokens.css';
import '../vendor/sim-city-design-system/styles/base.css';
```

Set the chrome variant on the root element (`dark` is the default):

```html
<html data-chrome="dark">   <!-- or "light" -->
```

### 2. (Optional but recommended) add an import alias

The vendored code needs no alias — but your app will want one. Pick a name
that cannot collide with your own aliases, e.g. `@simcity`:

**Vite** (`vite.config.ts`):

```ts
resolve: {
  alias: { '@simcity': path.resolve(__dirname, 'vendor/sim-city-design-system') },
},
```

**tsconfig.json** (Vite and Next both):

```jsonc
"compilerOptions": {
  "paths": { "@simcity/*": ["./vendor/sim-city-design-system/*"] }
}
```

Next.js resolves `tsconfig.json` paths natively; no webpack config needed.

### 3. Use it

```tsx
import { Button, Panel, DataTable, useToast } from '@simcity/index';
// or granular: import { Button } from '@simcity/components/Button';

<Panel title="City Ordinances">
  <Button variant="accent" icon="build">Commission survey</Button>
</Panel>
```

`index.ts` is the full barrel. Component CSS is imported by each component's
own module — you never import component CSS manually, only the two global
files from step 1.

### Keep vendored code out of your app's typecheck sweep (usually unneeded)

The code is strict-mode clean, so most projects can let `tsc` see it. If your
config has unusual lint-level compiler flags and complains, exclude it:

```jsonc
"exclude": ["vendor"]
```

Vite/Next will still compile what you import.

### 4. Wire the playbook into the child's agents

Local modification of the vendored tree is **allowed but disciplined** —
every edit must be logged in the tree's `LOCAL_CHANGELOG.md` and pass
`node vendor/sim-city-design-system/check-local-changes.mjs`. The full
protocol lives in the tarball itself as
`vendor/sim-city-design-system/INSTRUCTIONS.md`; so agents actually load it,
add this to the child repo's `CLAUDE.md` (or equivalent):

```markdown
## Vendored design system
`vendor/sim-city-design-system/` is a vendored library with a modification
protocol. Before editing ANY file under it, read
`vendor/sim-city-design-system/INSTRUCTIONS.md` and follow it exactly —
every edit needs a LOCAL_CHANGELOG.md entry and a clean
`node vendor/sim-city-design-system/check-local-changes.mjs`.
```

## Local modifications and getting them back upstream

The loop, end to end:

1. **Child edits** a vendored file, appends a `[LOCAL]` entry to
   `LOCAL_CHANGELOG.md` (format in `INSTRUCTIONS.md`), and the checker
   passes. Both committed together in the child.
2. **Upstream pulls the changes back** (run in THIS repo):

   ```sh
   npm run backport -- /path/to/child/vendor/sim-city-design-system
   ```

   The tool refuses to run unless the child's checker passes, reconstructs
   each file's pristine base from the source commit recorded in the child's
   `VERSION`, and performs a genuine three-way merge into `src/` (base =
   pristine at the child's version, ours = current src, theirs = the child's
   edit with imports mapped back to `@/`). A dry-run report plus staged
   merges land in `backports/`; add `--apply` to write clean merges into
   `src/`. Conflicts get standard markers and are never auto-resolved.
3. **Upstream verifies** (`npm run typecheck`, Storybook), bumps the
   version, commits, `npm run dist`.
4. **Stamp the child's changelog** so its entries read as folded-back:

   ```sh
   npm run backport -- /path/to/child/vendor/sim-city-design-system --stamp v1.1.0
   ```

   `[LOCAL]` headers become `[UPSTREAMED v1.1.0]`. The child then updates to
   the new tarball (below) and drops its now-redundant local edits.

Rejected changes: stamp by hand — edit the child's entry header from
`[LOCAL]` to `[REJECTED v1.1.0]` with a line saying why; the checker treats
both stamps as "no longer claiming local files".

## Updating to a new version

1. Build a fresh tarball here (`npm run dist`).
2. In the child — `LOCAL_CHANGELOG.md` must survive the swap:

   ```sh
   V=vendor/sim-city-design-system
   node $V/check-local-changes.mjs        # know your local state
   cp $V/LOCAL_CHANGELOG.md /tmp/lcl.md
   rm -rf $V && tar -xzf <tarball> -C vendor
   mv /tmp/lcl.md $V/LOCAL_CHANGELOG.md
   node $V/check-local-changes.mjs        # re-apply any [LOCAL] entries it flags
   ```

   Delete-then-extract, never extract over an old copy — files removed
   upstream would linger. Entries stamped `[UPSTREAMED]` are already in the
   new tarball; do not re-apply those.
3. Check `VERSION`, review the diff in git, commit.

## Rules of the vendored copy

- **Every edit follows `INSTRUCTIONS.md`** — logged in `LOCAL_CHANGELOG.md`,
  checker clean. Undocumented drift is unbackportable and dies on update.
- **Theming belongs to CSS custom properties**, not edits. Redefine tokens
  *after* importing `tokens.css` (no changelog entry needed — nothing in
  `vendor/` changes):

  ```css
  :root { --accent: #e09520; }
  :root[data-chrome='light'] { --accent: #b06a10; }
  ```

- Icons: use the registry via `PixelIcon`; app-specific glyphs should live in
  the app, drawn with the same 16×16 grid technique (see `DESIGN.md`).

## Why this mechanism

Considered and rejected: **npm registry** (ruled out by requirement),
**`npm install ./x.tgz`** (works offline but reintroduces npm packaging,
lockfile churn, and would require a compile step since bundlers don't
transpile TS out of `node_modules`), **git submodules/subtrees** (need a
shared remote and add clone/update friction). Vendored source wins for this
setup: fully private, zero infrastructure, the child repo is self-contained
and reproducible, upgrades are explicit and reviewable in the child's own git
history, and the source stays readable right where you debug it. The one real
cost — no automatic dependency resolution — is moot with a React-only
dependency surface.
