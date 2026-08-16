---
name: new-lab
description: Add a new Soundbook lab (or a console lab that embeds other labs, like DroneLab). Use whenever creating a lab, adding params/stories to one, or wiring a lab into the registry, sidebar, or param panel.
---

# Adding a Soundbook lab

A lab is one musical question expressed as a `defineLab` schema. The shell
generates everything else. Work through this checklist in order.

## 1. Files

- `src/labs/<id>/index.tsx` — the whole lab: params, events, instrument,
  stage, stories, docs, exported as a named const.
- Register in `src/labs/registry.ts`. **Append to `LABS`** — `LABS[0]` is the
  default lab and tests depend on it staying `oscillatorMicroscope`.
- New family? Extend `LabFamily` in `src/sdk/lab.ts`, add its label to
  `FAMILY_LABELS` (registry), and slot it into `FAMILY_ORDER` in
  `src/shell/LabBrowser.tsx` (presentation order; compositions stay last).
- `src/labs/__tests__/<id>.test.ts` — lab-specific contract tests. The
  generic determinism suite covers every registered lab automatically.

## 2. Determinism rules (the suite enforces all of these)

- Events are pure over `{params, seed, range}` — no state, no clocks, no
  `Math.random()`. All randomness via `rngFor(seed, ...keys)` keyed so
  consumption order never matters.
- Chunk independence: events over [a,b) must equal the union of any
  partition of [a,b). If the lab wraps or has sections, **split windows at
  the boundaries** inside the events function (see `pieceEvents` in
  `src/labs/drone-lab/index.tsx` for loop wrapping).
- The seed must audibly reach the events (the suite compares seed 1 vs 2 by
  JSON). Gain-only effects count, but a lab-specific test comparing
  `[beat, freq]` alone will miss them — include gain.
- Expensive whole-piece derivations (e.g. a consensus key) may be memoized
  **only when keyed on exactly the inputs they depend on** — pure caching,
  same inputs → same value. Module-level single-entry caches are the pattern
  (`concordanceConsensus`, `droneLabConsensus`).
- Every event carries provenance, outermost rule first, and a stable
  deterministic id. Frequencies must land in (10, 20000) and gains in (0, 1]
  — clamp or skip ("end of the world") at the edges.

## 3. Params

- Flat labs: 5–10 params. Console labs: declare `paramGroups` — every key in
  exactly one group, **each group 5–10 params**. The shell renders one folder
  tab per group; nothing else changes (locks, randomize, URL, morph all
  operate on the flat list). When transport controls outgrow a musical tab,
  give them their own group (DroneLab's Controls tab) instead of raising
  the cap.
- Layer keys must stay globally unique inside a console lab. When two source
  schemas collide on a key (both the loom and the room own `wet`), re-key
  the colliding param for the console (`loomWet`) and force the shadowed key
  in that layer's slice to a fixed value inside `sliceFor` — see drone-lab.
- Adding a param to an existing lab: default it to today's behavior so every
  published URL and embedding composition stays bit-identical (the loom's
  `wet` defaults to 0 with a unity dry path), and bump the lab's `version`.
- Defaults are the document: a lab "based on" a published state sets its
  defaults to those exact values (clone the source specs and override
  `default` — see `adopt()` in drone-lab).
- Params that only touch the audio graph (wet mixes, sends, level trims) are
  engine-side: the events function must not read them, and `update()` must
  apply them live. Pin that with a test asserting events are equal across
  those params.
- Params that steer playback rather than material (loop, AutoRandomize,
  fade window) set `control: true`: randomize — manual or automatic — never
  flips them and A/B morph pins them to A, no lock needed. They still
  serialize into the URL like any param.
- Param locks are document state: `session.locked` serializes into the URL
  (codec field `k`, validated against the schema on decode) and rides
  undo/redo and published snapshots. Nothing lab-specific to do — but don't
  reintroduce shell-side lock state.

## 4. Instrument

- Build against `EngineFacade` only. Skip notes when `acquireVoice()`
  returns null — never steal. Disconnect everything in `dispose()`.
- Embedding other labs (console/composition pattern): one sub-instrument per
  track via `track.lab.makeInstrument(facade, slice, subseed)` where the
  facade's `out` is that track's trim gain. Route triggers by
  `event.data.track`, strip the `track:` voice prefix, and pass the track's
  **live param slice** (keep slices in a closure, refresh them in
  `update()`).
- Layer param slices are recovered from the flat record with
  `sanitizeAll(sourceLab.params, params)` — which requires layer keys to be
  globally unique across the whole lab. Check before reusing source schemas.
- Subseeds derive from the master seed (`deriveSeed(seed, '<lab>', trackId)`)
  and are never stored or shown.
- Shared spaces: to stand one layer in another's convolution room, build the
  same IR (`buildIr(ctx, spaceSlice, spaceSubseed)`) behind a dry/wet pair.
  Any convolver whose IR can change live MUST go through
  `makeSmoothConvolver` (`src/labs/shared/smooth-convolver.ts`) — assigning
  `ConvolverNode.buffer` directly resets the node and cuts the whole tail,
  so an A/B scrub interpolating room params silences the reverb every tick.
  The smooth convolver debounces rebuilds until the key settles and
  crossfades the new room in while the old tail rings out. A convolver whose
  IR is fixed for the instrument's lifetime (the loom's private chamber) can
  stay plain.

## 5. Piece vs. loop

- Endless labs omit `pieceBeats`; `cycleBeats` drives the stage window and
  WAV export length (4 cycles).
- A through-composed piece sets `pieceBeats`; export renders
  `pieceBeats / cycleBeats` cycles. One-shot pieces return no events past
  `pieceBeats`; a looping console lab may wrap past it (export renders one
  pass). Loop state, if user-facing, is a `toggle` param — serialized like
  everything else.

## 6. Stage

- Canvas via `useStageCanvas` from `src/labs/shared/stage.ts`; colors only
  from the passed `StagePalette`. Clicking inspects (`onInspect`) and, for
  timeline stages, seeks (`onSeek`). Wrap the playhead (`beat % total`) for
  looping labs and seek within the current pass so the transport never jumps
  backward.

## 7. Checks

`npm test && npm run typecheck && npm run build` — all three, always. The
determinism suite picks the lab up from the registry with zero test code;
still write the lab-specific contract test for what makes this lab itself.
