/*
 * EUCLIDEAN CONSTELLATION — three voices of E(k,n) rhythms drawn as star
 * polygons on concentric orbits. Distributing k pulses as evenly as possible
 * over n steps produces most of the world's groove vocabulary; rotating the
 * same pattern produces most of the rest.
 */

import type { JSX } from 'react';
import { defineLab, type EngineFacade, type Instrument, type StageProps } from '@/sdk/lab';
import type { NoteEvent } from '@/sdk/events';
import type { ParamValues } from '@/sdk/params';
import { rngFor } from '@/sdk/prng';
import { SCALES, euclid, rotate, scaleNote } from '@/labs/shared/music';
import { useStageCanvas } from '@/labs/shared/stage';

const STEP_BEATS = 0.25;

interface VoiceSpec {
  name: string;
  pulsesKey: string;
  rotateFactor: number;
  degreeBase: number;
  octave: number;
}

const VOICES: VoiceSpec[] = [
  { name: 'low', pulsesKey: 'pulsesA', rotateFactor: 0, degreeBase: 0, octave: 0 },
  { name: 'mid', pulsesKey: 'pulsesB', rotateFactor: 1, degreeBase: 2, octave: 1 },
  { name: 'high', pulsesKey: 'pulsesC', rotateFactor: 2, degreeBase: 4, octave: 2 },
];

function voicePattern(params: ParamValues, voice: VoiceSpec): boolean[] {
  const steps = params.steps as number;
  const pulses = Math.min(params[voice.pulsesKey] as number, steps);
  const rot = (params.rotate as number) * voice.rotateFactor;
  return rotate(euclid(pulses, steps), rot);
}

function labEvents(params: ParamValues, seed: number, from: number, to: number): NoteEvent[] {
  const steps = params.steps as number;
  const scale = SCALES[params.scale as string] ?? SCALES.pentatonic;
  const root = params.root as number;
  const events: NoteEvent[] = [];

  for (const voice of VOICES) {
    const pattern = voicePattern(params, voice);
    const pulses = Math.min(params[voice.pulsesKey] as number, steps);
    const rot = (params.rotate as number) * voice.rotateFactor;
    const first = Math.ceil(from / STEP_BEATS);
    for (let g = first; g * STEP_BEATS < to; g++) {
      const step = ((g % steps) + steps) % steps;
      if (!pattern[step]) continue;
      const beat = g * STEP_BEATS;
      /* Seeded per (voice, step): the melody is a fixed constellation. */
      const rng = rngFor(seed, 'pitch', voice.name, step);
      const degree = voice.degreeBase + rng.int(scale.length);
      const midi = scaleNote(root + voice.octave * 12, scale, degree);
      const accent = step === rot % steps;
      const pulseIndex = pattern.slice(0, step + 1).filter(Boolean).length;
      events.push({
        id: `star:${voice.name}:${g}`,
        beat,
        dur: 0.22,
        freq: 440 * Math.pow(2, (midi - 69) / 12),
        gain: accent ? 0.8 : 0.45 + rng.range(0, 0.15),
        voice: voice.name,
        provenance: [
          {
            rule: `euclid(${pulses},${steps})`,
            detail: `Bjorklund spreads ${pulses} pulses maximally evenly over ${steps} steps; this is pulse ${pulseIndex} of ${pulses}`,
          },
          {
            rule: `rotate(${rot})`,
            detail:
              voice.rotateFactor === 0
                ? 'anchor voice, never rotated'
                : `voice rotates ${voice.rotateFactor}× the rotate knob`,
          },
          {
            rule: 'pitch(seed)',
            detail: `seeded degree ${degree} of ${params.scale} on ${voice.name} orbit`,
          },
        ],
        data: { step, voice: voice.name, midi },
      });
    }
  }
  return events.sort((a, b) => a.beat - b.beat);
}

function makeInstrument(engine: EngineFacade, _initial: ParamValues): Instrument {
  const ctx = engine.ctx;
  return {
    trigger(event, when, _durSec, _params) {
      const release = engine.acquireVoice();
      if (!release) return;
      /* FM pluck: index and brightness vary by orbit. */
      const bright = event.voice === 'low' ? 1.2 : event.voice === 'mid' ? 2.0 : 3.2;
      const carrier = ctx.createOscillator();
      carrier.type = 'sine';
      carrier.frequency.value = event.freq;
      const mod = ctx.createOscillator();
      mod.type = 'sine';
      mod.frequency.value = event.freq * 2.001;
      const modGain = ctx.createGain();
      mod.connect(modGain);
      modGain.connect(carrier.frequency);
      modGain.gain.setValueAtTime(event.freq * bright, when);
      modGain.gain.exponentialRampToValueAtTime(1, when + 0.35);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0, when);
      env.gain.linearRampToValueAtTime(event.gain * 0.7, when + 0.004);
      env.gain.setTargetAtTime(0, when + 0.01, 0.09);
      carrier.connect(env);
      env.connect(engine.out);

      carrier.onended = () => {
        env.disconnect();
        modGain.disconnect();
        release();
      };
      carrier.start(when);
      mod.start(when);
      carrier.stop(when + 0.6);
      mod.stop(when + 0.6);
    },
    update() {},
    retune() {
      /* The seed only reaches the events, never the graph. */
    },
    dispose() {},
  };
}

function Stage({ params, beat, getBeat, events, recent, onInspect }: StageProps): JSX.Element {
  const canvasRef = useStageCanvas((g, w, h, pal, nowMs) => {
    g.fillStyle = pal.faceSunken;
    g.fillRect(0, 0, w, h);
    const steps = params.steps as number;
    const cx = w / 2;
    const cy = h / 2;
    const maxR = Math.min(w, h) * 0.42;
    const orbitR = [maxR * 0.45, maxR * 0.72, maxR];
    const orbitColor = [pal.accent, pal.ok, pal.accent2];

    const angleOf = (step: number): number => (step / steps) * Math.PI * 2 - Math.PI / 2;

    /* Step lattice. */
    for (let s = 0; s < steps; s++) {
      const a = angleOf(s);
      g.fillStyle = s % 4 === 0 ? pal.inkDim : pal.edgeDark;
      const r = maxR + 10;
      g.fillRect(cx + Math.cos(a) * r - 1, cy + Math.sin(a) * r - 1, 2, 2);
    }

    VOICES.forEach((voice, vi) => {
      const pattern = voicePattern(params, voice);
      const hits: number[] = [];
      pattern.forEach((on, s) => on && hits.push(s));
      const r = orbitR[vi];

      g.strokeStyle = pal.edgeDark;
      g.lineWidth = 1;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();

      /* The constellation: chords between consecutive pulses. */
      if (hits.length > 1) {
        g.strokeStyle = orbitColor[vi];
        g.globalAlpha = 0.5;
        g.lineWidth = 1;
        g.beginPath();
        hits.forEach((s, i) => {
          const a = angleOf(s);
          const x = cx + Math.cos(a) * r;
          const y = cy + Math.sin(a) * r;
          if (i === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        });
        g.closePath();
        g.stroke();
        g.globalAlpha = 1;
      }

      /* Stars. */
      for (const s of hits) {
        const a = angleOf(s);
        const x = cx + Math.cos(a) * r;
        const y = cy + Math.sin(a) * r;
        g.fillStyle = orbitColor[vi];
        g.fillRect(x - 2, y - 2, 5, 5);
      }
    });

    /* Flashes on recent hits. */
    for (const { event, at } of recent) {
      const age = nowMs - at;
      if (age < 0 || age > 350) continue;
      const vi = VOICES.findIndex((v) => v.name === event.voice);
      if (vi === -1) continue;
      const s = (event.data?.step as number) ?? 0;
      const a = angleOf(s);
      const r = orbitR[vi];
      const x = cx + Math.cos(a) * r;
      const y = cy + Math.sin(a) * r;
      const t = age / 350;
      g.globalAlpha = 1 - t;
      g.strokeStyle = pal.ink;
      g.lineWidth = 2;
      g.strokeRect(x - 4 - t * 6, y - 4 - t * 6, (4 + t * 6) * 2 + 1, (4 + t * 6) * 2 + 1);
      g.globalAlpha = 1;
    }

    /* Playhead sweep. */
    const cycleBeats = steps * STEP_BEATS;
    const liveBeat = getBeat?.() ?? beat;
    const pos = ((liveBeat % cycleBeats) + cycleBeats) % cycleBeats;
    const pa = (pos / cycleBeats) * Math.PI * 2 - Math.PI / 2;
    g.strokeStyle = pal.warn;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(pa) * (maxR + 8), cy + Math.sin(pa) * (maxR + 8));
    g.stroke();

    g.fillStyle = pal.ink;
    g.font = '11px monospace';
    g.fillText(
      `E(${Math.min(params.pulsesA as number, steps)},${steps}) · E(${Math.min(params.pulsesB as number, steps)},${steps}) · E(${Math.min(params.pulsesC as number, steps)},${steps})`,
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
        const w = rect.width;
        const h = rect.height;
        const x = e.clientX - rect.left - w / 2;
        const y = e.clientY - rect.top - h / 2;
        const steps = params.steps as number;
        const angle = Math.atan2(y, x) + Math.PI / 2;
        const step =
          ((Math.round((angle / (Math.PI * 2)) * steps) % steps) + steps) % steps;
        const maxR = Math.min(w, h) * 0.42;
        const dist = Math.hypot(x, y);
        const orbit = dist < maxR * 0.58 ? 'low' : dist < maxR * 0.86 ? 'mid' : 'high';
        const hit = events.find(
          (ev) => ev.voice === orbit && (ev.data?.step as number) === step,
        );
        if (hit) onInspect(hit);
      }}
    />
  );
}

export const euclideanConstellation = defineLab({
  id: 'euclidean-constellation',
  version: 1,
  title: 'Euclidean Constellation',
  family: 'pattern',
  question: 'Why does spreading k pulses evenly over n steps make a groove?',
  params: [
    { kind: 'int', key: 'steps', label: 'Steps', min: 8, max: 24, default: 16, hint: 'Sixteenths per cycle — the ring.' },
    { kind: 'int', key: 'pulsesA', label: 'Pulses · low', min: 1, max: 24, default: 4, hint: 'Inner orbit pulse count.' },
    { kind: 'int', key: 'pulsesB', label: 'Pulses · mid', min: 1, max: 24, default: 5, hint: 'Middle orbit pulse count.' },
    { kind: 'int', key: 'pulsesC', label: 'Pulses · high', min: 1, max: 24, default: 7, hint: 'Outer orbit pulse count.' },
    { kind: 'int', key: 'rotate', label: 'Rotate', min: 0, max: 23, default: 0, hint: 'Mid rotates 1×, high 2×, low anchors.' },
    {
      kind: 'select',
      key: 'scale',
      label: 'Scale',
      options: [
        { value: 'pentatonic', label: 'Pentatonic' },
        { value: 'dorian', label: 'Dorian' },
        { value: 'lydian', label: 'Lydian' },
        { value: 'wholetone', label: 'Whole-tone' },
      ],
      default: 'pentatonic',
      hint: 'Seeded pitches are drawn from this scale.',
    },
    { kind: 'int', key: 'root', label: 'Root', min: 40, max: 64, default: 45, hint: 'MIDI root of the low orbit.' },
  ],
  cycleBeats: (params) => (params.steps as number) * STEP_BEATS,
  events: ({ params, seed, range }) => labEvents(params, seed, range.from, range.to),
  makeInstrument,
  Stage,
  stories: [
    {
      name: 'Son clave orbit',
      note: 'E(5,16) against E(3,16) — the Cuban skeleton emerges.',
      seed: 5,
      params: { pulsesA: 3, pulsesB: 5, pulsesC: 7, rotate: 0 },
    },
    {
      name: 'Aksak spin',
      note: 'Nine steps, rotated — Balkan limping meter as geometry.',
      seed: 12,
      params: { steps: 9, pulsesA: 2, pulsesB: 4, pulsesC: 5, rotate: 2, scale: 'dorian' },
    },
    {
      name: 'Dense lattice',
      note: 'Near-full rings interfere into a shimmering tresillo halo.',
      seed: 40,
      params: { steps: 24, pulsesA: 6, pulsesB: 9, pulsesC: 16, scale: 'wholetone', root: 52 },
    },
  ],
  docs: `E(k,n) distributes k pulses over n steps as evenly as integer arithmetic
allows — the same maximally-even structure shows up in Cuban clave, West
African bell patterns, Turkish aksak, and the leap years of the Jewish
calendar. Here three E(k,n) rings share one lattice; the rotate knob spins
the mid orbit once and the high orbit twice, so a single control phases the
whole constellation.

Pitches are seeded per station, not per pass: the melody is a fixed property
of the URL, and the groove you hear is pure structure. Click any star to see
the arithmetic that put it there.`,
});
