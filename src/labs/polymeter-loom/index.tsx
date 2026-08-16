/*
 * POLYMETER LOOM — four threads of different lengths woven over one shared
 * pulse. Each thread repeats its own short seeded figure; the music is the
 * interference pattern, which only closes after the least common multiple
 * of all thread lengths.
 */

import type { JSX } from 'react';
import { defineLab, type EngineFacade, type Instrument, type StageProps } from '@/sdk/lab';
import type { NoteEvent } from '@/sdk/events';
import type { ParamValues } from '@/sdk/params';
import { rngFor } from '@/sdk/prng';
import { SCALES, lcmAll, scaleNote } from '@/labs/shared/music';
import { useStageCanvas } from '@/labs/shared/stage';
import { buildIr } from '@/labs/room-that-does-not-exist';

const STEP_BEATS = 0.5; // eighth notes
const THREADS = [
  { name: 'warp', lenKey: 'lenA', octave: 0, degreeBase: 0 },
  { name: 'weft', lenKey: 'lenB', octave: 1, degreeBase: 2 },
  { name: 'silk', lenKey: 'lenC', octave: 2, degreeBase: 4 },
  { name: 'gold', lenKey: 'lenD', octave: 3, degreeBase: 6 },
] as const;

function threadLengths(params: ParamValues): number[] {
  return THREADS.map((t) => params[t.lenKey] as number);
}

interface Cell {
  gateRoll: number;
  degree: number;
}

/** The fixed seeded figure for one thread: len cells of (gate roll, pitch). */
function figureFor(seed: number, thread: string, len: number): Cell[] {
  return Array.from({ length: len }, (_, i) => {
    const rng = rngFor(seed, 'loom', thread, i);
    return { gateRoll: rng.next(), degree: rng.int(9) };
  });
}

function labEvents(params: ParamValues, seed: number, from: number, to: number): NoteEvent[] {
  const scale = SCALES[params.scale as string] ?? SCALES.dorian;
  const root = params.root as number;
  const density = params.density as number;
  const accent = params.accent as number;
  const events: NoteEvent[] = [];

  THREADS.forEach((thread, ti) => {
    const len = params[thread.lenKey] as number;
    const figure = figureFor(seed, thread.name, len);
    const first = Math.ceil(from / STEP_BEATS);
    for (let g = first; g * STEP_BEATS < to; g++) {
      const pos = ((g % len) + len) % len;
      const cell = figure[pos];
      /* Cell 0 always sounds; others open as density crosses their roll. */
      const sounds = pos === 0 || cell.gateRoll < density;
      if (!sounds) continue;
      const isDownbeat = pos === 0;
      const midi = scaleNote(root + thread.octave * 12, scale, thread.degreeBase + cell.degree);
      events.push({
        id: `thread:${thread.name}:${g}`,
        beat: g * STEP_BEATS,
        dur: 0.4,
        freq: 440 * Math.pow(2, (midi - 69) / 12),
        gain: (isDownbeat ? 0.55 + accent * 0.3 : 0.45) * (1 - ti * 0.08),
        voice: thread.name,
        provenance: [
          {
            rule: `thread(${len})`,
            detail: `global step ${g} mod ${len} = cell ${pos} of the ${thread.name} figure`,
          },
          isDownbeat
            ? { rule: 'downbeat', detail: `cell 0 always sounds; accent +${(accent * 0.3).toFixed(2)}` }
            : {
                rule: 'gate(density)',
                detail: `cell roll ${cell.gateRoll.toFixed(2)} < density ${density.toFixed(2)} — thread sounds`,
              },
          {
            rule: 'pitch(seed)',
            detail: `cell degree ${cell.degree} of ${params.scale}, ${thread.name} octave +${thread.octave}`,
          },
        ],
        data: { thread: ti, cell: pos, step: g },
      });
    }
  });
  return events.sort((a, b) => a.beat - b.beat);
}

/*
 * The loom's room: a small plausible chamber (impossibility 0), synthesized
 * with the same IR arithmetic the space lab exports, from the loom's own
 * seed. Only the wet knob opens the door; at 0 the signal path multiplies
 * through unity gains, so every document published before the room existed
 * still sounds exactly as written.
 */
const LOOM_ROOM: ParamValues = { size: 7, decay: 2.2, damping: 0.5, impossibility: 0 };

function makeInstrument(engine: EngineFacade, initial: ParamValues, seed: number): Instrument {
  const ctx = engine.ctx;
  const input = ctx.createGain();
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  const room = ctx.createConvolver();
  room.buffer = buildIr(ctx, LOOM_ROOM, seed);
  input.connect(dry);
  dry.connect(engine.out);
  input.connect(room);
  room.connect(wet);
  wet.connect(engine.out);

  const applyWet = (params: ParamValues, smooth: boolean): void => {
    /* Equal-power like the room lab, but anchored so wet 0 is bit-exact
       passthrough — the pre-room documents must not change. Live changes
       glide; the initial application is exact for offline renders. */
    const amt = params.wet as number;
    const dryAmt = Math.cos((amt * Math.PI) / 2);
    const wetAmt = Math.sin((amt * Math.PI) / 2) * 1.1;
    if (smooth) {
      dry.gain.setTargetAtTime(dryAmt, ctx.currentTime, 0.08);
      wet.gain.setTargetAtTime(wetAmt, ctx.currentTime, 0.08);
    } else {
      dry.gain.value = dryAmt;
      wet.gain.value = wetAmt;
    }
  };
  applyWet(initial, false);

  return {
    trigger(event, when, _durSec, _params) {
      const release = engine.acquireVoice();
      if (!release) return;
      const ti = (event.data?.thread as number) ?? 0;
      /* Kalimba-ish: triangle into a lowpass, brighter per thread. */
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = event.freq;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 900 + ti * 900;
      lp.Q.value = 2;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, when);
      env.gain.linearRampToValueAtTime(event.gain * 0.8, when + 0.003);
      env.gain.setTargetAtTime(0, when + 0.01, 0.12);
      osc.connect(lp);
      lp.connect(env);
      env.connect(input);
      osc.onended = () => {
        env.disconnect();
        lp.disconnect();
        release();
      };
      osc.start(when);
      osc.stop(when + 0.7);
    },
    update(params) {
      applyWet(params, true);
    },
    dispose() {
      input.disconnect();
      dry.disconnect();
      wet.disconnect();
      room.disconnect();
    },
  };
}

function Stage({ params, seed, beat, recent, onInspect, events }: StageProps): JSX.Element {
  const canvasRef = useStageCanvas((g, w, h, pal, nowMs) => {
    g.fillStyle = pal.faceSunken;
    g.fillRect(0, 0, w, h);
    const lens = threadLengths(params);
    const superSteps = lcmAll(lens);
    const globalStep = Math.floor(beat / STEP_BEATS);
    const density = params.density as number;
    const threadColors = [pal.accent, pal.ok, pal.accent2, pal.warn];

    const rowH = (h - 60) / THREADS.length;
    THREADS.forEach((thread, ti) => {
      const len = lens[ti];
      const figure = figureFor(seed, thread.name, len);
      const y = 30 + ti * rowH;
      const cellW = (w - 90) / len;
      const x0 = 70;

      g.fillStyle = pal.inkDim;
      g.font = '10px monospace';
      g.fillText(`${thread.name.toUpperCase()} ${len}`, 8, y + rowH / 2 + 3);

      /* Thread line. */
      g.strokeStyle = pal.edgeDark;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x0, y + rowH / 2 + 0.5);
      g.lineTo(x0 + cellW * len, y + rowH / 2 + 0.5);
      g.stroke();

      for (let c = 0; c < len; c++) {
        const cx = x0 + cellW * (c + 0.5);
        const cy = y + rowH / 2;
        const cell = figure[c];
        const active = c === 0 || cell.gateRoll < density;
        const size = c === 0 ? 7 : 5;
        if (active) {
          g.fillStyle = threadColors[ti];
          g.fillRect(cx - size / 2, cy - size / 2, size, size);
        } else {
          g.strokeStyle = pal.edgeLight;
          g.strokeRect(cx - 2.5, cy - 2.5, 5, 5);
        }
      }

      /* Per-thread playhead, wrapping at the thread's own length. */
      const pos = ((globalStep % len) + len) % len;
      const frac = (beat / STEP_BEATS) % 1;
      const px = x0 + cellW * (pos + frac + 0.5);
      if (px <= x0 + cellW * len) {
        g.fillStyle = pal.ink;
        g.fillRect(Math.round(px) - 1, y + 4, 2, rowH - 8);
      }
    });

    /* Flashes. */
    for (const { event, at } of recent) {
      const age = nowMs - at;
      if (age < 0 || age > 300) continue;
      const ti = (event.data?.thread as number) ?? 0;
      const len = lens[ti];
      const c = (event.data?.cell as number) ?? 0;
      const y = 30 + ti * rowH + rowH / 2;
      const cellW = (w - 90) / len;
      const x = 70 + cellW * (c + 0.5);
      const t = age / 300;
      g.globalAlpha = 1 - t;
      g.strokeStyle = threadColors[ti];
      g.lineWidth = 2;
      g.strokeRect(x - 5 - t * 5, y - 5 - t * 5, (5 + t * 5) * 2, (5 + t * 5) * 2);
      g.globalAlpha = 1;
    }

    /* Superperiod progress: when do all threads realign? */
    const superPos = ((globalStep % superSteps) + superSteps) % superSteps;
    const barY = h - 18;
    g.strokeStyle = pal.edgeLight;
    g.strokeRect(70.5, barY + 0.5, w - 90, 8);
    g.fillStyle = pal.accent2;
    g.fillRect(71, barY + 1, (w - 92) * ((superPos + ((beat / STEP_BEATS) % 1)) / superSteps), 7);
    g.fillStyle = pal.inkDim;
    g.font = '10px monospace';
    g.fillText(`LCM ${superSteps}`, 8, barY + 8);

    g.fillStyle = pal.ink;
    g.font = '11px monospace';
    g.fillText(
      `threads ${lens.join('·')}  ·  realign every ${superSteps} steps (${(superSteps * STEP_BEATS).toFixed(1)} beats)`,
      8,
      16,
    );
  });

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', cursor: 'pointer' }}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const x = e.clientX - rect.left;
        const rowH = (rect.height - 60) / THREADS.length;
        const ti = Math.floor((y - 30) / rowH);
        if (ti < 0 || ti >= THREADS.length) return;
        const len = threadLengths(params)[ti];
        const cellW = (rect.width - 90) / len;
        const cell = Math.floor((x - 70) / cellW);
        const hit = events.find(
          (ev) => (ev.data?.thread as number) === ti && (ev.data?.cell as number) === cell,
        );
        if (hit) onInspect(hit);
      }}
    />
  );
}

export const polymeterLoom = defineLab({
  id: 'polymeter-loom',
  version: 2,
  title: 'Polymeter Loom',
  family: 'pattern',
  question: 'What happens when loops of different lengths share one pulse?',
  params: [
    { kind: 'int', key: 'lenA', label: 'Warp length', min: 2, max: 16, default: 3, hint: 'Cells in the lowest thread.' },
    { kind: 'int', key: 'lenB', label: 'Weft length', min: 2, max: 16, default: 4, hint: 'Cells in the second thread.' },
    { kind: 'int', key: 'lenC', label: 'Silk length', min: 2, max: 16, default: 5, hint: 'Cells in the third thread.' },
    { kind: 'int', key: 'lenD', label: 'Gold length', min: 2, max: 16, default: 7, hint: 'Cells in the highest thread.' },
    {
      kind: 'number',
      key: 'density',
      label: 'Density',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.6,
      hint: 'Each cell has a fixed seeded roll; it sounds once density passes it.',
    },
    {
      kind: 'number',
      key: 'accent',
      label: 'Downbeat accent',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.5,
      hint: 'Extra weight when a thread restarts — makes the drift audible.',
    },
    {
      kind: 'select',
      key: 'scale',
      label: 'Scale',
      options: [
        { value: 'dorian', label: 'Dorian' },
        { value: 'pentatonic', label: 'Pentatonic' },
        { value: 'lydian', label: 'Lydian' },
        { value: 'wholetone', label: 'Whole-tone' },
      ],
      default: 'dorian',
      hint: 'Pitch material for all four threads.',
    },
    { kind: 'int', key: 'root', label: 'Root', min: 36, max: 60, default: 45, hint: 'MIDI root of the warp thread.' },
    {
      kind: 'number',
      key: 'wet',
      label: 'Wet mix',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0,
      hint: 'Lowers the loom into a small plausible room seeded like everything else. 0 is the dry loom, exactly as always published.',
    },
  ],
  cycleBeats: (params) => Math.min(lcmAll(threadLengths(params)) * STEP_BEATS, 64),
  events: ({ params, seed, range }) => labEvents(params, seed, range.from, range.to),
  makeInstrument,
  Stage,
  stories: [
    {
      name: 'Classic 3·4·5·7',
      note: 'The canonical drift — realigns after 420 steps.',
      seed: 2,
      params: {},
    },
    {
      name: 'Near miss',
      note: '4·8·8·16 — threads nested, no drift at all. Feel the difference.',
      seed: 9,
      params: { lenA: 4, lenB: 8, lenC: 8, lenD: 16, density: 0.45 },
    },
    {
      name: 'Long weave',
      note: '5·9·11·13 — the pattern will not repeat within your patience.',
      seed: 33,
      params: { lenA: 5, lenB: 9, lenC: 11, lenD: 13, density: 0.5, scale: 'lydian' },
    },
    {
      name: 'In the chamber',
      note: 'The classic drift lowered into the loom’s own small room — tails between the threads.',
      seed: 2,
      params: { wet: 0.6 },
    },
  ],
  docs: `Polymeter is not polyrhythm: every thread here shares the same eighth-note
pulse, but each repeats after a different number of cells, so downbeats
drift apart and reconvene after the least common multiple of the lengths.
The progress bar at the bottom tracks that superperiod — with lengths
3·4·5·7 it closes after 420 steps.

Each cell rolled a fixed number when the loom was seeded; the density knob
is a rising tide that submerges cells into sound as it passes their roll.
Slide it slowly: threads thicken one specific cell at a time, always in the
same order for the same URL.

The wet knob lowers the loom into a room of its own: a small plausible
chamber (seven meters, impossibility zero) written by the same impulse-
response arithmetic the space lab uses, from this loom's seed. It touches
only the air, never the pattern — events are identical at every wet — and
at 0 the signal path is exact unity, so every document published before
the room existed still sounds precisely as written.`,
});
