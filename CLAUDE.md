# Soundbook

Storybook for experimental music. Read README.md for the architecture; the
short version: the URL is the document, all randomness is seeded, pattern
functions are pure over beat ranges, and one shared AudioContext lives behind
`src/engine/engine.ts`.

## Hard rules

- No `Math.random()` in musical code — use `rngFor(seed, ...keys)` from
  `src/sdk/prng.ts`. UI-gesture randomness (reseed/randomize) uses
  `freshSeed()` and must immediately become explicit serialized state.
- No `new AudioContext()` outside `src/engine/engine.ts`. Instruments build
  against the `EngineFacade` and must skip notes when `acquireVoice()`
  returns null — never steal.
- Lab event functions must be pure and chunk-independent: the determinism
  suite (`npm test`) asserts events over [0,24) equal the union of 0.5-beat
  windows, and that far seeks match long listens. Keep it green.
- New labs: `defineLab` in `src/labs/<id>/index.ts`, register in
  `src/labs/registry.ts`, 5–10 params, ≥2 stories, docs, provenance on every
  event. A console lab that embeds other labs (e.g. DroneLab) may carry more
  params by declaring `paramGroups` — tabs of 5–10 params each, every key in
  exactly one group; the determinism suite enforces both shapes. See the
  `new-lab` skill (`.claude/skills/new-lab/SKILL.md`) before adding one.
- Everything is exportable as standalone audio code. A lab's `index.ts`
  (the definition) never imports React, `@simcity/*`, `@/shell/*` or any
  stage; its canvas lives in `src/labs/<id>/stage.ts` as a pure
  `makeStage(): StageRenderer`, joined in the registry with `withStage` and
  never bundled. Any shell behavior that changes what is heard must be
  mirrored in `src/export/runtime.ts`, the player bundled into every
  export. Exports are linked unminified with every comment kept — write
  comments for that reader. The export suite (`npm test`) links every lab
  and asserts it reproduces the workshop's events. See the `code-export` skill
  (`.claude/skills/code-export/SKILL.md`) before touching a lab, an
  instrument, transport behavior or `src/export`.

## Vendored design system

`vendor/sim-city-design-system/` is a vendored library with a modification
protocol. Before editing ANY file under it, read
`vendor/sim-city-design-system/INSTRUCTIONS.md` and follow it exactly —
every edit needs a LOCAL_CHANGELOG.md entry and a clean
`node vendor/sim-city-design-system/check-local-changes.mjs`.

Theming belongs to CSS custom properties in `src/app.css` (redefine tokens
after importing tokens.css), never to edits of the vendored tree.

## Checks

```sh
npm test && npm run typecheck && npm run build
```
