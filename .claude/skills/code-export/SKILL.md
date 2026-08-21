---
name: code-export
description: Keep every Soundbook feature exportable as standalone audio code. Use whenever adding or changing a lab, an instrument, a shell behavior that affects playback (reseed, auto-randomize, transport), or the export pipeline itself (src/export, tools/export-bundler.mjs, the Vite plugin).
---

# Code export

The CODE button (next to EXPORT) downloads `<lab>-seed<N>.zip`: an
`index.html` that summarizes the settings in a static table and hosts a
PLAY / PAUSE / STOP transport, plus `<lab>.js` — the lab's definition and
a minimal player linked into one classic script **meant to be read by a
person or an agent downstream**: every source file is a labelled section,
types stripped, every comment kept verbatim, interfaces and type aliases
kept as `//` comments, an explanatory banner on top. **Audio only.** No
React, no design system, no stage, no network, no minification. Opened from disk, the page
performs exactly the events the workshop would — same engine, transport,
scheduler and instrument factory.

The promise is enforced by `src/export/__tests__/export.test.ts`: every
registered lab is bundled by rolldown, evaluated in a bare VM, and its
`events()` compared with the in-repo definition for the defaults and every
story. A lab whose `index.ts` drags in React, the shell, the vendored UI
or any `stage.ts` fails the suite.

## How it works

| Piece | Role |
| --- | --- |
| `src/labs/<id>/index.ts` | The lab **definition** (`defineLab`): params, events, instrument, stories, docs. This is what gets bundled. |
| `src/labs/<id>/stage.ts` | The workshop's canvas renderer (`makeStage`). Joined to the definition in `src/labs/registry.ts` via `withStage`; never bundled. |
| `src/export/runtime.ts` | `mountLab(lab, state, root)` — the standalone player: PLAY / PAUSE / STOP + position readout, `getEngine()` + `Transport` + `Scheduler`, reseed crossfade slots, AutoRandomize / AutoRandomSeed triggers. |
| `src/export/html.ts` | `renderExportHtml` — the page: settings table (grouped by `paramGroups`), transport container, explicit state JSON, one `<script>`. |
| `src/export/zip.ts` | Dependency-free ZIP writer (deflate via CompressionStream). |
| `src/export/code-export.ts` | `buildCodeExport` — what the CODE button calls: loads the prebuilt bundle, renders HTML, zips. |
| `tools/export-bundler.mjs` | `bundleLab(root, id)` — the linker: walks the `@/` import graph from `index.ts` + runtime with the TypeScript parser, strips types (node's `stripTypeScriptTypes`, exact layout; `ts.transpileModule` fallback), rewrites each `import`/`export` in place (`const { a } = sdk_x;` / `return { … }`), and emits one section per file, dependency-first. Not rolldown: a bundler would drop the comments. `listLabIds` = folders under `src/labs` with an `index.ts`. |
| `vite.config.ts` → `soundbookExport()` | Serves `virtual:soundbook-export` (`loadBundle(id)`) as one lazy chunk per lab; rebuilt on demand in dev and invalidated when any bundled source changes. |
| `tools/export-lab.mjs` | CLI: `npm run export:lab -- <id> [--story "Name"] [--seed N] [--param k=v]` writes `dist-export/<id>/` for a browser-free check. |

## Rules for staying exportable

1. **`index.ts` is React-free and DOM-free.** It may import only
   `@/sdk/*`, `@/engine/*` types, `@/labs/shared/*` (never
   `shared/stage.ts`) and other labs' `index.ts`. Never `react`,
   `@simcity/*`, `@/shell/*`, or any `stage.ts`. Module-level code must
   not touch `document`/`window` (the test evaluates bundles in node).
2. **Drawing lives in `stage.ts`.** `export function makeStage():
   StageRenderer` — `{ draw(g, frame, palette), click?(x, y, frame) }` over
   a `StageFrame`; React-free too (the shell's `StageHost` is the only
   React). Anything the stage needs from the lab is a named export of
   `index.ts` (constants, pure helpers such as `pieceEvents`, `shipAtCycle`).
   Register both halves in `src/labs/registry.ts` with `withStage`.
3. **Lab id = folder name.** `src/labs/<id>/index.ts` exporting a const
   whose `.id === '<id>'`; the bundler finds the definition by id.
4. **Shell behaviors that change the sound must be mirrored in the
   runtime.** A new transport feature, a new `control` param the shell acts
   on (like `autoRandom`), a new reseed policy: update
   `src/export/runtime.ts` in the same change — `useAudio.ts` stays the
   reference implementation. Engine-side behavior that lives in the
   instrument (`update`, `retune`) is exported for free. Visual-only
   behavior needs nothing: the export has no picture.
5. **Keep the runtime small.** Everything it imports ships in every
   export (budget: `MAX_SCRIPT_BYTES` in the export test). Lab-specific
   work belongs in the lab.
7. **Write comments for the reader of the export.** They ship verbatim,
   so a file header that explains the musical idea and inline notes that
   explain the why are part of the product. The linker supports named
   imports/exports only (no default exports, no `export *`, no import
   cycles, no packages) — the export suite fails loudly otherwise.
6. **A new param needs no export work**: the HTML writes the full
   sanitized record (and its label/value in the table) and the runtime
   sanitizes it again against the schema.

## Checklist for a change

- `npm test` — the export suite bundles every lab; read its failures first.
- `npm run export:lab -- <id> --story "<name>"`, open
  `dist-export/<id>/index.html` from disk, press PLAY. It must sound like
  the same story in the workshop.
- In the app, press CODE on the state you changed and open the zip.
