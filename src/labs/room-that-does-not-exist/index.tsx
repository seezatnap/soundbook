/*
 * A ROOM THAT DOES NOT EXIST — convolution reverb whose impulse response is
 * synthesized, deterministically, from the seed. At impossibility 0 the IR
 * is a plausible shoebox; as it rises, the tail blooms *louder* before it
 * dies and a time-reversed component leaks in — geometry no builder could
 * pour.
 */

import type { JSX } from 'react';
import { defineLab, type EngineFacade, type Instrument, type StageProps } from '@/sdk/lab';
import type { NoteEvent } from '@/sdk/events';
import type { ParamValues } from '@/sdk/params';
import { rngFor } from '@/sdk/prng';
import { SCALES, scaleNote } from '@/labs/shared/music';
import { makeSmoothConvolver } from '@/labs/shared/smooth-convolver';
import { useStageCanvas } from '@/labs/shared/stage';

const CYCLE_BEATS = 8;
const SLOTS = 16; // half-beat grid
const ROOT = 50;

function labEvents(params: ParamValues, seed: number, from: number, to: number): NoteEvent[] {
  const events: NoteEvent[] = [];
  const sources = params.sources as number;
  const scale = SCALES.pentatonic;
  const firstCycle = Math.floor(from / CYCLE_BEATS);
  const lastCycle = Math.ceil(to / CYCLE_BEATS);
  for (let c = firstCycle; c < lastCycle; c++) {
    const rng = rngFor(seed, 'sparks', c);
    const slots = Array.from({ length: SLOTS }, (_, i) => i);
    for (let i = slots.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [slots[i], slots[j]] = [slots[j], slots[i]];
    }
    const chosen = slots.slice(0, sources).sort((a, b) => a - b);
    for (const slot of chosen) {
      const beat = c * CYCLE_BEATS + slot * 0.5;
      if (beat < from || beat >= to) continue;
      const pitchRng = rngFor(seed, 'pitch', c, slot);
      const degree = pitchRng.int(10) - 2;
      const midi = scaleNote(ROOT, scale, degree);
      events.push({
        id: `spark:${c}:${slot}`,
        beat,
        dur: 0.5,
        freq: 440 * Math.pow(2, (midi - 69) / 12),
        gain: 0.5 + pitchRng.range(0, 0.25),
        voice: 'spark',
        provenance: [
          {
            rule: `sparse(${sources}/16)`,
            detail: `cycle ${c}: seeded shuffle placed a spark at half-beat ${slot}`,
          },
          { rule: 'pitch(seed)', detail: `pentatonic degree ${degree} around MIDI ${ROOT}` },
          {
            rule: 'room(seed)',
            detail: 'every spark excites the same impossible impulse response',
          },
        ],
        data: { slot, cycle: c },
      });
    }
  }
  return events;
}

function irKey(params: ParamValues, seed: number, sampleRate: number): string {
  return [seed, params.size, params.decay, params.damping, params.impossibility, sampleRate].join('|');
}

/**
 * Deterministic impossible-room impulse response. Exported so a composition
 * can stand other instruments in the same room this lab's sparks excite.
 */
export function buildIr(ctx: BaseAudioContext, params: ParamValues, seed: number): AudioBuffer {
  const decay = params.decay as number;
  const size = params.size as number;
  const damping = params.damping as number;
  const imp = params.impossibility as number;
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.ceil(decay * rate));
  const buffer = ctx.createBuffer(2, length, rate);
  const tau = decay / 6.9; // T60-style
  const bloomPeak = decay * (0.15 + 0.45 * imp);
  const bloomWidth = decay * 0.18 + 1e-4;

  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    const rng = rngFor(seed, 'ir', ch);
    /* One-pole lowpass state for damping. */
    let lp = 0;
    const alpha = 1 - Math.min(0.995, damping * 0.9 + 0.05);
    for (let i = 0; i < length; i++) {
      const t = i / rate;
      const noise = rng.next() * 2 - 1;
      lp += alpha * (noise - lp);
      /* Possible room: exponential decay. Impossible: a bloom that swells. */
      const possible = Math.exp(-t / tau);
      const bloom = Math.exp(-((t - bloomPeak) ** 2) / (2 * bloomWidth ** 2));
      const reversed = Math.exp(-(decay - t) / (tau * 0.5));
      const env = (1 - imp) * possible + imp * (bloom * 0.85 + reversed * 0.35);
      data[i] = lp * env;
    }
    /* Early reflections: spikes spaced by the room's mean free path. */
    const erRng = rngFor(seed, 'early', ch);
    const spacing = size / 343;
    for (let k = 1; k <= 12; k++) {
      const jitter = 1 + erRng.range(-0.15, 0.15);
      /* Impossibility warps reflection times off the physical lattice. */
      const warp = 1 + imp * erRng.range(-0.4, 0.6);
      const at = Math.floor(k * spacing * jitter * warp * rate);
      if (at > 0 && at < length) {
        data[at] += (erRng.chance(0.5) ? 1 : -1) * Math.exp(-k * 0.25) * 0.8;
      }
    }
    /* Normalize per channel. */
    let peak = 0;
    for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(data[i]));
    if (peak > 0) for (let i = 0; i < length; i++) data[i] = (data[i] / peak) * 0.5;
  }
  return buffer;
}

function makeInstrument(engine: EngineFacade, initial: ParamValues, seed: number): Instrument {
  const ctx = engine.ctx;
  const dry = ctx.createGain();
  const wet = ctx.createGain();
  /* Live room edits (and A/B scrubs interpolating them) must not cut the
     tail — the sparks are almost entirely tail. The smooth convolver keeps
     the old room ringing until the knobs settle, then crossfades. */
  const room = makeSmoothConvolver(ctx);
  const input = ctx.createGain();
  input.connect(dry);
  input.connect(room.input);
  room.output.connect(wet);
  dry.connect(engine.out);
  wet.connect(engine.out);

  const applyRoom = (params: ParamValues): void => {
    room.set(irKey(params, seed, ctx.sampleRate), () => buildIr(ctx, params, seed));
    const wetAmt = params.wet as number;
    dry.gain.value = Math.cos((wetAmt * Math.PI) / 2) * 0.9;
    wet.gain.value = Math.sin((wetAmt * Math.PI) / 2) * 1.1;
  };
  applyRoom(initial);

  return {
    trigger(event, when, _durSec, _params) {
      const release = engine.acquireVoice();
      if (!release) return;
      /* The source is deliberately plain — the room is the instrument. */
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = event.freq;
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = event.freq * 2;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, when);
      env.gain.linearRampToValueAtTime(event.gain * 0.6, when + 0.004);
      env.gain.setTargetAtTime(0, when + 0.01, 0.07);
      const o2gain = ctx.createGain();
      o2gain.gain.value = 0.3;
      osc.connect(env);
      osc2.connect(o2gain);
      o2gain.connect(env);
      env.connect(input);
      let pending = 2;
      const done = (): void => {
        pending -= 1;
        if (pending === 0) {
          env.disconnect();
          o2gain.disconnect();
          release();
        }
      };
      osc.onended = done;
      osc2.onended = done;
      osc.start(when);
      osc2.start(when);
      osc.stop(when + 0.5);
      osc2.stop(when + 0.5);
    },
    update(params) {
      applyRoom(params);
    },
    dispose() {
      input.disconnect();
      dry.disconnect();
      wet.disconnect();
      room.dispose();
    },
  };
}

function Stage({ params, recent, onInspect, events }: StageProps): JSX.Element {
  const canvasRef = useStageCanvas((g, w, h, pal, nowMs) => {
    g.fillStyle = pal.faceSunken;
    g.fillRect(0, 0, w, h);
    const imp = params.impossibility as number;
    const size = params.size as number;

    /* An axonometric box whose back face refuses to agree with its front. */
    const cx = w / 2;
    const cy = h / 2 + 10;
    const scale = Math.min(w, h) * (0.16 + Math.min(size, 30) * 0.006);
    const fw = scale * 1.6;
    const fh = scale * 1.0;
    const dx = scale * 0.55;
    const dyBack = -scale * 0.45;
    /* Impossibility swings the back face the wrong way. */
    const wrong = imp * scale * 0.9;

    const front = [
      [cx - fw / 2, cy - fh / 2],
      [cx + fw / 2, cy - fh / 2],
      [cx + fw / 2, cy + fh / 2],
      [cx - fw / 2, cy + fh / 2],
    ];
    const back = [
      [cx - fw / 2 + dx, cy - fh / 2 + dyBack],
      [cx + fw / 2 + dx - wrong, cy - fh / 2 + dyBack + wrong * 0.6],
      [cx + fw / 2 + dx - wrong, cy + fh / 2 + dyBack + wrong * 0.2],
      [cx - fw / 2 + dx, cy + fh / 2 + dyBack],
    ];

    g.strokeStyle = pal.inkDim;
    g.lineWidth = 1;
    const poly = (pts: number[][]): void => {
      g.beginPath();
      pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
      g.closePath();
      g.stroke();
    };
    poly(back);
    /* Connectors — the impossible ones cross. */
    front.forEach(([x, y], i) => {
      const [bx, by] = back[(i + Math.round(imp * 1.99)) % 4];
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(bx, by);
      g.stroke();
    });
    g.strokeStyle = pal.ink;
    g.lineWidth = 2;
    poly(front);

    /* Echo ripples from recent sparks, blooming per the IR envelope. */
    const decay = params.decay as number;
    for (const { event, at } of recent) {
      const age = (nowMs - at) / 1000;
      if (age < 0 || age > decay) continue;
      const t = age / decay;
      const bloomPeak = 0.15 + 0.45 * imp;
      const possible = Math.exp(-t * 4);
      const bloom = Math.exp(-((t - bloomPeak) ** 2) / 0.04);
      const strength = (1 - imp) * possible + imp * bloom;
      const slotRng = ((event.data?.slot as number) ?? 0) / SLOTS;
      const ox = cx - fw / 2 + fw * slotRng + dx * 0.3;
      const oy = cy + fh * 0.1 - t * 20;
      g.globalAlpha = Math.min(1, strength);
      g.strokeStyle = pal.accent2;
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(ox, oy, 6 + t * scale * 1.4, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }

    g.fillStyle = pal.ink;
    g.font = '11px monospace';
    g.fillText(
      `${size.toFixed(1)} m mean path · RT ${decay.toFixed(1)}s · impossibility ${(imp * 100).toFixed(0)}%`,
      8,
      16,
    );
    if (imp > 0.6) {
      g.fillStyle = pal.warn;
      g.fillText('SURVEYOR ADVISORY: GEOMETRY NON-EUCLIDEAN', 8, 32);
    }
  });

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', cursor: 'pointer' }}
      onClick={() => {
        if (events.length > 0) onInspect(events[0]);
      }}
    />
  );
}

export const roomThatDoesNotExist = defineLab({
  id: 'room-that-does-not-exist',
  version: 1,
  title: 'A Room That Does Not Exist',
  family: 'space',
  question: 'What does a space sound like when its geometry could never be built?',
  params: [
    { kind: 'number', key: 'size', label: 'Room size', min: 1, max: 40, step: 0.5, default: 9, unit: 'm', hint: 'Mean free path between reflections.' },
    { kind: 'number', key: 'decay', label: 'Reverb time', min: 0.3, max: 10, step: 0.1, default: 4, unit: 's', hint: 'How long the tail survives.' },
    { kind: 'number', key: 'damping', label: 'Damping', min: 0, max: 1, step: 0.01, default: 0.4, hint: 'Soft walls eat the treble first.' },
    {
      kind: 'number',
      key: 'impossibility',
      label: 'Impossibility',
      min: 0,
      max: 1,
      step: 0.01,
      default: 0.35,
      hint: 'The tail swells before dying; reflections abandon physics.',
    },
    { kind: 'number', key: 'wet', label: 'Wet mix', min: 0, max: 1, step: 0.01, default: 0.55, hint: 'Dry spark vs. room.' },
    { kind: 'int', key: 'sources', label: 'Sparks / cycle', min: 1, max: 8, default: 3, hint: 'Seeded excitations per 8-beat cycle.' },
  ],
  cycleBeats: () => CYCLE_BEATS,
  events: ({ params, seed, range }) => labEvents(params, seed, range.from, range.to),
  makeInstrument,
  Stage,
  stories: [
    {
      name: 'Plausible chapel',
      note: 'Impossibility zero — an honest stone room for reference.',
      seed: 14,
      params: { impossibility: 0, size: 18, decay: 5, damping: 0.3, wet: 0.6 },
    },
    {
      name: 'The blooming vault',
      note: 'Echoes that get louder before they die. Walls unclear.',
      seed: 77,
      params: { impossibility: 0.8, decay: 7, wet: 0.75, sources: 2 },
    },
    {
      name: 'Broom closet paradox',
      note: 'A one-meter room with a nine-second tail.',
      seed: 3,
      params: { size: 1, decay: 9, impossibility: 0.5, damping: 0.7, wet: 0.7 },
    },
  ],
  docs: `A convolution reverb is just a recording of a room's answer to a click.
This lab never records one — it writes the answer directly, from the seed:
seeded noise under an envelope, early reflections spaced by the room-size
parameter's mean free path.

A real room's tail can only decay. The impossibility knob mixes in two
violations: a Gaussian bloom (the room answers louder a moment after you
ask) and a time-reversed component (the tail arrives before it leaves).
Because the IR is pure arithmetic on the seed, this impossible place is
exactly reproducible — the same URL opens onto the same nowhere.`,
});
