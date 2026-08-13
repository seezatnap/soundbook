/*
 * SHIP OF THESEUS — a looping melody whose notes ("planks") are replaced
 * one at a time as the cycles pass. Replacement r is a pure function of the
 * seed, so seeking to cycle 400 rebuilds the exact same ship you'd have
 * reached by sailing there. The stage keeps the ledger: what is original,
 * what is replacement, what is replacement-of-replacement.
 */

import type { JSX } from 'react';
import { defineLab, type EngineFacade, type Instrument, type StageProps } from '@/sdk/lab';
import type { NoteEvent } from '@/sdk/events';
import type { ParamValues } from '@/sdk/params';
import { rngFor } from '@/sdk/prng';
import { SCALES, scaleNote } from '@/labs/shared/music';
import { midiName } from '@/sdk/events';
import { useStageCanvas } from '@/labs/shared/stage';

const STEP_BEATS = 0.5;

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
function shipAtCycle(params: ParamValues, seed: number, cycle: number): Ship {
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

function makeInstrument(engine: EngineFacade, _initial: ParamValues): Instrument {
  const ctx = engine.ctx;
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
      env.connect(engine.out);
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
    update() {},
    dispose() {},
  };
}

function Stage({ params, seed, beat, onInspect, events }: StageProps): JSX.Element {
  const canvasRef = useStageCanvas((g, w, h, pal, nowMs) => {
    g.fillStyle = pal.faceSunken;
    g.fillRect(0, 0, w, h);
    const length = params.length as number;
    const cycleBeats = length * STEP_BEATS;
    const cycle = Math.max(0, Math.floor(beat / cycleBeats));
    const ship = shipAtCycle(params, seed, cycle);
    const step = Math.floor(((beat / STEP_BEATS) % length + length) % length);

    const waterY = h * 0.62;

    /* Sea. */
    g.strokeStyle = pal.accent2;
    g.globalAlpha = 0.5;
    for (let row = 0; row < 3; row++) {
      g.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const y =
          waterY +
          8 +
          row * 12 +
          Math.sin(x * 0.03 + nowMs * 0.0012 + row * 1.7) * 3;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }
    g.globalAlpha = 1;

    /* Hull: one trapezoid strip per plank along a gentle arc. */
    const hullW = Math.min(w * 0.7, 560);
    const hullX = (w - hullW) / 2;
    const plankW = hullW / length;
    const hullTop = waterY - 40;
    for (let i = 0; i < length; i++) {
      const plank = ship.planks[i];
      const x = hullX + i * plankW;
      const arc = Math.sin((i / (length - 1 || 1)) * Math.PI) * 14;
      const yTop = hullTop - arc * 0.35;
      const yBot = waterY + 6 - arc;
      const gen = plank.generation;
      g.fillStyle = gen === 0 ? pal.accent : gen === 1 ? pal.ok : pal.accent2;
      g.globalAlpha = gen === 0 ? 1 : 0.9;
      g.fillRect(Math.round(x) + 1, yTop, Math.ceil(plankW) - 2, yBot - yTop);
      g.globalAlpha = 1;
      g.strokeStyle = pal.edgeDark;
      g.strokeRect(Math.round(x) + 0.5, yTop + 0.5, Math.ceil(plankW) - 1, yBot - yTop - 1);
      /* The sounding plank glows. */
      if (i === step) {
        g.strokeStyle = pal.ink;
        g.lineWidth = 2;
        g.strokeRect(Math.round(x) - 0.5, yTop - 2, Math.ceil(plankW) + 1, yBot - yTop + 3);
        g.lineWidth = 1;
      }
    }

    /* Mast and sail. */
    const mastX = hullX + hullW * 0.45;
    g.fillStyle = pal.inkDim;
    g.fillRect(mastX - 2, hullTop - 90, 4, 90 - 8);
    g.fillStyle = pal.face;
    g.beginPath();
    g.moveTo(mastX + 4, hullTop - 86);
    g.lineTo(mastX + 4 + hullW * 0.22, hullTop - 40);
    g.lineTo(mastX + 4, hullTop - 20);
    g.closePath();
    g.fill();
    g.strokeStyle = pal.edgeLight;
    g.stroke();

    /* Ledger. */
    g.fillStyle = pal.ink;
    g.font = '11px monospace';
    g.fillText(
      `CYCLE ${cycle}  ·  HULL ${(ship.originalFraction * 100).toFixed(0)}% ORIGINAL  ·  ${ship.replacements} REPLACEMENTS MADE`,
      8,
      16,
    );
    g.fillStyle = pal.inkDim;
    g.fillText(
      ship.originalFraction === 0
        ? 'NO ORIGINAL TIMBER REMAINS. SAME SHIP?'
        : `replacement every ${params.every} cycle${(params.every as number) > 1 ? 's' : ''}`,
      8,
      32,
    );

    /* Legend. */
    const legend: Array<[string, string]> = [
      [pal.accent, 'original'],
      [pal.ok, 'replaced'],
      [pal.accent2, 'replaced again'],
    ];
    let lx = 8;
    const ly = h - 14;
    g.font = '10px monospace';
    for (const [color, label] of legend) {
      g.fillStyle = color;
      g.fillRect(lx, ly - 7, 8, 8);
      g.fillStyle = pal.inkDim;
      g.fillText(label, lx + 12, ly);
      lx += 12 + g.measureText(label).width + 16;
    }
  });

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', cursor: 'pointer' }}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const w = rect.width;
        const length = params.length as number;
        const hullW = Math.min(w * 0.7, 560);
        const hullX = (w - hullW) / 2;
        const plankW = hullW / length;
        const idx = Math.floor((e.clientX - rect.left - hullX) / plankW);
        if (idx < 0 || idx >= length) return;
        const hit = events.find((ev) => (ev.data?.plank as number) === idx);
        if (hit) onInspect(hit);
      }}
    />
  );
}

export const shipOfTheseus = defineLab({
  id: 'ship-of-theseus',
  version: 1,
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
  ],
  cycleBeats: (params) => (params.length as number) * STEP_BEATS,
  events: ({ params, seed, range }) => labEvents(params, seed, range.from, range.to),
  makeInstrument,
  Stage,
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
Click a plank for its papers: original, or replaced at cycle so-and-so,
by rule such-and-such. The ledger keeps what Plutarch couldn't.`,
});
