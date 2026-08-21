/*
 * EUCLIDEAN CONSTELLATION — three voices of E(k,n) rhythms drawn as star
 * polygons on concentric orbits. Distributing k pulses as evenly as possible
 * over n steps produces most of the world's groove vocabulary; rotating the
 * same pattern produces most of the rest.
 */

import { defineLab, type EngineFacade, type Instrument } from '@/sdk/lab';
import type { NoteEvent } from '@/sdk/events';
import type { ParamValues } from '@/sdk/params';
import { rngFor } from '@/sdk/prng';
import { SCALES, euclid, rotate, scaleNote } from '@/labs/shared/music';

export const STEP_BEATS = 0.25;

interface VoiceSpec {
  name: string;
  pulsesKey: string;
  rotateFactor: number;
  degreeBase: number;
  octave: number;
}

export const VOICES: VoiceSpec[] = [
  { name: 'low', pulsesKey: 'pulsesA', rotateFactor: 0, degreeBase: 0, octave: 0 },
  { name: 'mid', pulsesKey: 'pulsesB', rotateFactor: 1, degreeBase: 2, octave: 1 },
  { name: 'high', pulsesKey: 'pulsesC', rotateFactor: 2, degreeBase: 4, octave: 2 },
];

export function voicePattern(params: ParamValues, voice: VoiceSpec): boolean[] {
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
