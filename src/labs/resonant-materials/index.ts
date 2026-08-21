/*
 * RESONANT MATERIALS — modal synthesis. A seeded mallet strikes four
 * resonators; each material is a recipe of mode ratios and Qs. The filter
 * banks are persistent (rebuilt only when material params change); strikes
 * are just noise bursts fed through them.
 */

import { defineLab, type EngineFacade, type Instrument } from '@/sdk/lab';
import type { NoteEvent } from '@/sdk/events';
import type { ParamValues } from '@/sdk/params';
import { makeRng, rngFor } from '@/sdk/prng';

export const CYCLE_BEATS = 4;
export const SLOTS = 16; // sixteenth grid
export const RESONATORS = [1, 1.5, 2, 3]; // frequency multipliers, large → small

interface Material {
  ratios: number[];
  /** T60-ish ring scale relative to the decay param. */
  ring: number;
  /** Gain tilt exponent across modes; higher = darker. */
  tilt: number;
}

const MATERIALS: Record<string, Material> = {
  glass: { ratios: [1, 2.32, 4.25, 6.63, 9.38], ring: 1.0, tilt: 0.55 },
  wood: { ratios: [1, 2.8, 5.2, 8.4], ring: 0.25, tilt: 1.4 },
  metal: { ratios: [1, 2.0, 2.98, 4.16, 5.43, 6.79], ring: 1.6, tilt: 0.75 },
  stone: { ratios: [1, 1.72, 2.51, 3.4, 4.6], ring: 0.5, tilt: 1.1 },
};

function strikesForCycle(params: ParamValues, seed: number, cycle: number): NoteEvent[] {
  const density = params.density as number;
  const rng = rngFor(seed, 'strikes', cycle);
  /* Seeded shuffle of the sixteenth grid; take the first `density` slots. */
  const slots = Array.from({ length: SLOTS }, (_, i) => i);
  for (let i = slots.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }
  const chosen = slots.slice(0, density).sort((a, b) => a - b);
  return chosen.map((slot) => {
    const pickRng = rngFor(seed, 'pick', cycle, slot);
    const resonator = pickRng.int(RESONATORS.length);
    const accent = slot % 4 === 0;
    const gain = (accent ? 0.85 : 0.55) + pickRng.range(-0.08, 0.08);
    return {
      id: `strike:${cycle}:${slot}`,
      beat: cycle * CYCLE_BEATS + slot * 0.25,
      dur: 0.25,
      freq: (params.fundamental as number) * RESONATORS[resonator],
      gain,
      voice: `res${resonator}`,
      provenance: [
        {
          rule: `density(${density}/16)`,
          detail: `cycle ${cycle}: seeded shuffle chose slot ${slot} of the sixteenth grid`,
        },
        {
          rule: 'resonator',
          detail: `struck resonator ${resonator + 1} (×${RESONATORS[resonator]} of fundamental)`,
        },
        {
          rule: accent ? 'accent(downbeat)' : 'offbeat',
          detail: accent ? 'slot is on a quarter-note, struck harder' : 'inner sixteenth, softer',
        },
      ],
      data: { resonator, slot, cycle },
    };
  });
}

function labEvents(params: ParamValues, seed: number, from: number, to: number): NoteEvent[] {
  const events: NoteEvent[] = [];
  const firstCycle = Math.floor(from / CYCLE_BEATS);
  const lastCycle = Math.ceil(to / CYCLE_BEATS);
  for (let c = firstCycle; c < lastCycle; c++) {
    for (const ev of strikesForCycle(params, seed, c)) {
      if (ev.beat >= from && ev.beat < to) events.push(ev);
    }
  }
  return events;
}

function materialKey(params: ParamValues): string {
  return [params.material, params.fundamental, params.decay, params.brightness].join('|');
}

function makeInstrument(engine: EngineFacade, initial: ParamValues): Instrument {
  const ctx = engine.ctx;

  /* Deterministic exciter: 30ms of seeded noise, identical everywhere. */
  const exciter = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.03), ctx.sampleRate);
  {
    const data = exciter.getChannelData(0);
    const rng = makeRng(0xc0ffee);
    for (let i = 0; i < data.length; i++) {
      data[i] = (rng.next() * 2 - 1) * (1 - i / data.length);
    }
  }

  const mix = ctx.createGain();
  mix.gain.value = 0.8;
  mix.connect(engine.out);

  /* One filter bank per resonator; inputs are per-strike gains. */
  let bankInputs: GainNode[] = [];
  let bankNodes: AudioNode[] = [];
  let builtFor = '';

  const rebuild = (params: ParamValues): void => {
    for (const node of bankNodes) node.disconnect();
    bankInputs = [];
    bankNodes = [];
    const material = MATERIALS[params.material as string] ?? MATERIALS.glass;
    const fundamental = params.fundamental as number;
    const decay = params.decay as number;
    const brightness = params.brightness as number;

    for (const mult of RESONATORS) {
      const input = ctx.createGain();
      input.gain.value = 1;
      material.ratios.forEach((ratio, m) => {
        const f = fundamental * mult * ratio;
        if (f > ctx.sampleRate * 0.45) return;
        const mode = ctx.createBiquadFilter();
        mode.type = 'bandpass';
        mode.frequency.value = f;
        /* Q sets the ring time: Q ≈ π·f·T60 / 6.9, clamped for stability. */
        const q = Math.min(120, Math.max(4, f * decay * material.ring * 0.25));
        mode.Q.value = q;
        const level = ctx.createGain();
        const tilt = Math.pow(1 / (m + 1), material.tilt * (1.6 - brightness));
        /* A bandpass at Q passes ~f/Q of a broadband burst's energy, so
           narrow modes need ~√Q more gain to strike at equal loudness. */
        const compensation = 4 * Math.sqrt(q);
        level.gain.value = (tilt / material.ratios.length) * compensation;
        input.connect(mode);
        mode.connect(level);
        level.connect(mix);
        bankNodes.push(mode, level);
      });
      bankInputs.push(input);
      bankNodes.push(input);
    }
    builtFor = materialKey(params);
  };
  rebuild(initial);

  return {
    trigger(event, when, _durSec, params) {
      if (builtFor !== materialKey(params)) rebuild(params);
      const release = engine.acquireVoice();
      if (!release) return;
      const resonator = (event.data?.resonator as number) ?? 0;
      const source = ctx.createBufferSource();
      source.buffer = exciter;
      const strike = ctx.createGain();
      strike.gain.value = event.gain;
      source.connect(strike);
      strike.connect(bankInputs[resonator] ?? bankInputs[0]);
      source.onended = () => {
        strike.disconnect();
        release();
      };
      source.start(when);
    },
    update(params) {
      if (builtFor !== materialKey(params)) rebuild(params);
    },
    retune() {
      /* The seed only reaches the events, never the graph. */
    },
    dispose() {
      for (const node of bankNodes) node.disconnect();
      mix.disconnect();
    },
  };
}

export const resonantMaterials = defineLab({
  id: 'resonant-materials',
  version: 1,
  title: 'Resonant Materials',
  family: 'instrumentation',
  question: 'What makes glass sound like glass and wood sound like wood?',
  params: [
    {
      kind: 'select',
      key: 'material',
      label: 'Material',
      options: [
        { value: 'glass', label: 'Glass' },
        { value: 'wood', label: 'Wood' },
        { value: 'metal', label: 'Metal' },
        { value: 'stone', label: 'Stone' },
      ],
      default: 'glass',
      hint: 'A recipe of mode ratios, ring times, and spectral tilt.',
    },
    {
      kind: 'number',
      key: 'fundamental',
      label: 'Fundamental',
      min: 60,
      max: 800,
      step: 1,
      default: 220,
      unit: 'Hz',
      hint: 'Pitch of the largest resonator; the others sit at ×1.5, ×2, ×3.',
    },
    {
      kind: 'number',
      key: 'decay',
      label: 'Ring time',
      min: 0.1,
      max: 6,
      step: 0.1,
      default: 1.6,
      unit: 's',
      hint: 'How long modes ring after the mallet leaves.',
    },
    {
      kind: 'number',
      key: 'brightness',
      label: 'Brightness',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.5,
      hint: 'Tilts energy toward the upper modes.',
    },
    {
      kind: 'int',
      key: 'density',
      label: 'Strikes / bar',
      min: 1,
      max: 16,
      default: 5,
      hint: 'Seeded mallet hits per 4-beat cycle on a sixteenth grid.',
    },
  ],
  cycleBeats: () => CYCLE_BEATS,
  events: ({ params, seed, range }) => labEvents(params, seed, range.from, range.to),
  makeInstrument,
  stories: [
    {
      name: 'Wine glasses',
      note: 'High sparse glass — each strike rings into the next.',
      seed: 11,
      params: { material: 'glass', fundamental: 440, decay: 3, density: 3 },
    },
    {
      name: 'Woodshop',
      note: 'Dense dry wood taps — rhythm from pure damping.',
      seed: 4,
      params: { material: 'wood', fundamental: 180, decay: 0.4, density: 11, brightness: 0.65 },
    },
    {
      name: 'Foundry bells',
      note: 'Inharmonic metal, long ring, slow strikes.',
      seed: 21,
      params: { material: 'metal', fundamental: 110, decay: 5, density: 2, brightness: 0.4 },
    },
  ],
  docs: `Every pitched object is a chord of resonant modes. The material selector
swaps the recipe: which overtone ratios exist (glass is nearly harmonic,
metal decidedly not), how long they ring, and how fast energy falls off
toward the treble. The mallet is 30 ms of seeded noise — spectrally flat, so
everything you hear as "material" is the filter bank's doing.

The strike pattern is a seeded shuffle of the sixteenth grid, re-drawn each
cycle from the session seed, so a URL reproduces not just the sound but the
exact performance. Click the ruler to ask any strike why it exists.`,
});
