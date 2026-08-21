/*
 * CONCORDANCE No. 1 — the first Soundbook composition: three published
 * documents playing together without any of them being rewritten. An
 * Oscillator Microscope drone at A0, the sparks of A Room That Does Not
 * Exist, and a Polymeter Loom (each with its original seed and params,
 * decoded from its URL) are laid onto one 360-beat master arc. The
 * autoharmonizer elects a consensus key from everything the three intend
 * to play and retunes each event the minimum distance onto it — timing,
 * rhythm, dynamics and instruments stay exactly as published. Section IV
 * manufactures the argument: the score shifts the loom's register a
 * tritone off the treaty and the harmonizer negotiates it back.
 */

import {
  defineLab,
  type EngineFacade,
  type Instrument,
  type LabDefinition,
 
} from '@/sdk/lab';
import { midiName, type Cause, type NoteEvent } from '@/sdk/events';
import { defaultsOf, sanitizeAll, type ParamValues } from '@/sdk/params';
import { rngFor } from '@/sdk/prng';
import {
  consensusKey,
  keyLabel,
  retuneFreq,
  type ConsensusKey,
} from '@/labs/shared/harmonize';
import { oscillatorMicroscope } from '@/labs/oscillator-microscope';
import { buildIr, roomThatDoesNotExist } from '@/labs/room-that-does-not-exist';
import { polymeterLoom } from '@/labs/polymeter-loom';

/* ------------------------------------------------- the source documents --
 * Decoded verbatim from the three published URLs; each track keeps its own
 * seed. Sanitized against the source schema exactly as the URL codec would.
 */

const DRONE_SEED = 1;
const DRONE_PARAMS = sanitizeAll(oscillatorMicroscope.params, {
  ...defaultsOf(oscillatorMicroscope.params),
  waveB: 'partials',
  blend: 0.68,
  freq: 27.5,
  partials: 12,
  unison: 5,
  spread: 16,
});

const SPARKS_SEED = 1;
const SPARKS_PARAMS = sanitizeAll(roomThatDoesNotExist.params, {
  ...defaultsOf(roomThatDoesNotExist.params),
  size: 31,
  decay: 4.1,
  damping: 0.66,
  impossibility: 0.8,
  wet: 0.91,
  sources: 8,
});

const STARS_SEED = 7;
const STARS_PARAMS = sanitizeAll(polymeterLoom.params, {
  ...defaultsOf(polymeterLoom.params),
  lenA: 16,
  lenB: 12,
  lenC: 16,
  lenD: 8,
  density: 0.08,
  accent: 1,
  scale: 'pentatonic',
});

/* ------------------------------------------------------------- the score */

export const TOTAL_BEATS = 360; // 3:00 at the authored 120 BPM
const CYCLE_BEATS = 8; // display/inspection window; the piece is through-composed

interface Section {
  at: number;
  numeral: string;
  name: string;
}

export const SECTIONS: Section[] = [
  { at: 0, numeral: 'I', name: 'Alone' },
  { at: 32, numeral: 'II', name: 'Sparks' },
  { at: 96, numeral: 'III', name: 'The Loom' },
  { at: 144, numeral: 'IV', name: 'The Argument' },
  { at: 200, numeral: 'V', name: 'Concord' },
  { at: 288, numeral: 'VI', name: 'Dissolution' },
];

function sectionAt(beat: number): Section {
  let hit = SECTIONS[0];
  for (const s of SECTIONS) if (s.at <= beat) hit = s;
  return hit;
}

/** Piecewise-linear curve over master beats: [beat, value] breakpoints. */
type Env = ReadonlyArray<readonly [number, number]>;

export function envAt(env: Env, beat: number): number {
  if (beat <= env[0][0]) return env[0][1];
  for (let i = 1; i < env.length; i++) {
    if (beat < env[i][0]) {
      const [b0, v0] = env[i - 1];
      const [b1, v1] = env[i];
      return v0 + ((beat - b0) / (b1 - b0)) * (v1 - v0);
    }
  }
  return env[env.length - 1][1];
}

/*
 * The authored argument, in semitones on the loom. The three documents
 * already share a key, so §IV drags the loom up to a tritone — the one
 * interval the treaty cannot contain — then resolves it into the octave,
 * and walks it home during the dissolution. Quantized to whole master
 * beats so any beat window sees the same value regardless of chunking.
 */
const STARS_SHIFT_SCORE: Env = [
  [144, 0],
  [168, 6],
  [176, 6],
  [200, 12],
  [296, 12],
  [320, 0],
];

function scoreShiftAt(beat: number): number {
  return envAt(STARS_SHIFT_SCORE, Math.floor(beat));
}

interface Track {
  id: string;
  title: string;
  lab: LabDefinition;
  seed: number;
  params: ParamValues;
  /** Lab beats per master beat — 1 when the source's tempo is the master's. */
  rate: number;
  enterAt: number;
  exitAt: number;
  env: Env;
}

export const TRACKS: Track[] = [
  {
    id: 'drone',
    title: 'Oscillator Microscope',
    lab: oscillatorMicroscope,
    seed: DRONE_SEED,
    params: DRONE_PARAMS,
    rate: 1,
    enterAt: 0,
    exitAt: TOTAL_BEATS,
    env: [
      [0, 0.3],
      [16, 0.7],
      [32, 0.85],
      [200, 0.85],
      [288, 0.75],
      [344, 0.6],
      [360, 0.5],
    ],
  },
  {
    id: 'sparks',
    title: 'A Room That Does Not Exist',
    lab: roomThatDoesNotExist,
    seed: SPARKS_SEED,
    params: SPARKS_PARAMS,
    rate: 1,
    enterAt: 32,
    exitAt: 352,
    env: [
      [32, 0],
      [48, 0.5],
      [64, 0.65],
      [96, 0.7],
      [144, 0.8],
      [200, 0.9],
      [288, 0.7],
      [320, 0.45],
      [344, 0.15],
      [352, 0],
    ],
  },
  {
    id: 'stars',
    title: 'Polymeter Loom',
    lab: polymeterLoom,
    seed: STARS_SEED,
    params: STARS_PARAMS,
    rate: 1,
    enterAt: 96,
    exitAt: 320,
    env: [
      [96, 0.5],
      [112, 0.7],
      [144, 0.8],
      [192, 0.9],
      [288, 0.75],
      [304, 0.5],
      [320, 0],
    ],
  },
];

/* -------------------------------------------------------- event pipeline */

interface ScoreEvent {
  track: Track;
  beat: number;
  dur: number;
  /** Arrangement envelope level at the onset. */
  env: number;
  source: NoteEvent;
}

/**
 * The raw score: every source event in the master-beat window, with the
 * arrangement envelope applied. Pure in (from, to) alone — no session seed,
 * no harmonizer, no register shifts — so the consensus can be computed from
 * the documents exactly as published.
 */
function scoreEvents(from: number, to: number): ScoreEvent[] {
  const lo = Math.max(0, from);
  const hi = Math.min(TOTAL_BEATS, to);
  const out: ScoreEvent[] = [];
  if (hi <= lo) return out;
  for (const track of TRACKS) {
    const tLo = Math.max(lo, track.enterAt);
    const tHi = Math.min(hi, track.exitAt);
    if (tHi <= tLo) continue;
    const events = track.lab.events({
      params: track.params,
      seed: track.seed,
      range: { from: tLo * track.rate, to: tHi * track.rate },
    });
    for (const source of events) {
      const beat = source.beat / track.rate;
      const env = envAt(track.env, beat);
      if (env <= 0.02) continue;
      out.push({ track, beat, dur: source.dur / track.rate, env, source });
    }
  }
  return out;
}

/*
 * The consensus is a property of the documents, not of the session: it is
 * elected once from everything the three sources intend to play across the
 * whole piece, weighted by gain × duration, before any register shift.
 * §IV's excursion argues against a treaty that is already signed.
 */
let consensusCache: ConsensusKey | null = null;

export function concordanceConsensus(): ConsensusKey {
  if (!consensusCache) {
    consensusCache = consensusKey(
      scoreEvents(0, TOTAL_BEATS).map((s) => ({
        freq: s.source.freq,
        weight: s.source.gain * s.env * s.dur,
      })),
    );
  }
  return consensusCache;
}

export function pieceEvents(params: ParamValues, seed: number, from: number, to: number): NoteEvent[] {
  const amount = params.harmonize as number;
  const transpose = params.transpose as number;
  const userShift = params.starsShift as number;
  const key = concordanceConsensus();
  const rootPc = (((key.rootPc + transpose) % 12) + 12) % 12;
  const label = keyLabel({ rootPc, scaleName: key.scaleName });
  const out: NoteEvent[] = [];

  for (const s of scoreEvents(from, to)) {
    /* Session-seeded performance: a small per-onset dynamic wobble is the
       only thing the composition's own seed touches. */
    const wobble = 1 + rngFor(seed, 'perform', s.track.id, Math.round(s.beat * 4)).range(-0.05, 0.05);
    const gain = Math.min(1, Math.max(0.02, s.source.gain * s.env * wobble));

    /* Register shift: the §IV score curve plus the stars-shift knob, loom
       only. Applied before the harmonizer, which pulls the result back onto
       the consensus by however much the treaty is signed. */
    const scoreShift = s.track.id === 'stars' ? scoreShiftAt(s.beat) : 0;
    const shift = s.track.id === 'stars' ? scoreShift + userShift : 0;
    const semis = transpose + shift;
    const baseFreq = semis === 0 ? s.source.freq : s.source.freq * Math.pow(2, semis / 12);
    const { freq, cents, targetMidi } = retuneFreq(baseFreq, rootPc, key.intervals, amount);
    /* Extreme shifts can push a thread out of earshot; end of the world. */
    if (freq < 16 || freq > 18000) continue;
    const sec = sectionAt(s.beat);

    const causes: Cause[] = [
      {
        rule: `score(§${sec.numeral})`,
        detail: `§${sec.numeral} “${sec.name}” — ${s.track.title} at ${Math.round(s.env * 100)}% on the master arc`,
      },
    ];
    if (shift !== 0) {
      causes.push({
        rule: `shift(${shift > 0 ? '+' : ''}${shift.toFixed(1)} st)`,
        detail: `register shift: §IV score curve ${scoreShift.toFixed(1)} st + stars-shift knob ${userShift} st`,
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
        detail: `verbatim event from the published ${s.track.title} document, seed ${s.track.seed} — timing and rhythm untouched`,
      },
      ...s.source.provenance,
    );

    out.push({
      id: `${s.track.id}:${s.source.id}`,
      beat: s.beat,
      dur: s.dur,
      freq,
      gain,
      voice: `${s.track.id}:${s.source.voice}`,
      provenance: causes,
      data: {
        ...s.source.data,
        track: s.track.id,
        cents: Number(cents.toFixed(1)),
        shift: Number(shift.toFixed(2)),
        section: sec.numeral,
      },
    });
  }
  return out.sort(
    (a, b) => a.beat - b.beat || (a.voice < b.voice ? -1 : a.voice > b.voice ? 1 : 0),
  );
}

/* ------------------------------------------------------------ instrument */

/*
 * One sub-instrument per track, each built by its own lab's factory against
 * a facade whose `out` is that track's trim gain. The score's dynamics live
 * in the events; the level and wet params are engine-side mix trims. The
 * loom gets a send into the very room the sparks excite — same impulse
 * response, same seed — so the two wets are doors into one space.
 */
function makeInstrument(engine: EngineFacade, initial: ParamValues): Instrument {
  const ctx = engine.ctx;
  const gains = new Map<string, GainNode>();
  const inner = new Map<string, Instrument>();
  const sendNodes: AudioNode[] = [];
  let loomDry: GainNode | null = null;
  let loomWet: GainNode | null = null;

  for (const track of TRACKS) {
    const gain = ctx.createGain();
    gain.connect(engine.out);
    gains.set(track.id, gain);
    let out: AudioNode = gain;
    if (track.id === 'stars') {
      const input = ctx.createGain();
      loomDry = ctx.createGain();
      loomWet = ctx.createGain();
      const room = ctx.createConvolver();
      room.buffer = buildIr(ctx, SPARKS_PARAMS, SPARKS_SEED);
      input.connect(loomDry);
      loomDry.connect(gain);
      input.connect(room);
      room.connect(loomWet);
      loomWet.connect(gain);
      sendNodes.push(input, room, loomDry, loomWet);
      out = input;
    }
    const facade: EngineFacade = {
      ctx,
      out,
      acquireVoice: () => engine.acquireVoice(),
    };
    const buildParams =
      track.id === 'sparks' ? { ...SPARKS_PARAMS, wet: initial.sparksWet } : track.params;
    inner.set(track.id, track.lab.makeInstrument(facade, buildParams, track.seed));
  }

  const applyMix = (params: ParamValues): void => {
    for (const track of TRACKS) {
      const level = params[`${track.id}Level`] as number;
      gains.get(track.id)!.gain.value = level * level; // audio taper
    }
    inner.get('sparks')?.update({ ...SPARKS_PARAMS, wet: params.sparksWet });
    /* Same equal-power law the room lab uses for its own wet knob. */
    const wet = params.starsWet as number;
    if (loomDry && loomWet) {
      loomDry.gain.value = Math.cos((wet * Math.PI) / 2) * 0.9;
      loomWet.gain.value = Math.sin((wet * Math.PI) / 2) * 1.1;
    }
  };
  applyMix(initial);

  return {
    trigger(event, when, durSec, _params) {
      const trackId = event.data?.track as string;
      const track = TRACKS.find((t) => t.id === trackId);
      const instrument = inner.get(trackId);
      if (!track || !instrument) return;
      const sep = event.voice.indexOf(':');
      const voice = sep === -1 ? event.voice : event.voice.slice(sep + 1);
      /* Each event performs under its own document's params. */
      instrument.trigger({ ...event, voice }, when, durSec, track.params);
    },
    update(params) {
      applyMix(params);
    },
    retune() {
      /* The documents' seeds are frozen; the session seed only wobbles
         event gains. Nothing in the graph depends on it. */
    },
    dispose() {
      inner.forEach((instrument) => instrument.dispose());
      sendNodes.forEach((node) => node.disconnect());
      gains.forEach((gain) => gain.disconnect());
    },
  };
}

/* ------------------------------------------------------------ definition */

export const concordance = defineLab({
  id: 'concordance',
  version: 3,
  title: 'Concordance No. 1',
  family: 'composition',
  question: 'Can three documents that never met agree on one key without giving up their character?',
  params: [
    {
      kind: 'number',
      key: 'harmonize',
      label: 'Harmonize',
      min: 0,
      max: 1,
      step: 0.01,
      default: 1,
      hint: 'How much of each retuning is applied. 0 lets every shift arrive uncorrected.',
    },
    {
      kind: 'int',
      key: 'starsShift',
      label: 'Stars shift',
      min: -24,
      max: 24,
      default: 0,
      hint: 'Wide register offset for the loom, ±2 octaves in semitones, on top of the §IV score curve. Off-key shifts are dragged back by the harmonizer.',
    },
    {
      kind: 'int',
      key: 'transpose',
      label: 'Transpose',
      min: -5,
      max: 6,
      default: 0,
      hint: 'Shifts the whole concord — sources and consensus together — in semitones.',
    },
    {
      kind: 'number',
      key: 'droneLevel',
      label: 'Drone level',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.85,
      hint: 'Mix trim for the Oscillator Microscope. The score keeps its own dynamics.',
    },
    {
      kind: 'number',
      key: 'sparksLevel',
      label: 'Sparks level',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.8,
      hint: 'Mix trim for A Room That Does Not Exist.',
    },
    {
      kind: 'number',
      key: 'starsLevel',
      label: 'Stars level',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.75,
      hint: 'Mix trim for the Polymeter Loom.',
    },
    {
      kind: 'number',
      key: 'sparksWet',
      label: 'Sparks wet',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.91,
      hint: 'Wet mix of the impossible room around the sparks, exactly as published at 0.91.',
    },
    {
      kind: 'number',
      key: 'starsWet',
      label: 'Stars wet',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.3,
      hint: 'Sends the loom into the same impossible room the sparks excite. Its document is dry; 0 restores that.',
    },
  ],
  cycleBeats: () => CYCLE_BEATS,
  pieceBeats: TOTAL_BEATS,
  events: ({ params, seed, range }) => pieceEvents(params, seed, range.from, range.to),
  makeInstrument,
  stories: [
    {
      name: 'The concordat',
      note: 'Three found documents, one elected key — the piece as intended.',
      seed: 1,
      params: {},
    },
    {
      name: 'Babel',
      note: 'Harmonizer bypassed: §IV’s tritone excursion arrives raw, microtone by microtone.',
      seed: 1,
      params: { harmonize: 0 },
    },
    {
      name: 'Half signed',
      note: 'Every correction stops halfway — quarter-tone diplomacy between the score and the treaty.',
      seed: 1,
      params: { harmonize: 0.5 },
    },
    {
      name: 'Loom in the cellar',
      note: 'The stars-shift knob a full octave down: the treaty holds, the register does not.',
      seed: 1,
      params: { starsShift: -12 },
    },
  ],
  docs: `Three published Soundbook documents play here exactly as their URLs wrote
them: an Oscillator Microscope drone (seed 1, a sine/partial-stack blend on
A0 at 27.5 Hz, five detuned voices), the sparks of A Room That Does Not
Exist (seed 1, a 31-meter room at impossibility 0.8), and a Polymeter Loom
(seed 7, threads of 16·12·16·8 cells at density 0.08 — mostly downbeats,
drifting apart and realigning every 24 beats). Their seeds, rhythms,
instruments and impossible reverb are untouched; the score only decides who
is on stage and how strongly, across six sections and 360 beats — three
minutes at the authored tempo.

The autoharmonizer weighs every note the documents intend to play (gain ×
duration), audits all twelve roots of the seven-note modes, and elects the
key needing the least total retuning. This trio turns out to agree already —
the loom's A pentatonic, the room's D-rooted sparks and the A0 drone all sit
inside one seven-note set, so the election is nearly unanimous and, left
alone, almost nothing is retuned. So the score manufactures the argument:
across §IV it drags the loom's register up to a tritone — the one interval
the treaty cannot contain — before resolving into the octave, and the
harmonizer audibly negotiates every step back onto the consensus. The
harmonize knob decides how much of that negotiation is applied: at 0 the
excursion arrives raw, at 1 it is absorbed into the key, in between it is
genuinely microtonal. The stars-shift knob hands you the same lever, ±2
octaves of it, on top of whatever the score is doing. The two wet knobs are
doors into one space: sparks-wet is the room document's own mix, published
at 0.91, and stars-wet lowers the loom into the identical impulse response,
so the two instruments audibly share the same impossible geometry.

The composition's own seed touches one thing only: a small per-onset
performance wobble in the dynamics. Everything else you hear is either one
of the three documents or the arithmetic between them. The timeline is a
transport — click anywhere to move the playhead there — and every mark
carries its whole causal chain: the score's arc, the register shift, the
harmonizer's exact correction in cents, and the rule in the original
document that caused the note in the first place.`,
});
