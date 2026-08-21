# SOUNDBOOK

<img width="1710" height="897" alt="Screenshot 2026-08-13 at 4 46 18 PM" src="https://github.com/user-attachments/assets/65adfb07-b96e-4c42-9690-f51c2098061e" />

Storybook for experimental music: an instrument workshop and executable music
notebook. Each **lab** renders one musical idea live, explains why every event
happened, and serializes its entire state into a shareable URL. Built on the
[SIM CITY DESIGN SYSTEM](vendor/sim-city-design-system/) — beveled, dithered,
monospaced.

## Running

```sh
npm install
npm run dev        # workshop at :5173
npm test           # determinism, codec, transport suites
npm run typecheck
npm run build
```

## The promise

**The URL is the document.** Lab, version, seed, tempo, parameters, param
locks and the A/B snapshot are validated, default-stripped, deflate-compressed
and encoded into the URL fragment. The same URL always reproduces the same event sequence —
not necessarily bit-identical browser audio.

Everything affecting the music is explicit, deterministic, serializable and
inspectable:

- All randomness flows through a seeded PRNG (`src/sdk/prng.ts`); streams are
  derived per purpose (`rngFor(seed, 'strikes', cycle)`), so consumption order
  never matters. `Math.random()` is banned from musical code.
- Pattern functions are pure over beat ranges: `events({params, seed, range})`.
  The scheduler pulls just-in-time windows; seeking to beat 400 produces
  exactly the events you'd have reached by listening.
- One `AudioContext` per tab behind an engine facade with a safety chain
  (DC blocker → limiter), a 32-voice cap, and a shared analyser. Labs cannot
  construct audio contexts or exceed the voice budget.
- Every event carries **provenance** — the chain of rules that caused it.
  Click a star, a plank, or a table row and the drawer answers "why?".

## The labs

| Family | Lab | Question |
| --- | --- | --- |
| Composition | Concordance No. 1 | Can three documents that never met agree on one key without giving up their character? |
| Instrumentation | Oscillator Microscope | What does a single oscillator actually put in the air? |
| Instrumentation | Resonant Materials | What makes glass sound like glass and wood like wood? |
| Pattern | Euclidean Constellation | Why does spreading k pulses evenly over n steps groove? |
| Pattern | Polymeter Loom | What happens when loops of different lengths share one pulse? |
| Space | A Room That Does Not Exist | What does an unbuildable geometry sound like? |
| Quixotic | Ship of Theseus | If every note is replaced, when does the melody stop being itself? |

**Compositions** are labs in the `composition` family: through-composed
pieces that embed other labs' published states as tracks. Concordance No. 1
lays three decoded documents onto a 360-beat arc and runs every event
through a pure autoharmonizer (`src/labs/shared/harmonize.ts`) that elects
the consensus key requiring the least total retuning, then moves only the
outliers — timing, rhythm and instruments stay exactly as published. A
composition sets `pieceBeats` so WAV export renders the whole piece.

Each lab declares a schema (`defineLab`): metadata, 5–8 params, a pure event
function, an instrument factory, a pure canvas stage renderer, authored
**stories** (presets), and docs. The shell generates everything else —
controls with exact entry / lock / reset, randomize, A/B morph, undo/redo,
URL codec, inspectors, WAV export (offline render through the same
instrument factory), code export, and a local publish shelf of immutable
snapshot URLs.

## Code export

**CODE** (next to EXPORT) downloads `<lab>-seed<N>.zip`: an `index.html`
that summarizes the settings — seed, tempo, every param, locks — in a table
and carries a PLAY / PAUSE / STOP transport, plus `<lab>.js`, the lab's
definition and a minimal player linked into one classic script written to
be read — by a person or by an agent downstream: one labelled section per
source file, types stripped, every comment kept verbatim, interfaces and
type aliases kept as `//` comments, a banner explaining the layout and the
API. Audio only: no React, no design system, no stage, no network, no
minification (50–115 KB).
Open the HTML from disk, press PLAY, and it performs exactly the events the
workshop would, through the same engine, transport, scheduler and
instrument factory. Edit a value in the HTML, reload, and the music
follows. `Soundbook.lab` is the lab definition, so
`Soundbook.lab.events({params, seed, range})` lists the notes — with
provenance — from the console.

This is a contract, not a feature of some labs: a lab's definition
(`src/labs/<id>/index.ts`) is React-free and stage-free, its canvas lives
apart in `stage.ts`, and `src/export/__tests__/export.test.ts` bundles
every registered lab with rolldown, runs it in a bare VM, and asserts its
events match the workshop's for every story. `npm run export:lab -- <id>
[--story "Name"]` writes the same pair to `dist-export/<id>/` without a
browser. See `.claude/skills/code-export/SKILL.md` for the rules that keep
it true.

## Layout

```
src/
  sdk/        prng, events+provenance, param schemas, defineLab, URL codec
  engine/     shared AudioContext engine, transport, lookahead scheduler, WAV
  shell/      session/URL state, audio wiring, toolbar, params, drawer, stage host
  labs/       one folder per lab: index.ts (definition) + stage.ts (canvas); shared utilities
  export/     code export: audio-only player runtime, HTML template, ZIP, CODE button
tools/
  export-bundler.mjs        rolldown bundling of one lab + runtime (Vite plugin, tests, CLI)
  export-lab.mjs            npm run export:lab -- <id>  →  dist-export/<id>/
vendor/
  sim-city-design-system/   vendored UI library (see CLAUDE.md before editing)
```
