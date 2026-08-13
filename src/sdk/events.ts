/*
 * The event model. Everything a lab plays is a NoteEvent produced by a pure
 * pattern function over a beat range. Events carry provenance — the chain of
 * rules that caused them — so the inspector can answer "why did this sound?"
 */

/** One link in the causal chain behind an event. */
export interface Cause {
  /** Short rule name, e.g. "euclid(5,16)". */
  rule: string;
  /** Human reading of what the rule decided. */
  detail: string;
}

export interface NoteEvent {
  /** Deterministic id, unique within a lab render: stable across replays. */
  id: string;
  /** Onset in beats from session start. */
  beat: number;
  /** Duration in beats. */
  dur: number;
  /** Frequency in Hz, post-tuning. */
  freq: number;
  /** Peak gain 0..1 before the voice's own envelope. */
  gain: number;
  /** Logical voice/track this event belongs to. */
  voice: string;
  /** Why this event exists — outermost rule first. */
  provenance: Cause[];
  /** Lab-specific payload for visualization (indices, coordinates…). */
  data?: Record<string, number | string>;
}

/** Half-open musical time window [from, to) in beats. */
export interface BeatRange {
  from: number;
  to: number;
}

/** Events sorted by beat, then voice — the canonical order for tests. */
export function sortEvents(events: NoteEvent[]): NoteEvent[] {
  return events
    .slice()
    .sort((a, b) => a.beat - b.beat || (a.voice < b.voice ? -1 : a.voice > b.voice ? 1 : 0));
}

/** Frequency for a MIDI note number (12-TET, A4=440). */
export function mtof(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Note name for a MIDI number, for readouts. */
export function midiName(midi: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const n = Math.round(midi);
  return `${names[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`;
}
