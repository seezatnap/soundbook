/*
 * DRONELAB No. 1 — Concordance's §III plateau turned into an instrument.
 * The same three layers — an Oscillator Microscope drone, the sparks of
 * A Room That Does Not Exist, a Polymeter Loom — play the full 360-beat
 * track at the constant levels §III "The Loom" holds them at, with no arc,
 * no entrances, no dissolution, so the end wraps seamlessly into the start.
 * Unlike the composition, nothing here is a frozen document: every layer's
 * params are live on its own tab (Loom / Space / Oscillator), and one
 * master seed derives every layer's subseed, so a single URL still writes
 * the whole variation.
 */

import {
  defineLab,
  type EngineFacade,
  type Instrument,
  type LabDefinition,
 
} from '@/sdk/lab';
import { midiName, type Cause, type NoteEvent } from '@/sdk/events';
import { sanitizeAll, type ParamSpec, type ParamValue, type ParamValues } from '@/sdk/params';
import { deriveSeed, rngFor } from '@/sdk/prng';
import {
  consensusKey,
  keyLabel,
  retuneFreq,
  type ConsensusKey,
} from '@/labs/shared/harmonize';
import { makeSmoothConvolver, type SmoothConvolver } from '@/labs/shared/smooth-convolver';
import { oscillatorMicroscope } from '@/labs/oscillator-microscope';
import { buildIr, roomThatDoesNotExist } from '@/labs/room-that-does-not-exist';
import { polymeterLoom } from '@/labs/polymeter-loom';

/* ------------------------------------------------------------- the params
 * Each layer tab re-declares its source lab's schema verbatim, with the
 * defaults moved to the values the Concordance documents publish — so the
 * default DroneLab is §III of Concordance No. 1, held forever. Keys are
 * shared with the source schemas on purpose: a layer's param slice is
 * recovered by sanitizing the flat record against the source schema.
 */

function adopt(specs: readonly ParamSpec[], overrides: Record<string, ParamValue>): ParamSpec[] {
  return specs.map((spec) =>
    spec.key in overrides ? ({ ...spec, default: overrides[spec.key] } as ParamSpec) : { ...spec },
  );
}

/*
 * Transport controls: they steer playback, not the material. `control`
 * makes them persistent without locks — randomize (manual or auto) skips
 * them and A/B morph pins them to A — while the URL still carries them.
 */
const CONTROL_PARAMS: ParamSpec[] = [
  {
    kind: 'toggle',
    key: 'loop',
    label: 'Loop',
    default: true,
    control: true,
    hint: 'Wrap the 360-beat track end-to-start forever. Off plays it once and falls silent.',
  },
  {
    kind: 'toggle',
    key: 'autoRandom',
    label: 'AutoRandomize',
    default: false,
    control: true,
    hint: 'While playing, hit “randomize unlocked parameters” every N beats. Locked params and these controls sit out.',
  },
  {
    kind: 'int',
    key: 'autoRandomBeats',
    label: 'AutoRandomize beats',
    min: 1,
    max: 128,
    default: 18,
    control: true,
    hint: 'The N: beats between automatic randomizations.',
  },
  {
    kind: 'toggle',
    key: 'autoReseed',
    label: 'AutoRandomSeed',
    default: false,
    control: true,
    hint: 'While playing, press Reseed every N beats — a fresh master seed for every layer, crossfaded in over the fade window.',
  },
  {
    kind: 'int',
    key: 'autoReseedBeats',
    label: 'AutoRandomSeed beats',
    min: 1,
    max: 128,
    default: 18,
    control: true,
    hint: 'The N: beats between automatic reseeds.',
  },
  {
    kind: 'int',
    key: 'fadeBeats',
    label: 'Fade beats',
    min: 0,
    max: 32,
    default: 4,
    control: true,
    hint: 'Crossfade window for reseeds and lab switches, in beats: the old iteration rings out while the new one fades in. 0 is a hard cut.',
  },
];

const MASTER_PARAMS: ParamSpec[] = [
  {
    kind: 'number',
    key: 'harmonize',
    label: 'Harmonize',
    min: 0,
    max: 1,
    step: 0.01,
    default: 1,
    hint: 'How much of each retuning toward the consensus key is applied. 0 lets every layer keep its own tuning.',
  },
  {
    kind: 'int',
    key: 'starsShift',
    label: 'Stars shift',
    min: -24,
    max: 24,
    default: 0,
    hint: 'Wide register offset for the loom, ±2 octaves in semitones. Off-key shifts are dragged back by the harmonizer.',
  },
  {
    kind: 'int',
    key: 'transpose',
    label: 'Transpose',
    min: -5,
    max: 6,
    default: 0,
    hint: 'Shifts everything — layers and consensus together — in semitones.',
  },
  {
    kind: 'number',
    key: 'droneLevel',
    label: 'Drone level',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.85,
    hint: 'Mix trim for the Oscillator layer. The plateau keeps its own dynamics.',
  },
  {
    kind: 'number',
    key: 'sparksLevel',
    label: 'Sparks level',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.8,
    hint: 'Mix trim for the Space layer.',
  },
  {
    kind: 'number',
    key: 'starsLevel',
    label: 'Stars level',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.75,
    hint: 'Mix trim for the Loom layer.',
  },
];

const LOOM_PARAMS: ParamSpec[] = [
  /* The loom's own wet key is dropped: inside DroneLab the loom's wetness
     is the shared Space room, not the loom's private chamber — and the flat
     namespace already gives `wet` to the Space tab. */
  ...adopt(polymeterLoom.params, {
    lenA: 16,
    lenB: 12,
    lenC: 16,
    lenD: 8,
    density: 0.08,
    accent: 1,
    scale: 'pentatonic',
  }).filter((spec) => spec.key !== 'wet'),
  {
    kind: 'number',
    key: 'loomWet',
    label: 'Wet',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.3,
    hint: 'Lowers the loom into the Space tab’s room — the same impossible impulse response the sparks excite.',
  },
];

const SPACE_PARAMS: ParamSpec[] = adopt(roomThatDoesNotExist.params, {
  size: 31,
  decay: 4.1,
  damping: 0.66,
  impossibility: 0.8,
  wet: 0.91,
  sources: 8,
});

const OSC_PARAMS: ParamSpec[] = adopt(oscillatorMicroscope.params, {
  waveB: 'partials',
  blend: 0.68,
  freq: 27.5,
  partials: 12,
  unison: 5,
  spread: 16,
});

const PARAMS: ParamSpec[] = [
  ...CONTROL_PARAMS,
  ...MASTER_PARAMS,
  ...LOOM_PARAMS,
  ...SPACE_PARAMS,
  ...OSC_PARAMS,
];

/* -------------------------------------------------------------- the score */

export const TOTAL_BEATS = 360; // 3:00 at the authored 120 BPM
const CYCLE_BEATS = 8; // inspection window; the loop itself is 360 beats

interface TrackSpec {
  id: 'drone' | 'sparks' | 'stars';
  title: string;
  lab: LabDefinition;
  /** The §III "The Loom" plateau level from the Concordance master arc. */
  level: number;
}

export const TRACKS: TrackSpec[] = [
  { id: 'drone', title: 'Oscillator Microscope', lab: oscillatorMicroscope, level: 0.85 },
  { id: 'sparks', title: 'A Room That Does Not Exist', lab: roomThatDoesNotExist, level: 0.75 },
  { id: 'stars', title: 'Polymeter Loom', lab: polymeterLoom, level: 0.75 },
];

/** One master seed writes every layer; subseeds are derived, never stored. */
export function droneLabSubseed(seed: number, trackId: string): number {
  return deriveSeed(seed, 'dronelab', trackId);
}

/** A layer's live params, recovered from the flat record by its own schema. */
export function sliceFor(track: TrackSpec, params: ParamValues): ParamValues {
  const slice = sanitizeAll(track.lab.params, params);
  /* The loom's private chamber never opens inside DroneLab: its `wet` key
     would otherwise pick up the Space tab's room wet from the flat record.
     The Loom tab's Wet knob (loomWet) routes into the shared room instead. */
  if (track.id === 'stars') slice.wet = 0;
  return slice;
}

interface ScoreEvent {
  track: TrackSpec;
  beat: number;
  dur: number;
  source: NoteEvent;
}

/*
 * Full-window layer events, cached per track on exactly their inputs. The
 * stage's display score and the consensus election both sweep all 360
 * beats; without this they would each regenerate every layer on every
 * knob tick. Pure caching: same inputs → same events.
 */
const fullTrackCache = new Map<string, { inputs: string; events: NoteEvent[] }>();

function fullTrackEvents(track: TrackSpec, params: ParamValues, seed: number): NoteEvent[] {
  const slice = sliceFor(track, params);
  const sub = droneLabSubseed(seed, track.id);
  const inputs = JSON.stringify([sub, slice]);
  let entry = fullTrackCache.get(track.id);
  if (!entry || entry.inputs !== inputs) {
    entry = {
      inputs,
      events: track.lab.events({ params: slice, seed: sub, range: { from: 0, to: TOTAL_BEATS } }),
    };
    fullTrackCache.set(track.id, entry);
  }
  return entry.events;
}

/** Raw layer events for one window of the 360-beat track, pre-harmonizer. */
function scoreEvents(params: ParamValues, seed: number, from: number, to: number): ScoreEvent[] {
  const lo = Math.max(0, from);
  const hi = Math.min(TOTAL_BEATS, to);
  const out: ScoreEvent[] = [];
  if (hi <= lo) return out;
  const full = lo === 0 && hi === TOTAL_BEATS;
  for (const track of TRACKS) {
    const events = full
      ? fullTrackEvents(track, params, seed)
      : track.lab.events({
          params: sliceFor(track, params),
          seed: droneLabSubseed(seed, track.id),
          range: { from: lo, to: hi },
        });
    for (const source of events) {
      out.push({ track, beat: source.beat, dur: source.dur, source });
    }
  }
  return out;
}

/*
 * The consensus key is elected from everything the three live layers intend
 * to play across the whole 360 beats. Unlike Concordance, the layers here
 * are editable, so the election is memoized on exactly the inputs it depends
 * on (layer params + derived subseeds) — pure caching, same inputs → same
 * key. The full-piece sweep is additionally cached per track, so dragging
 * one layer's knob regenerates that layer's notes only.
 */
let consensusCache: { inputs: string; value: ConsensusKey } | null = null;

function consensusNotes(params: ParamValues, seed: number): {
  inputs: string;
  notes: Array<{ freq: number; weight: number }>;
} {
  const keys: string[] = [];
  const notes: Array<{ freq: number; weight: number }> = [];
  for (const track of TRACKS) {
    const events = fullTrackEvents(track, params, seed);
    keys.push(fullTrackCache.get(track.id)!.inputs);
    for (const ev of events) {
      notes.push({ freq: ev.freq, weight: ev.gain * track.level * ev.dur });
    }
  }
  return { inputs: keys.join('¶'), notes };
}

export function droneLabConsensus(params: ParamValues, seed: number): ConsensusKey {
  const { inputs, notes } = consensusNotes(params, seed);
  if (!consensusCache || consensusCache.inputs !== inputs) {
    consensusCache = { inputs, value: consensusKey(notes) };
  }
  return consensusCache.value;
}

/** One pass of the loop: local window [from, to) within [0, TOTAL_BEATS). */
function passEvents(
  params: ParamValues,
  seed: number,
  pass: number,
  from: number,
  to: number,
): NoteEvent[] {
  const amount = params.harmonize as number;
  const transpose = params.transpose as number;
  const userShift = params.starsShift as number;
  const looping = params.loop as boolean;
  const key = droneLabConsensus(params, seed);
  const rootPc = (((key.rootPc + transpose) % 12) + 12) % 12;
  const label = keyLabel({ rootPc, scaleName: key.scaleName });
  const out: NoteEvent[] = [];

  for (const s of scoreEvents(params, seed, from, to)) {
    /* Per-onset dynamic wobble, keyed on the local beat so every pass of
       the loop performs identically — the wrap is an exact repeat. */
    const wobble =
      1 + rngFor(seed, 'perform', s.track.id, Math.round(s.beat * 4)).range(-0.05, 0.05);
    const gain = Math.min(1, Math.max(0.02, s.source.gain * s.track.level * wobble));

    const shift = s.track.id === 'stars' ? userShift : 0;
    const semis = transpose + shift;
    const baseFreq = semis === 0 ? s.source.freq : s.source.freq * Math.pow(2, semis / 12);
    const { freq, cents, targetMidi } = retuneFreq(baseFreq, rootPc, key.intervals, amount);
    /* Extreme shifts can push a thread out of earshot; end of the world. */
    if (freq < 16 || freq > 18000) continue;

    const causes: Cause[] = [
      {
        rule: 'plateau(§III)',
        detail: `${s.track.title} held at ${Math.round(s.track.level * 100)}% — the §III “The Loom” level, flat across all ${TOTAL_BEATS} beats${looping ? `; loop pass ${pass + 1}` : ''}`,
      },
    ];
    if (shift !== 0) {
      causes.push({
        rule: `shift(${shift > 0 ? '+' : ''}${shift} st)`,
        detail: `stars-shift knob: the loom's register moved ${shift} semitones`,
      });
    }
    causes.push(
      Math.abs(cents) < 0.5
        ? {
            rule: `harmonize(${label})`,
            detail: `already a tone of ${label} — passed through untouched`,
          }
        : amount <= 0
          ? {
              rule: 'harmonize(bypassed)',
              detail: `keeps its own tuning, ${Math.abs(cents).toFixed(0)}¢ from the nearest tone of ${label}`,
            }
          : {
              rule: `harmonize(${label})`,
              detail: `${Math.abs(cents).toFixed(0)}¢ ${cents > 0 ? 'up' : 'down'} × ${Math.round(amount * 100)}% toward ${midiName(targetMidi)}, the nearest tone of ${label}`,
            },
      {
        rule: `source(${s.track.lab.id})`,
        detail: `live ${s.track.title} layer, subseed ${droneLabSubseed(seed, s.track.id)} derived from master seed ${seed}`,
      },
      ...s.source.provenance,
    );

    out.push({
      id: `${pass}:${s.track.id}:${s.source.id}`,
      beat: pass * TOTAL_BEATS + s.beat,
      dur: s.dur,
      freq,
      gain,
      voice: `${s.track.id}:${s.source.voice}`,
      provenance: causes,
      data: {
        ...s.source.data,
        track: s.track.id,
        cents: Number(cents.toFixed(1)),
        shift,
        pass,
      },
    });
  }
  return out;
}

export function pieceEvents(params: ParamValues, seed: number, from: number, to: number): NoteEvent[] {
  const out: NoteEvent[] = [];
  if (to > from) {
    if (params.loop as boolean) {
      /* Split the window at loop boundaries so any chunking sees the same
         wrap: beat b always plays pass floor(b/360)'s copy of beat b mod 360. */
      const firstPass = Math.max(0, Math.floor(from / TOTAL_BEATS));
      const lastPass = Math.max(firstPass, Math.ceil(to / TOTAL_BEATS) - 1);
      for (let pass = firstPass; pass <= lastPass; pass++) {
        const base = pass * TOTAL_BEATS;
        const lo = Math.max(from, base) - base;
        const hi = Math.min(to, base + TOTAL_BEATS) - base;
        out.push(...passEvents(params, seed, pass, lo, hi));
      }
    } else {
      out.push(...passEvents(params, seed, 0, from, to));
    }
  }
  return out.sort(
    (a, b) => a.beat - b.beat || (a.voice < b.voice ? -1 : a.voice > b.voice ? 1 : 0),
  );
}

/* ------------------------------------------------------------ instrument */

/*
 * One sub-instrument per layer, each built by its own lab's factory against
 * a facade whose `out` is that layer's trim gain — exactly the Concordance
 * wiring, except every layer performs under its live tab params instead of
 * a frozen document. The loom's send shares the sparks' room: same impulse
 * response, same derived subseed, rebuilt whenever the Space tab changes it.
 */
function makeInstrument(engine: EngineFacade, initial: ParamValues, initialSeed: number): Instrument {
  const ctx = engine.ctx;
  let seed = initialSeed;
  let sparksSeed = droneLabSubseed(seed, 'sparks');
  let lastParams = initial;
  const gains = new Map<string, GainNode>();
  const inner = new Map<string, Instrument>();
  const slices = new Map<string, ParamValues>();
  const sendNodes: AudioNode[] = [];
  let loomDry: GainNode | null = null;
  let loomWet: GainNode | null = null;
  let loomRoom: SmoothConvolver | null = null;

  for (const track of TRACKS) {
    const gain = ctx.createGain();
    gain.connect(engine.out);
    gains.set(track.id, gain);
    let out: AudioNode = gain;
    if (track.id === 'stars') {
      const input = ctx.createGain();
      loomDry = ctx.createGain();
      loomWet = ctx.createGain();
      /* Smooth like the sparks' own room: Space edits and A/B scrubs must
         not cut the loom's tail while the IR is rebuilt. */
      loomRoom = makeSmoothConvolver(ctx);
      input.connect(loomDry);
      loomDry.connect(gain);
      input.connect(loomRoom.input);
      loomRoom.output.connect(loomWet);
      loomWet.connect(gain);
      sendNodes.push(input, loomDry, loomWet);
      out = input;
    }
    const facade: EngineFacade = {
      ctx,
      out,
      acquireVoice: () => engine.acquireVoice(),
    };
    const slice = sliceFor(track, initial);
    slices.set(track.id, slice);
    inner.set(track.id, track.lab.makeInstrument(facade, slice, droneLabSubseed(seed, track.id)));
  }

  /* Live changes glide; the initial application is exact so offline WAV
     renders open at the right levels from sample zero. */
  const glide = (param: AudioParam, target: number, smooth: boolean): void => {
    if (smooth) param.setTargetAtTime(target, ctx.currentTime, 0.08);
    else param.value = target;
  };

  const applyMix = (params: ParamValues, smooth: boolean): void => {
    lastParams = params;
    for (const track of TRACKS) {
      const slice = sliceFor(track, params);
      slices.set(track.id, slice);
      inner.get(track.id)?.update(slice);
      const level = params[`${track.id}Level`] as number;
      glide(gains.get(track.id)!.gain, level * level, smooth); // audio taper
    }
    const space = slices.get('sparks')!;
    const roomKey = [
      sparksSeed,
      space.size,
      space.decay,
      space.damping,
      space.impossibility,
      ctx.sampleRate,
    ].join('|');
    /* The shared room exits on its own reverberant timescale. */
    const ringOut = Math.min(0.6, Math.max(0.1, (space.decay as number) * 0.12));
    loomRoom?.set(roomKey, () => buildIr(ctx, space, sparksSeed), ringOut);
    /* Same equal-power law the room lab uses for its own wet knob. */
    const send = params.loomWet as number;
    loomRoom?.bypass(send <= 0);
    if (loomDry && loomWet) {
      glide(loomDry.gain, Math.cos((send * Math.PI) / 2) * 0.9, smooth);
      glide(loomWet.gain, Math.sin((send * Math.PI) / 2) * 1.1, smooth);
    }
  };
  applyMix(initial, false);

  return {
    trigger(event, when, durSec, _params) {
      const trackId = event.data?.track as string;
      const instrument = inner.get(trackId);
      const slice = slices.get(trackId);
      if (!instrument || !slice) return;
      const sep = event.voice.indexOf(':');
      const voice = sep === -1 ? event.voice : event.voice.slice(sep + 1);
      /* Each event performs under its layer's live tab params. */
      instrument.trigger({ ...event, voice }, when, durSec, slice);
    },
    update(params) {
      applyMix(params, true);
    },
    retune(next) {
      /* One master seed rewrites every layer in place: each sub-instrument
         crossfades its own seeded room, and the shared send follows. */
      seed = next;
      sparksSeed = droneLabSubseed(seed, 'sparks');
      for (const track of TRACKS) {
        inner.get(track.id)?.retune?.(droneLabSubseed(seed, track.id));
      }
      applyMix(lastParams, true);
    },
    dispose() {
      inner.forEach((instrument) => instrument.dispose());
      loomRoom?.dispose();
      sendNodes.forEach((node) => node.disconnect());
      gains.forEach((gain) => gain.disconnect());
    },
  };
}

/* ------------------------------------------------------------ definition */

export const droneLab = defineLab({
  id: 'drone-lab',
  version: 1,
  title: 'DroneLab No. 1',
  family: 'dronelab',
  question: 'What do the loom, the room and the oscillator become when the arc is taken away?',
  params: PARAMS,
  paramGroups: [
    { id: 'controls', label: 'Controls', keys: CONTROL_PARAMS.map((p) => p.key) },
    { id: 'master', label: 'Master', keys: MASTER_PARAMS.map((p) => p.key) },
    { id: 'loom', label: 'Loom', keys: LOOM_PARAMS.map((p) => p.key) },
    { id: 'space', label: 'Space', keys: SPACE_PARAMS.map((p) => p.key) },
    { id: 'oscillator', label: 'Oscillator', keys: OSC_PARAMS.map((p) => p.key) },
  ],
  cycleBeats: () => CYCLE_BEATS,
  pieceBeats: TOTAL_BEATS,
  events: ({ params, seed, range }) => pieceEvents(params, seed, range.from, range.to),
  makeInstrument,
  stories: [
    {
      name: 'The plateau',
      note: 'Concordance §III with the arc removed — three layers held level, looping forever.',
      seed: 1,
      params: {},
    },
    {
      name: 'Dry weave',
      note: 'The impossible room dialed out: sparks nearly dry, loom wet closed, geometry buildable.',
      seed: 1,
      params: { wet: 0.2, loomWet: 0, impossibility: 0 },
    },
    {
      name: 'Long weave',
      note: 'A different cloth on the same bench: threads 5·9·11·13 in lydian, thicker weave.',
      seed: 33,
      params: { lenA: 5, lenB: 9, lenC: 11, lenD: 13, density: 0.35, scale: 'lydian' },
    },
    {
      name: 'Once through',
      note: 'Loop off — the 360 beats play once and fall silent, the plateau as a piece.',
      seed: 1,
      params: { loop: false },
    },
    {
      name: 'Roulette',
      note: 'AutoRandomize every 18 beats, a fresh seed every 72 — the bench plays itself. Lock whatever must survive.',
      seed: 1,
      params: { autoRandom: true, autoReseed: true, autoReseedBeats: 72 },
    },
  ],
  docs: `DroneLab takes the three layers of Concordance No. 1 — the Oscillator
Microscope drone, the sparks of A Room That Does Not Exist, and the
Polymeter Loom — and removes the composition. No entrances, no argument, no
dissolution: every layer plays the full 360-beat track (three minutes at
the authored 120 BPM) at the constant level §III "The Loom" holds it at, so
the last beat wraps seamlessly into the first. The Loop switch on the
Master tab keeps it wrapping forever; off, the track plays once and falls
silent.

Where Concordance plays frozen documents, DroneLab plays live ones. Each
layer's full parameter schema sits on its own tab — Loom, Space, Oscillator
— with defaults set to exactly what the Concordance documents publish, so
the untouched lab is §III held forever, and every knob is a departure from
it. The wet controls live on the layers that own them: the Space tab
carries the room's own wet mix, and the Loom tab's wet lowers the loom into
that same impulse response — one space, two doors. (The loom's private
chamber from its standalone lab stays closed here; in DroneLab there is
only the Space room.) The Master tab keeps the composition's console:
harmonize, stars shift, transpose, one level trim per layer.

The Controls tab steers playback rather than the material: Loop;
AutoRandomize, which presses the randomize-unlocked-parameters button
every N beats while the transport runs; AutoRandomSeed, which presses
Reseed on its own beat grid the same way; and Fade beats, the crossfade
window for reseeds — the old iteration rings out while the new one fades
in on top, and rooms exit on their own reverberant timescale. Controls are
persistent without locks: randomize (manual or auto) skips them and the
A/B morph pins them, yet the URL carries them like everything else. Locks
are part of the document too, so a published Roulette carries exactly
which knobs its author nailed down.

One seed writes everything. The master seed derives a subseed per layer
(loom figures, spark placements, room noise, drone wobble) plus the
per-onset performance wobble, so no sub-seed is ever stored or shown — the
URL carries a single seed and the whole variation follows from it. The
autoharmonizer still sits at the end of the chain: it elects the consensus
key from everything the three live layers intend to play — re-elected
whenever a tab changes the material — and retunes each event the minimum
distance onto it, scaled by the harmonize knob. Click any mark on the
timeline to read its full causal chain: plateau, shift, election,
correction, and the rule inside the layer that wrote the note.`,
});
