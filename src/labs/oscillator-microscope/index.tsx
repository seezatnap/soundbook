/*
 * OSCILLATOR MICROSCOPE — the "hello, world" of Soundbook. One oscillator
 * under glass: the stage is an oscilloscope showing both the ideal
 * mathematical waveform (derived from params, deterministic) and the live
 * analyser trace (runtime-only, never serialized).
 */

import type { JSX } from 'react';
import {
  defineLab,
  type EngineFacade,
  type Instrument,
  type MorphResult,
  type StageProps,
} from '@/sdk/lab';
import type { NoteEvent } from '@/sdk/events';
import { morphParams, type ParamSpec, type ParamValues } from '@/sdk/params';
import { rngFor } from '@/sdk/prng';
import { useStageCanvas } from '@/labs/shared/stage';

const CYCLE_BEATS = 4;

function labEvents(params: ParamValues, seed: number, from: number, to: number): NoteEvent[] {
  const events: NoteEvent[] = [];
  const pulse = params.pulse as boolean;
  const stepBeats = pulse ? 1 : CYCLE_BEATS;
  const dur = pulse ? 0.6 : CYCLE_BEATS;
  const first = Math.ceil(from / stepBeats);
  for (let i = first; i * stepBeats < to; i++) {
    const beat = i * stepBeats;
    /* Tiny seeded level variation proves the seed reaches the sound. */
    const wobble = rngFor(seed, 'level', i).range(-0.04, 0.04);
    events.push({
      id: `osc:${i}`,
      beat,
      dur,
      freq: params.freq as number,
      gain: 0.5 + wobble,
      voice: 'osc',
      provenance: [
        {
          rule: pulse ? 'pulse(1 beat)' : 'drone(cycle)',
          detail: pulse
            ? `gate reopens every beat; this is beat ${i}`
            : `one sustained tone per ${CYCLE_BEATS}-beat cycle, cycle ${i}`,
        },
        { rule: 'level(seed)', detail: `seeded wobble ${wobble >= 0 ? '+' : ''}${wobble.toFixed(3)}` },
      ],
      data: { index: i },
    });
  }
  return events;
}

function buildWave(ctx: BaseAudioContext, partials: number): PeriodicWave {
  const n = Math.max(1, partials);
  const real = new Float32Array(n + 1);
  const imag = new Float32Array(n + 1);
  for (let k = 1; k <= n; k++) imag[k] = 1 / k;
  return ctx.createPeriodicWave(real, imag, { disableNormalization: false });
}

function makeInstrument(engine: EngineFacade, initial: ParamValues): Instrument {
  const ctx = engine.ctx;
  let wave = buildWave(ctx, initial.partials as number);
  let wavePartials = initial.partials as number;

  return {
    trigger(event, when, durSec, params) {
      const release = engine.acquireVoice();
      if (!release) return;
      const voices = params.unison as number;
      const spread = params.spread as number;
      const blend = params.blend as number;
      const master = ctx.createGain();
      master.gain.value = 0;
      master.connect(engine.out);

      const attack = 0.015;
      const releaseT = 0.06;
      const peak = (event.gain * 0.9) / Math.sqrt(voices);
      master.gain.setValueAtTime(0, when);
      master.gain.linearRampToValueAtTime(peak, when + attack);
      master.gain.setValueAtTime(peak, Math.max(when + attack, when + durSec - releaseT));
      master.gain.linearRampToValueAtTime(0, when + releaseT + Math.max(attack, durSec - releaseT));

      if (
        ((params.wave as string) === 'partials' || (params.waveB as string) === 'partials') &&
        wavePartials !== (params.partials as number)
      ) {
        wave = buildWave(ctx, params.partials as number);
        wavePartials = params.partials as number;
      }

      /* Linear crossfade — for two oscillators at the same frequency and
         phase this is the pointwise average of the two waveforms, so the
         sound is exactly the curve the scope draws. */
      const gainA = ctx.createGain();
      const gainB = ctx.createGain();
      gainA.gain.value = 1 - blend;
      gainB.gain.value = blend;
      gainA.connect(master);
      gainB.connect(master);

      const shapes: Array<[string, GainNode]> = [
        [params.wave as string, gainA],
        [params.waveB as string, gainB],
      ];
      let pending = voices * shapes.length;
      for (let v = 0; v < voices; v++) {
        for (const [shape, dest] of shapes) {
          const osc = ctx.createOscillator();
          if (shape === 'partials') osc.setPeriodicWave(wave);
          else osc.type = shape as OscillatorType;
          osc.frequency.value = event.freq;
          /* Symmetric unison fan: -spread … +spread cents. */
          osc.detune.value = voices === 1 ? 0 : ((v / (voices - 1)) * 2 - 1) * spread;
          osc.connect(dest);
          osc.onended = () => {
            pending -= 1;
            if (pending === 0) {
              master.disconnect();
              gainA.disconnect();
              gainB.disconnect();
              release();
            }
          };
          osc.start(when);
          osc.stop(when + durSec + 0.02);
        }
      }
    },
    update() {
      /* Fully event-driven: nothing persistent to retune. */
    },
    dispose() {},
  };
}

/** The ideal waveform sample at phase t∈[0,1), from params alone. */
function idealSample(shape: string, partials: number, t: number): number {
  const tau = t * Math.PI * 2;
  switch (shape) {
    case 'sine':
      return Math.sin(tau);
    case 'square':
      return Math.sin(tau) >= 0 ? 1 : -1;
    case 'sawtooth':
      return 2 * (t - Math.floor(t + 0.5));
    case 'triangle':
      return 2 * Math.abs(2 * (t - Math.floor(t + 0.5))) - 1;
    default: {
      let sum = 0;
      for (let k = 1; k <= partials; k++) sum += Math.sin(tau * k) / k;
      return sum / 1.6;
    }
  }
}

function Stage({ params, analyser, playing }: StageProps): JSX.Element {
  const canvasRef = useStageCanvas((g, w, h, pal) => {
    g.fillStyle = pal.faceSunken;
    g.fillRect(0, 0, w, h);

    /* Graticule. */
    g.strokeStyle = pal.edgeDark;
    g.lineWidth = 1;
    const cells = 8;
    for (let i = 1; i < cells; i++) {
      const x = Math.round((w * i) / cells) + 0.5;
      const y = Math.round((h * i) / cells) + 0.5;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
    g.strokeStyle = pal.edgeLight;
    g.beginPath();
    g.moveTo(0, Math.round(h / 2) + 0.5);
    g.lineTo(w, Math.round(h / 2) + 0.5);
    g.stroke();

    const mid = h / 2;
    const amp = h * 0.36;

    /* Ideal waveform — the deterministic promise. Two cycles, the two
       shapes averaged pointwise exactly as the instrument sums them. */
    const blend = params.blend as number;
    const mixA = 1 - blend;
    const mixB = blend;
    g.strokeStyle = pal.inkDim;
    g.lineWidth = 1;
    g.beginPath();
    for (let x = 0; x <= w; x++) {
      const t = ((x / w) * 2) % 1;
      const partials = params.partials as number;
      const sample =
        idealSample(params.wave as string, partials, t) * mixA +
        idealSample(params.waveB as string, partials, t) * mixB;
      const y = mid - sample * amp;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();

    /* Live trace — what the speaker actually got, when running. */
    if (analyser && playing) {
      const data = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(data);
      /* Trigger on a rising zero crossing for a stable picture. */
      let start = 0;
      for (let i = 1; i < data.length / 2; i++) {
        if (data[i - 1] <= 0 && data[i] > 0) {
          start = i;
          break;
        }
      }
      const span = Math.min(data.length - start, Math.floor(data.length / 2));
      g.strokeStyle = pal.accent;
      g.lineWidth = 2;
      g.beginPath();
      for (let x = 0; x <= w; x++) {
        const i = start + Math.floor((x / w) * span);
        const y = mid - (data[i] ?? 0) * amp * 1.6;
        if (x === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.stroke();
    }

    /* Readout. */
    g.fillStyle = pal.ink;
    g.font = '11px monospace';
    const freq = params.freq as number;
    const blendPct = Math.round(blend * 100);
    g.fillText(
      `${freq.toFixed(1)} Hz  ·  period ${(1000 / freq).toFixed(2)} ms  ·  ${params.wave}→${params.waveB} ${blendPct}%`,
      8,
      16,
    );
    g.fillStyle = pal.inkDim;
    g.fillText(playing ? 'LIVE TRACE + IDEAL' : 'IDEAL WAVEFORM (press play)', 8, h - 8);
  });

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />;
}

const PARAMS: ParamSpec[] = [
    {
      kind: 'select',
      key: 'wave',
      label: 'Wave A',
      options: [
        { value: 'sine', label: 'Sine' },
        { value: 'square', label: 'Square' },
        { value: 'sawtooth', label: 'Sawtooth' },
        { value: 'triangle', label: 'Triangle' },
        { value: 'partials', label: 'Partial stack' },
      ],
      default: 'sine',
      hint: 'The shape under the microscope at blend 0.',
    },
    {
      kind: 'select',
      key: 'waveB',
      label: 'Wave B',
      options: [
        { value: 'sine', label: 'Sine' },
        { value: 'square', label: 'Square' },
        { value: 'sawtooth', label: 'Sawtooth' },
        { value: 'triangle', label: 'Triangle' },
        { value: 'partials', label: 'Partial stack' },
      ],
      default: 'triangle',
      hint: 'The second shape, reached by raising the blend.',
    },
    {
      kind: 'number',
      key: 'blend',
      label: 'Wave blend',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0,
      hint: 'Pointwise average of Wave A and Wave B: (1−t)·A + t·B at every x.',
    },
    {
      kind: 'number',
      key: 'freq',
      label: 'Frequency',
      min: 27.5,
      max: 1760,
      step: 0.5,
      default: 220,
      unit: 'Hz',
      hint: 'A0 to A6.',
    },
    {
      kind: 'int',
      key: 'partials',
      label: 'Partials',
      min: 1,
      max: 24,
      default: 8,
      hint: 'Harmonics in the partial stack (1/n amplitudes). Only audible on "Partial stack".',
    },
    {
      kind: 'int',
      key: 'unison',
      label: 'Unison voices',
      min: 1,
      max: 5,
      default: 1,
      hint: 'Detuned copies fanned around the pitch.',
    },
    {
      kind: 'number',
      key: 'spread',
      label: 'Detune spread',
      min: 0,
      max: 50,
      step: 1,
      default: 8,
      unit: 'ct',
      hint: 'Width of the unison fan in cents.',
    },
    {
      kind: 'toggle',
      key: 'pulse',
      label: 'Pulse gate',
      default: false,
      hint: 'Gate the tone every beat instead of droning.',
    },
];

/*
 * A/B morph override: when the two slots hold different primary waves, the
 * morph position averages the two graphs at every x — wave A vs. wave B at
 * weight t — instead of snapping the selector at the midpoint. The wave
 * selector has no single truthful value mid-morph, so it reports ‹blended›.
 */
function morphOscillator(a: ParamValues, b: ParamValues, t: number): MorphResult {
  const base = morphParams(PARAMS, a, b, t);
  if (t > 0 && t < 1 && a.wave !== b.wave) {
    return {
      params: {
        ...base,
        wave: a.wave,
        waveB: b.wave,
        blend: Number(t.toFixed(4)),
      },
      blended: ['wave'],
    };
  }
  return { params: base, blended: [] };
}

export const oscillatorMicroscope = defineLab({
  id: 'oscillator-microscope',
  version: 2,
  title: 'Oscillator Microscope',
  family: 'instrumentation',
  question: 'What does a single oscillator actually put in the air?',
  params: PARAMS,
  cycleBeats: () => CYCLE_BEATS,
  events: ({ params, seed, range }) => labEvents(params, seed, range.from, range.to),
  morph: morphOscillator,
  makeInstrument,
  Stage,
  stories: [
    {
      name: 'Pure tone',
      note: 'A lone sine at A3 — the baseline for every other lab.',
      seed: 1,
      params: {},
    },
    {
      name: 'Buzz swarm',
      note: 'Five detuned saws, pulsed — supersaw physics on the scope.',
      seed: 7,
      params: { wave: 'sawtooth', unison: 5, spread: 22, pulse: true, freq: 110 },
    },
    {
      name: 'Harmonic staircase',
      note: 'Watch the shape converge on a saw as partials pile up.',
      seed: 3,
      params: { wave: 'partials', partials: 16, freq: 165 },
    },
    {
      name: 'Sine into the saw',
      note: 'Blend 0, Wave B saw. SET B, raise blend to 1, then ride the A/B morph slider.',
      seed: 2,
      params: { wave: 'sine', waveB: 'sawtooth', blend: 0, freq: 110 },
    },
  ],
  docs: `The microscope shows two traces. The dim one is the ideal waveform computed
from your parameters — pure mathematics, identical on every machine, part of
the document. The bright one is the live analyser tap on the master bus —
runtime evidence, never serialized, and slightly different per browser.
That gap is Soundbook's core promise in miniature: identical events, not
necessarily bit-identical air.

The partial stack builds a waveform from N harmonics at 1/n amplitude; at 24
partials it is visibly becoming the sawtooth two clicks away on the same
selector. Unison voices are detuned symmetrically across the spread, which is
why odd counts keep one voice dead center.

Wave blend is a pointwise average: at every x the output is (1−t)·A(x) +
t·B(x), and since both oscillators share frequency and phase, what you hear
is exactly the curve the scope draws. The A/B morph goes further: store a
different wave in each slot and the morph slider averages the two graphs
directly — the wave selector reads ‹blended› while no single shape is in
effect. Watch the sine grow teeth.`,
});
