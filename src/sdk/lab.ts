/*
 * The lab contract. A lab is one musical question, explored through a
 * declarative schema: params, a pure pattern function, an instrument
 * factory, a stage renderer, and authored stories. The shell owns everything
 * else — controls, URL, transport, inspectors — generated from this shape.
 *
 * Everything declared here is React-free and DOM-free by design: the Code
 * export bundles a lab's `index.ts` together with `src/export/runtime.ts`
 * into one standalone, audio-only script, so a lab definition may depend on
 * the SDK, the engine facade, the shared lab utilities and the Web Audio API
 * — nothing else. Stages are separate (`stage.ts`, see StagedLab).
 */

import type { BeatRange, NoteEvent } from '@/sdk/events';
import type { ParamSpec, ParamValues } from '@/sdk/params';

/*
 * Instruments are built against this facade, never a raw AudioContext, so
 * the same factory drives the live engine and offline WAV rendering, and
 * voice bounds are enforced in one place.
 */
export interface EngineFacade {
  readonly ctx: BaseAudioContext;
  /** Where the instrument must connect its output (pre safety chain). */
  readonly out: AudioNode;
  /**
   * Claim a voice slot. Returns a release callback, or null when the cap is
   * reached — in which case the instrument must skip the note, not steal.
   */
  acquireVoice(): (() => void) | null;
}

export interface Instrument {
  /**
   * Schedule one event at an exact AudioContext time. `durSec` is the
   * event's duration converted to seconds at the current tempo — events
   * live in beats and instruments in seconds, and only the caller knows
   * the tempo.
   */
  trigger(event: NoteEvent, when: number, durSec: number, params: ParamValues): void;
  /** Live param update for continuous controls (called on every change). */
  update(params: ParamValues): void;
  /**
   * Adopt a new session seed in place: rebuild seeded IRs and figures on
   * the EXISTING nodes. Chrome pins AudioNode wrappers (and their buffers)
   * while a context is running, so the shell never discards instruments of
   * labs that implement this — it keeps two and crossfades between them on
   * reseed, holding the node population constant. An instrument whose
   * graph ignores the seed implements this as a no-op.
   */
  retune?(seed: number): void;
  dispose(): void;
}

/** Everything a pattern function may depend on. Nothing else is allowed. */
export interface PatternContext {
  params: ParamValues;
  seed: number;
  range: BeatRange;
}

export interface Story {
  name: string;
  /** What this preset demonstrates, one line. */
  note: string;
  seed: number;
  params: Partial<ParamValues>;
}

/** The chrome's drawing tokens, read from CSS custom properties at mount. */
export interface StagePalette {
  ink: string;
  inkDim: string;
  face: string;
  faceSunken: string;
  accent: string;
  accent2: string;
  ok: string;
  warn: string;
  danger: string;
  edgeLight: string;
  edgeDark: string;
}

export interface RecentEvent {
  event: NoteEvent;
  /** performance.now()-comparable ms timestamp of the event's onset. */
  at: number;
}

/** One animation frame's view of the session, handed to the stage renderer. */
export interface StageFrame {
  params: ParamValues;
  seed: number;
  /** Live transport position in beats — smooth, read fresh every frame. */
  beat: number;
  playing: boolean;
  /** Events of the cycle containing `beat`, for drawing. */
  events: NoteEvent[];
  /** Beats recently performed, newest last, for flash/decay effects. */
  recent: RecentEvent[];
  /** Live analyser (time-domain waveform), or null before audio starts. */
  analyser: AnalyserNode | null;
  /** Canvas box in CSS pixels; the 2D context is already DPR-scaled. */
  width: number;
  height: number;
  /** performance.now() at the frame, comparable to `recent[i].at`. */
  nowMs: number;
}

/** What a click on the stage asks the host to do. */
export interface StageHit {
  /** Select this event for the provenance inspector. */
  inspect?: NoteEvent;
  /** Move the transport playhead here (timeline stages). */
  seek?: number;
}

/**
 * A stage is a pure canvas renderer. `draw` paints one frame from a
 * StageFrame and a palette; `click` maps a pointer position (CSS px, canvas
 * relative) to what the stage wants done. No React, no DOM beyond the 2D
 * context — the shell's StageHost is the only thing that turns props into
 * frames, and labs never depend on the shell.
 */
export interface StageRenderer {
  draw(g: CanvasRenderingContext2D, frame: StageFrame, palette: StagePalette): void;
  click?(x: number, y: number, frame: StageFrame): StageHit | null;
}

export type LabFamily =
  | 'dronelab'
  | 'composition'
  | 'instrumentation'
  | 'pattern'
  | 'space'
  | 'quixotic';

/**
 * One tab of a grouped parameter panel. A console lab that mixes several
 * embedded documents can exceed the flat 5–8 param budget by partitioning
 * its params into groups of 5–8 each; the shell renders one tab per group.
 */
export interface ParamGroup {
  id: string;
  label: string;
  /** Param keys in this tab, in presentation order. */
  keys: string[];
}

/** What an A/B morph position resolves to. */
export interface MorphResult {
  params: ParamValues;
  /**
   * Keys whose effective value is a true continuous blend of A and B rather
   * than a value either slot holds — the UI shows these as ‹blended› instead
   * of pretending one of the endpoints is in effect.
   */
  blended: string[];
}

export interface LabDefinition {
  id: string;
  version: number;
  title: string;
  family: LabFamily;
  /** The musical question the lab exists to explore. */
  question: string;
  params: ParamSpec[];
  /**
   * Optional tabbed grouping for the param panel. When present, every param
   * key must appear in exactly one group and each group holds 5–8 params;
   * absent, the flat 5–8 param rule applies.
   */
  paramGroups?: ParamGroup[];
  /** Beats per visible/looping cycle, given params — drives stage + export. */
  cycleBeats(params: ParamValues): number;
  /**
   * Total length of a through-composed piece in beats. Labs loop forever and
   * omit this; a composition sets it so WAV export renders the whole piece.
   * A one-shot composition's events function returns nothing past this beat;
   * a looping console lab may keep wrapping past it, in which case the
   * export renders exactly one pass.
   */
  pieceBeats?: number;
  /** Pure, deterministic events for a beat range. */
  events(ctx: PatternContext): NoteEvent[];
  /**
   * Optional A/B morph override. The default interpolates numbers and
   * switches discrete params at the midpoint; a lab that can genuinely
   * blend a discrete dimension (e.g. crossfading waveforms) supplies its
   * own resolution and reports which keys are blended.
   */
  morph?(a: ParamValues, b: ParamValues, t: number): MorphResult;
  makeInstrument(engine: EngineFacade, params: ParamValues, seed: number): Instrument;
  stories: Story[];
  /** Longer-form notes rendered in the Docs drawer tab (plain text/markdown-lite). */
  docs: string;
}

/** Identity helper — gives labs full type checking at the definition site. */
export function defineLab(lab: LabDefinition): LabDefinition {
  return lab;
}

/**
 * A lab with its workshop stage attached — what the registry hands the
 * shell. The stage lives in `src/labs/<id>/stage.ts`, outside the
 * definition, so a code export (which bundles `index.ts` only) carries
 * the music and not a line of drawing code.
 */
export interface StagedLab extends LabDefinition {
  /**
   * A fresh stage renderer per mounted canvas. Per-canvas caches (layer
   * bitmaps, throttled scores) live in the returned closure, so the factory
   * is called once per mount, never per frame.
   */
  makeStage(): StageRenderer;
}

export function withStage(lab: LabDefinition, makeStage: () => StageRenderer): StagedLab {
  return { ...lab, makeStage };
}
