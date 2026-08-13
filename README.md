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

**The URL is the document.** Lab, version, seed, tempo, parameters and the A/B
snapshot are validated, default-stripped, deflate-compressed and encoded into
the URL fragment. The same URL always reproduces the same event sequence —
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
| Instrumentation | Oscillator Microscope | What does a single oscillator actually put in the air? |
| Instrumentation | Resonant Materials | What makes glass sound like glass and wood like wood? |
| Pattern | Euclidean Constellation | Why does spreading k pulses evenly over n steps groove? |
| Pattern | Polymeter Loom | What happens when loops of different lengths share one pulse? |
| Space | A Room That Does Not Exist | What does an unbuildable geometry sound like? |
| Quixotic | Ship of Theseus | If every note is replaced, when does the melody stop being itself? |

Each lab declares a schema (`defineLab`): metadata, 5–8 params, a pure event
function, an instrument factory, a canvas stage, authored **stories**
(presets), and docs. The shell generates everything else — controls with
exact entry / lock / reset, randomize, A/B morph, undo/redo, URL codec,
inspectors, WAV export (offline render through the same instrument factory),
and a local publish shelf of immutable snapshot URLs.

## Layout

```
src/
  sdk/        prng, events+provenance, param schemas, defineLab, URL codec
  engine/     shared AudioContext engine, transport, lookahead scheduler, WAV
  shell/      session/URL state, audio wiring, toolbar, params, drawer, stage
  labs/       one folder per lab + shared music-theory/canvas utilities
vendor/
  sim-city-design-system/   vendored UI library (see CLAUDE.md before editing)
```
