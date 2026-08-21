/*
 * SHIP OF THESEUS — a looping melody whose notes ("planks") are replaced
 * one at a time as the cycles pass. Replacement r is a pure function of the
 * seed, so seeking to cycle 400 rebuilds the exact same ship you'd have
 * reached by sailing there. The stage keeps the ledger: what is original,
 * what is replacement, what is replacement-of-replacement.
 */

import { defineLab, type EngineFacade, type Instrument } from '@/sdk/lab';
import type { NoteEvent } from '@/sdk/events';
import type { ParamValues } from '@/sdk/params';
import { rngFor } from '@/sdk/prng';
import { SCALES, scaleNote } from '@/labs/shared/music';
import { midiName } from '@/sdk/events';
import { makeSmoothConvolver } from '@/labs/shared/smooth-convolver';
import { buildIr } from '@/labs/room-that-does-not-exist';

/* The harbor the ship floats in: a plausible stone basin (impossibility 0),
   its reflections seeded like everything else aboard. */
const HARBOR = { size: 22, decay: 2.6, damping: 0.55, impossibility: 0 };

export const STEP_BEATS = 0.5;

interface Plank {
  midi: number;
  /** How many times this position has been replaced. */
  generation: number;
  /** Cycle of the most recent replacement (0 = original). */
  replacedAt: number;
}

interface Ship {
  planks: Plank[];
  replacements: number;
  originalFraction: number;
}

/** The ship as it stands at a given cycle — pure in (params, seed, cycle). */
export function shipAtCycle(params: ParamValues, seed: number, cycle: number): Ship {
  const length = params.length as number;
  const every = params.every as number;
  const drift = params.drift as number;
  const scale = SCALES[params.scale as string] ?? SCALES.pentatonic;
  const root = params.root as number;

  /* Original hull. */
  const planks: Plank[] = Array.from({ length }, (_, i) => {
    const rng = rngFor(seed, 'origin', i);
    return {
      midi: scaleNote(root, scale, rng.int(scale.length * 2) - scale.length + 2),
      generation: 0,
      replacedAt: 0,
    };
  });

  /* Replacement order: a seeded permutation, repeated forever. */
  const perm = Array.from({ length }, (_, i) => i);
  const permRng = rngFor(seed, 'perm');
  for (let i = perm.length - 1; i > 0; i--) {
    const j = permRng.int(i + 1);
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }

  const total = Math.floor(cycle / every);
  const driftDeg = Math.max(1, Math.round((drift * scale.length) / 12));
  for (let r = 1; r <= total; r++) {
    const idx = perm[(r - 1) % length];
    const rng = rngFor(seed, 'replace', r);
    let delta = rng.int(driftDeg * 2 + 1) - driftDeg;
    if (delta === 0) delta = rng.chance(0.5) ? 1 : -1;
    const plank = planks[idx];
    plank.midi = plank.midi + Math.round((delta * 12) / scale.length);
    plank.generation += 1;
    plank.replacedAt = r * every;
  }

  const originals = planks.filter((p) => p.generation === 0).length;
  return { planks, replacements: total, originalFraction: originals / length };
}

function labEvents(params: ParamValues, seed: number, from: number, to: number): NoteEvent[] {
  const length = params.length as number;
  const couple = params.couple as boolean;
  const cycleBeats = length * STEP_BEATS;
  const events: NoteEvent[] = [];
  const first = Math.ceil(from / STEP_BEATS);
  let shipCycle = -1;
  let ship: Ship | null = null;

  for (let g = first; g * STEP_BEATS < to; g++) {
    const cycle = Math.floor((g * STEP_BEATS) / cycleBeats);
    if (cycle !== shipCycle) {
      ship = shipAtCycle(params, seed, cycle);
      shipCycle = cycle;
    }
    const idx = ((g % length) + length) % length;
    const plank = ship!.planks[idx];
    const worn = 1 - ship!.originalFraction;
    events.push({
      id: `plank:${cycle}:${idx}`,
      beat: g * STEP_BEATS,
      dur: 0.45,
      freq: 440 * Math.pow(2, (plank.midi - 69) / 12),
      gain: 0.55,
      voice: 'hull',
      provenance: [
        plank.generation === 0
          ? { rule: 'original', detail: `plank ${idx} still carries its launch-day note` }
          : {
              rule: `replaced×${plank.generation}`,
              detail: `last swapped at cycle ${plank.replacedAt}; drift moved it to ${midiName(plank.midi)}`,
            },
        {
          rule: 'ledger',
          detail: `cycle ${cycle}: ${(ship!.originalFraction * 100).toFixed(0)}% of the hull is original`,
        },
        couple
          ? {
              rule: 'couple(timbre)',
              detail: `tone morphs sine→saw with wear (${(worn * 100).toFixed(0)}% worn)`,
            }
          : { rule: 'couple(off)', detail: 'timbre held constant regardless of wear' },
      ],
      data: {
        plank: idx,
        cycle,
        generation: plank.generation,
        worn,
        midi: plank.midi,
      },
    });
  }
  return events;
}

function makeInstrument(engine: EngineFacade, initial: ParamValues, initialSeed: number): Instrument {
  const ctx = engine.ctx;
  let seed = initialSeed;

  /* Dry/wet split into the seeded harbor, shared by every plank voice. A
     smooth convolver so reseeds crossfade the harbor on existing nodes and
     a closed wet leaves it dormant. */
  const input = ctx.createGain();
  const dry = ctx.createGain();
  const wetGain = ctx.createGain();
  const harbor = makeSmoothConvolver(ctx);
  const applyHarbor = (): void =>
    harbor.set(`harbor|${seed}|${ctx.sampleRate}`, () => buildIr(ctx, HARBOR, seed), 0.3);
  applyHarbor();
  input.connect(dry);
  dry.connect(engine.out);
  input.connect(harbor.input);
  harbor.output.connect(wetGain);
  wetGain.connect(engine.out);

  const applyWet = (params: ParamValues): void => {
    const wet = params.wet as number;
    harbor.bypass(wet <= 0);
    dry.gain.value = Math.cos((wet * Math.PI) / 2) * 0.9;
    wetGain.gain.value = Math.sin((wet * Math.PI) / 2) * 1.1;
  };
  applyWet(initial);

  return {
    trigger(event, when, _durSec, params) {
      const release = engine.acquireVoice();
      if (!release) return;
      const worn = (event.data?.worn as number) ?? 0;
      const mix = (params.couple as boolean) ? worn : 0.15;
      const sine = ctx.createOscillator();
      sine.type = 'sine';
      sine.frequency.value = event.freq;
      const saw = ctx.createOscillator();
      saw.type = 'sawtooth';
      saw.frequency.value = event.freq;
      const sineGain = ctx.createGain();
      const sawGain = ctx.createGain();
      sineGain.gain.value = (1 - mix) * 0.8;
      sawGain.gain.value = mix * 0.4;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1200 + worn * 2400;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, when);
      env.gain.linearRampToValueAtTime(event.gain, when + 0.008);
      env.gain.setTargetAtTime(0, when + 0.05, 0.11);
      sine.connect(sineGain);
      saw.connect(sawGain);
      sineGain.connect(lp);
      sawGain.connect(lp);
      lp.connect(env);
      env.connect(input);
      let pending = 2;
      const done = (): void => {
        pending -= 1;
        if (pending === 0) {
          env.disconnect();
          release();
        }
      };
      sine.onended = done;
      saw.onended = done;
      sine.start(when);
      saw.start(when);
      sine.stop(when + 0.7);
      saw.stop(when + 0.7);
    },
    update(params) {
      applyWet(params);
    },
    retune(next) {
      seed = next;
      applyHarbor();
    },
    dispose() {
      input.disconnect();
      dry.disconnect();
      harbor.dispose();
      wetGain.disconnect();
    },
  };
}

export const shipOfTheseus = defineLab({
  id: 'ship-of-theseus',
  version: 2,
  title: 'Ship of Theseus',
  family: 'quixotic',
  question: 'If every note is replaced, one cycle at a time, when does the melody stop being itself?',
  params: [
    { kind: 'int', key: 'length', label: 'Planks', min: 4, max: 16, default: 8, hint: 'Notes in the hull — the looping melody.' },
    { kind: 'int', key: 'every', label: 'Cycles per swap', min: 1, max: 8, default: 2, hint: 'A plank is replaced every N cycles.' },
    {
      kind: 'number',
      key: 'drift',
      label: 'Drift',
      min: 1,
      max: 12,
      step: 0.5,
      default: 4,
      unit: 'st',
      hint: 'How far, at most, a replacement note may wander.',
    },
    {
      kind: 'select',
      key: 'scale',
      label: 'Timber',
      options: [
        { value: 'pentatonic', label: 'Pentatonic' },
        { value: 'major', label: 'Major' },
        { value: 'minor', label: 'Minor' },
      ],
      default: 'pentatonic',
      hint: 'The wood the melody is cut from.',
    },
    { kind: 'int', key: 'root', label: 'Root', min: 48, max: 72, default: 60, hint: 'MIDI root of the launch-day melody.' },
    {
      kind: 'toggle',
      key: 'couple',
      label: 'Couple timbre',
      default: true,
      hint: 'The more planks replaced, the harsher the tone.',
    },
    {
      kind: 'number',
      key: 'wet',
      label: 'Harbor wet',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.3,
      hint: 'How much the harbor answers back — a plausible stone basin, seeded like the hull.',
    },
  ],
  cycleBeats: (params) => (params.length as number) * STEP_BEATS,
  events: ({ params, seed, range }) => labEvents(params, seed, range.from, range.to),
  makeInstrument,
  stories: [
    {
      name: 'Slow harbor',
      note: 'Eight planks, a swap every four cycles — mourn each one.',
      seed: 8,
      params: { every: 4, drift: 3 },
    },
    {
      name: 'Storm refit',
      note: 'Every cycle a plank, wide drift, timbre coupled — rapid unbecoming.',
      seed: 19,
      params: { every: 1, drift: 9, length: 12 },
    },
    {
      name: 'Philosopher’s becalm',
      note: 'Minor timber, uncoupled tone: only the notes change, never the voice. Or is it the other way?',
      seed: 51,
      params: { scale: 'minor', couple: false, every: 3, drift: 5 },
    },
  ],
  docs: `The paradox, operationalized: the hull is a melody, each plank a note.
Every N cycles the seeded shipwright pries one out (in a fixed secret order)
and fits a new note within the drift limit. Because replacement r is a pure
function of (seed, r), seeking to cycle 400 rebuilds precisely the ship you
would have reached by listening the whole way — the paradox is reproducible.

Two philosophies are on offer. With timbre coupled, the voice of the ship
wears with its planks — by full replacement it is audibly another
instrument. Uncoupled, the voice never changes and only the melody drifts.
The harbor-wet knob moors the ship in a plausible stone basin — the same
seeded impulse-response arithmetic as A Room That Does Not Exist, held at
impossibility zero, because this paradox is confusing enough on dry math.
Click a plank for its papers: original, or replaced at cycle so-and-so,
by rule such-and-such. The ledger keeps what Plutarch couldn't.`,
});
