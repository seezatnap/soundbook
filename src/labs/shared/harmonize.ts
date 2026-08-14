/*
 * The autoharmonizer: pure arithmetic that lets several documents share one
 * key without any of them being rewritten. Given every note the sources
 * intend to play (frequency + how much it weighs on the ear), it audits all
 * twelve roots of the seven-note modes and elects the key that requires the
 * least total retuning — the consensus. Individual events are then moved the
 * minimum distance in cents onto that key, scaled by an amount knob: at 0
 * every source keeps its own tuning, at 1 the treaty is fully signed.
 * Everything here is deterministic and chunk-independent: an event's
 * correction depends only on its own frequency and the (fixed) consensus.
 */

import { SCALES } from '@/labs/shared/music';

export interface WeightedNote {
  freq: number;
  /** Perceptual weight, typically gain × duration. */
  weight: number;
}

export interface ConsensusKey {
  /** Pitch class 0–11 of the elected root (0 = C). */
  rootPc: number;
  scaleName: string;
  /** Scale intervals in semitones from the root. */
  intervals: number[];
  /** 1 − (mean weighted cents-off / 600): 1 is a perfect fit. */
  fit: number;
}

export interface Retune {
  /** Frequency after applying `amount` of the correction. */
  freq: number;
  /** Full correction to the nearest consensus tone, in cents (signed). */
  cents: number;
  /** The consensus tone the event is drawn toward (MIDI, may be unreached). */
  targetMidi: number;
}

const PC_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/*
 * Only full modes stand for election: a scale with fewer tones can never
 * cost less than a superset of itself, so including pentatonics would be
 * theater, and including the chromatic would win every vote with cost zero.
 */
const CANDIDATE_SCALES = ['major', 'minor', 'dorian', 'lydian', 'wholetone'] as const;

/** Fractional MIDI for a frequency (12-TET, A4 = 440). */
export function freqToMidi(freq: number): number {
  return 69 + 12 * Math.log2(freq / 440);
}

export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Circular distance in cents from a fractional pitch class to an exact one. */
function pcDistanceCents(fromPc: number, toPc: number): number {
  const d = Math.abs(((fromPc - toPc) % 12 + 12) % 12);
  return Math.min(d, 12 - d) * 100;
}

/**
 * Elect the consensus key for a body of weighted notes. Deterministic:
 * lowest total weighted cents-off wins; exact ties (modes sharing one pitch
 * set) go to the candidate with the most weight sitting on its root.
 */
export function consensusKey(notes: readonly WeightedNote[]): ConsensusKey {
  let totalWeight = 0;
  const pcs: Array<{ pc: number; weight: number }> = [];
  for (const note of notes) {
    if (!(note.freq > 0) || !(note.weight > 0)) continue;
    const pc = ((freqToMidi(note.freq) % 12) + 12) % 12;
    pcs.push({ pc, weight: note.weight });
    totalWeight += note.weight;
  }

  let best: ConsensusKey = { rootPc: 0, scaleName: 'major', intervals: SCALES.major, fit: 0 };
  let bestCost = Infinity;
  let bestRootWeight = -1;
  for (const scaleName of CANDIDATE_SCALES) {
    const intervals = SCALES[scaleName];
    for (let rootPc = 0; rootPc < 12; rootPc++) {
      let cost = 0;
      let rootWeight = 0;
      for (const { pc, weight } of pcs) {
        let nearest = Infinity;
        for (const step of intervals) {
          const d = pcDistanceCents(pc, (rootPc + step) % 12);
          if (d < nearest) nearest = d;
        }
        cost += nearest * weight;
        if (pcDistanceCents(pc, rootPc) <= 50) rootWeight += weight;
      }
      const wins =
        cost < bestCost - 1e-6 ||
        (Math.abs(cost - bestCost) <= 1e-6 && rootWeight > bestRootWeight + 1e-6);
      if (wins) {
        bestCost = cost;
        bestRootWeight = rootWeight;
        best = {
          rootPc,
          scaleName,
          intervals,
          fit: totalWeight > 0 ? 1 - bestCost / totalWeight / 600 : 1,
        };
      }
    }
  }
  return best;
}

/**
 * Move a frequency toward the nearest tone of the consensus key. `amount`
 * scales the correction in cents (0 = untouched, 1 = fully on the key);
 * corrections under half a cent pass through bit-identical.
 */
export function retuneFreq(
  freq: number,
  rootPc: number,
  intervals: readonly number[],
  amount: number,
): Retune {
  const exact = freqToMidi(freq);
  let targetMidi = Math.round(exact);
  let nearest = Infinity;
  const base = Math.round(exact);
  for (let m = base - 12; m <= base + 12; m++) {
    const pc = ((m % 12) + 12) % 12;
    if (!intervals.includes(((pc - rootPc) % 12 + 12) % 12)) continue;
    const d = Math.abs(m - exact);
    if (d < nearest - 1e-9) {
      nearest = d;
      targetMidi = m;
    }
  }
  const cents = (targetMidi - exact) * 100;
  if (amount <= 0 || Math.abs(cents) < 0.5) return { freq, cents, targetMidi };
  /* At full strength land bit-exactly on the tone, so every event drawn to
     the same target shares one frequency. */
  if (amount >= 1) return { freq: midiToFreq(targetMidi), cents, targetMidi };
  return { freq: freq * Math.pow(2, (cents * amount) / 1200), cents, targetMidi };
}

/** Human name for a key, e.g. "E dorian". */
export function keyLabel(key: Pick<ConsensusKey, 'rootPc' | 'scaleName'>): string {
  return `${PC_NAMES[key.rootPc]} ${key.scaleName}`;
}
