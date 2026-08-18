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

import { useMemo, type JSX } from 'react';
import {
  defineLab,
  type EngineFacade,
  type Instrument,
  type LabDefinition,
  type StageProps,
} from '@/sdk/lab';
import { midiName, type Cause, type NoteEvent } from '@/sdk/events';
import { defaultsOf, sanitizeAll, type ParamValues } from '@/sdk/params';
import { rngFor } from '@/sdk/prng';
import {
  consensusKey,
  freqToMidi,
  keyLabel,
  retuneFreq,
  type ConsensusKey,
} from '@/labs/shared/harmonize';
import {
  makeLayerCache,
  useStageCanvas,
  useThrottledMemo,
  type StagePalette,
} from '@/labs/shared/stage';
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

const TOTAL_BEATS = 360; // 3:00 at the authored 120 BPM
const CYCLE_BEATS = 8; // display/inspection window; the piece is through-composed

interface Section {
  at: number;
  numeral: string;
  name: string;
}

const SECTIONS: Section[] = [
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

function envAt(env: Env, beat: number): number {
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

const TRACKS: Track[] = [
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

function pieceEvents(params: ParamValues, seed: number, from: number, to: number): NoteEvent[] {
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

/* ----------------------------------------------------------------- stage */

const LANES = [
  { track: 'stars', label: 'LOOM', frac: 0.46, lo: 38, hi: 104 },
  { track: 'sparks', label: 'SPARKS', frac: 0.32, lo: 40, hi: 74 },
  { track: 'drone', label: 'DRONE', frac: 0.22, lo: 14, hi: 34 },
] as const;

const PLOT = { left: 10, right: 10, top: 42, bottom: 24 };

interface LaneBox {
  track: string;
  label: string;
  y: number;
  h: number;
  lo: number;
  hi: number;
}

function laneBoxes(height: number): LaneBox[] {
  const plotH = height - PLOT.top - PLOT.bottom;
  const boxes: LaneBox[] = [];
  let y = PLOT.top;
  for (const lane of LANES) {
    const h = plotH * lane.frac;
    boxes.push({ track: lane.track, label: lane.label, y, h, lo: lane.lo, hi: lane.hi });
    y += h;
  }
  return boxes;
}

function eventXY(
  ev: NoteEvent,
  boxes: LaneBox[],
  width: number,
): { x: number; y: number; box: LaneBox } | null {
  const box = boxes.find((b) => b.track === (ev.data?.track as string));
  if (!box) return null;
  const plotW = width - PLOT.left - PLOT.right;
  const x = PLOT.left + (ev.beat / TOTAL_BEATS) * plotW;
  const midi = freqToMidi(ev.freq);
  const t = Math.min(1, Math.max(0, (box.hi - midi) / (box.hi - box.lo)));
  return { x, y: box.y + 4 + t * (box.h - 8), box };
}

function beatAtX(x: number, width: number): number {
  const plotW = width - PLOT.left - PLOT.right;
  const beat = ((x - PLOT.left) / plotW) * TOTAL_BEATS;
  return Math.min(TOTAL_BEATS, Math.max(0, beat));
}

const STAR_COLORS: Record<string, keyof StagePalette> = {
  warp: 'accent',
  weft: 'ok',
  silk: 'accent2',
  gold: 'warn',
};

function Stage({ params, seed, beat, getBeat, recent, onInspect, onSeek }: StageProps): JSX.Element {
  /* The whole 3-minute score for display. The documents are frozen, so
     only the harmonizer console reaches the events — level and wet drags
     recompute nothing, and keyed changes are throttled below drag rate. */
  const scoreStamp = JSON.stringify([params.harmonize, params.starsShift, params.transpose]);
  const score = useThrottledMemo(
    () => pieceEvents(params, seed, 0, TOTAL_BEATS),
    [scoreStamp, seed],
    180,
  );

  const staticLayer = useMemo(() => makeLayerCache(), []);

  const canvasRef = useStageCanvas((g, w, h, pal, nowMs) => {
    const boxes = laneBoxes(h);
    const plotW = w - PLOT.left - PLOT.right;
    const xAt = (b: number): number => PLOT.left + (b / TOTAL_BEATS) * plotW;
    const amount = params.harmonize as number;
    const transpose = params.transpose as number;
    const userShift = params.starsShift as number;
    const key = concordanceConsensus();
    const label = keyLabel({
      rootPc: (((key.rootPc + transpose) % 12) + 12) % 12,
      scaleName: key.scaleName,
    });
    const dpr = g.canvas.width / Math.max(1, w);

    /* Everything the score writes is drawn once per document/size/palette
       and blitted; `score` changes identity on any param or seed change,
       so it keys the cache. Per frame only header, flashes and playhead. */
    const stat = staticLayer(w, h, dpr, [score, pal], (og) => {
      og.fillStyle = pal.faceSunken;
      og.fillRect(0, 0, w, h);
      og.font = '11px monospace';

      /* Lanes. */
      for (const box of boxes) {
        og.strokeStyle = pal.edgeDark;
        og.lineWidth = 1;
        og.beginPath();
        og.moveTo(PLOT.left, Math.round(box.y) + 0.5);
        og.lineTo(w - PLOT.right, Math.round(box.y) + 0.5);
        og.stroke();
        og.fillStyle = pal.inkDim;
        og.fillText(box.label, PLOT.left + 2, box.y + 11);
        /* Arrangement envelope, dim, along the lane floor. */
        const track = TRACKS.find((t) => t.id === box.track);
        if (track) {
          og.strokeStyle = pal.edgeLight;
          og.beginPath();
          for (let px = 0; px <= plotW; px += 4) {
            const b = (px / plotW) * TOTAL_BEATS;
            const level = b < track.enterAt || b >= track.exitAt ? 0 : envAt(track.env, b);
            const y = box.y + box.h - 2 - level * (box.h * 0.25);
            if (px === 0) og.moveTo(PLOT.left + px, y);
            else og.lineTo(PLOT.left + px, y);
          }
          og.stroke();
        }
      }

      /* Section boundaries. */
      for (const s of SECTIONS) {
        const x = Math.round(xAt(s.at)) + 0.5;
        og.strokeStyle = pal.edgeLight;
        og.beginPath();
        og.moveTo(x, PLOT.top);
        og.lineTo(x, h - PLOT.bottom);
        og.stroke();
        og.fillStyle = pal.inkDim;
        og.fillText(`§${s.numeral} ${s.name.toUpperCase()}`, x + 3, h - PLOT.bottom + 12);
      }

      /* Minute marks (at the authored 120 BPM). */
      og.fillStyle = pal.inkDim;
      for (let b = 0; b <= TOTAL_BEATS; b += 120) {
        const x = xAt(b);
        og.fillText(`${Math.floor(b / 120)}:00`, Math.min(x, w - PLOT.right - 24), PLOT.top - 4);
      }

      /* Events: every mark in the score, with the harmonizer's pull drawn
         as a tick from where the note arrived to where it now sits. */
      for (const ev of score) {
        const pos = eventXY(ev, boxes, w);
        if (!pos) continue;
        const track = ev.data?.track as string;
        const innerVoice = ev.voice.slice(ev.voice.indexOf(':') + 1);
        const color =
          track === 'drone'
            ? pal.accent
            : track === 'sparks'
              ? pal.accent2
              : pal[STAR_COLORS[innerVoice] ?? 'accent2'];
        const cents = (ev.data?.cents as number) ?? 0;
        if (amount > 0 && Math.abs(cents) >= 1) {
          const semisOff = (cents * amount) / 100;
          const pxPerSemi = (pos.box.h - 8) / (pos.box.hi - pos.box.lo);
          og.strokeStyle = pal.inkDim;
          og.beginPath();
          og.moveTo(pos.x, pos.y + semisOff * pxPerSemi);
          og.lineTo(pos.x, pos.y);
          og.stroke();
        }
        og.globalAlpha = 0.4 + ev.gain * 0.6;
        og.fillStyle = color;
        if (track === 'drone') {
          const wDur = (ev.dur / TOTAL_BEATS) * plotW;
          og.fillRect(pos.x, pos.y - 1, Math.max(2, wDur - 1), 3);
        } else {
          og.fillRect(pos.x - 1, pos.y - 1, 3, 3);
        }
        og.globalAlpha = 1;
      }
    });
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(stat, 0, 0);
    g.restore();

    /* Header. */
    g.font = '11px monospace';
    g.fillStyle = pal.ink;
    g.fillText('CONCORDANCE No. 1 — three documents, one key', 8, 15);
    g.fillStyle = amount > 0 ? pal.ok : pal.warn;
    const shiftNote = userShift !== 0 ? ` · LOOM ${userShift > 0 ? '+' : ''}${userShift} ST` : '';
    g.fillText(
      amount > 0
        ? `CONSENSUS ${label.toUpperCase()} · FIT ${(key.fit * 100).toFixed(0)}% · HARMONIZE ${Math.round(amount * 100)}%${shiftNote}`
        : `HARMONIZER BYPASSED — SHIFTS ARRIVE UNCORRECTED${shiftNote}`,
      8,
      30,
    );

    /* Flashes on recently performed events. */
    for (const { event, at } of recent) {
      const age = nowMs - at;
      if (age < 0 || age > 400) continue;
      const pos = eventXY(event, boxes, w);
      if (!pos) continue;
      const t = age / 400;
      g.globalAlpha = 1 - t;
      g.strokeStyle = pal.ink;
      g.beginPath();
      g.arc(pos.x, pos.y, 2 + t * 8, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }

    /* Playhead. */
    const liveBeat = getBeat?.() ?? beat;
    const x = Math.round(xAt(Math.min(TOTAL_BEATS, Math.max(0, liveBeat)))) + 0.5;
    g.strokeStyle = pal.warn;
    g.beginPath();
    g.moveTo(x, PLOT.top);
    g.lineTo(x, h - PLOT.bottom);
    g.stroke();
  });

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', cursor: 'pointer' }}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        /* The timeline is a transport: every click moves the playhead. A
           click that lands on a mark also asks it why. */
        onSeek(beatAtX(cx, rect.width));
        const boxes = laneBoxes(rect.height);
        let hit: NoteEvent | null = null;
        let best = 8;
        for (const ev of score) {
          const pos = eventXY(ev, boxes, rect.width);
          if (!pos) continue;
          const d = Math.hypot(pos.x - cx, pos.y - cy);
          if (d < best) {
            best = d;
            hit = ev;
          }
        }
        if (hit) onInspect(hit);
      }}
    />
  );
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
  Stage,
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
