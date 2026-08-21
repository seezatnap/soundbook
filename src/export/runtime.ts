/*
 * The standalone player behind Code export. A code export is one lab's
 * index.ts plus this file, bundled into a single audio-only script with no
 * React, no design system and no drawing code. `mountLab(lab, state, root)`
 * renders a transport (PLAY / PAUSE / STOP and a position readout) into
 * `root` and performs the document with the very same engine, transport,
 * scheduler and instrument factory the workshop uses — so an exported page
 * plays the same events, in the same air, as the session it was taken
 * from.
 *
 * Every shell behavior that changes what a listener hears must be mirrored
 * here, or the export stops being a faithful reproduction. Today that is:
 * the lookahead scheduler, the reseed crossfade between two instrument
 * slots (fadeBeats), and DroneLab's AutoRandomize / AutoRandomSeed beat
 * triggers. Keep this file dependency-light: anything imported here ships
 * in every export.
 */

import { getEngine, type Engine } from '@/engine/engine';
import { Scheduler } from '@/engine/scheduler';
import { Transport } from '@/engine/transport';
import { unlockAudio } from '@/engine/unlock';
import type { Instrument, LabDefinition } from '@/sdk/lab';
import { randomizeParams, sanitizeAll, type ParamValue } from '@/sdk/params';
import { freshSeed, makeRng } from '@/sdk/prng';

/** The document a code export carries: the session, minus the shell. */
export interface ExportState {
  seed: number;
  tempo: number;
  /** The full param record (defaults included — an export is explicit). */
  params: Record<string, ParamValue>;
  /** Keys AutoRandomize must leave alone; absent when none are locked. */
  locked?: string[];
}

export interface Player {
  readonly playing: boolean;
  /** Start, or resume from the paused position. */
  play(): void;
  /** Hold the transport where it is. */
  pause(): void;
  /** Hold and rewind to beat zero. */
  stop(): void;
  seek(beat: number): void;
  getBeat(): number;
  /** Tear down audio, the readout and listeners. */
  dispose(): void;
}

/* Reseed crossfade window when the lab declares no fadeBeats (seconds). */
const DEFAULT_RETIRE_SEC = 2.5;

interface Slot {
  instrument: Instrument | null;
  mix: GainNode | null;
  seed: number;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  return node;
}

function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function mountLab(lab: LabDefinition, state: ExportState, root: HTMLElement): Player {
  /* ------------------------------------------------------------ document */
  let params = sanitizeAll(lab.params, state.params);
  let seed = Number(state.seed) >>> 0;
  const tempo = Math.min(300, Math.max(20, Number(state.tempo) || 120));
  const locked = new Set(state.locked ?? []);
  let randomized = 0;

  /* ----------------------------------------------------------------- DOM */
  const playButton = el('button', 'PLAY');
  const pauseButton = el('button', 'PAUSE');
  const stopButton = el('button', 'STOP');
  const readout = el('span');
  root.append(playButton, pauseButton, stopButton, readout);

  /* --------------------------------------------------------------- audio */
  let engine: Engine | null = null;
  let transport: Transport | null = null;
  let scheduler: Scheduler | null = null;
  const slots: Slot[] = [
    { instrument: null, mix: null, seed: 0 },
    { instrument: null, mix: null, seed: 0 },
  ];
  let active = 0;
  let playing = false;

  const fadeSec = (): number => {
    const fadeBeats = Number(params.fadeBeats);
    return Number.isFinite(fadeBeats) && fadeBeats >= 0
      ? fadeBeats / (tempo / 60)
      : DEFAULT_RETIRE_SEC;
  };

  const buildInto = (slot: Slot): void => {
    const ctx = engine!.ctx;
    const mix = slot.mix ?? ctx.createGain();
    if (!slot.mix) mix.connect(engine!.out);
    slot.mix = mix;
    slot.instrument = lab.makeInstrument(
      { ctx, out: mix, acquireVoice: () => engine!.acquireVoice() },
      params,
      seed,
    );
    slot.seed = seed;
  };

  /*
   * Same discipline as the workshop: two instrument slots, crossfaded on
   * reseed, so a retuning instrument keeps its node population constant
   * and one that cannot retune retires under a fade instead of cutting.
   */
  const rebuildInstrument = (): void => {
    if (!engine) return;
    const current = slots[active];
    if (current.instrument && current.seed === seed) return;
    const now = engine.ctx.currentTime;
    const fade = fadeSec();
    const crossfade = (from: GainNode, to: GainNode): void => {
      if (fade > 0) {
        from.gain.setValueAtTime(from.gain.value, now);
        from.gain.setTargetAtTime(0, now, fade / 3);
        to.gain.setValueAtTime(to.gain.value, now);
        to.gain.setTargetAtTime(1, now, fade / 3);
      } else {
        from.gain.setValueAtTime(0, now);
        to.gain.setValueAtTime(1, now);
      }
    };
    if (current.instrument && current.mix) {
      if (current.instrument.retune) {
        const spareIdx = 1 - active;
        const spare = slots[spareIdx];
        if (spare.instrument) {
          spare.instrument.retune!(seed);
          spare.instrument.update(params);
          spare.seed = seed;
        } else {
          buildInto(spare);
        }
        crossfade(current.mix, spare.mix!);
        active = spareIdx;
        return;
      }
      const old = current.instrument;
      const oldMix = current.mix;
      oldMix.gain.setValueAtTime(oldMix.gain.value, now);
      if (fade > 0) oldMix.gain.setTargetAtTime(0, now, fade / 3);
      else oldMix.gain.setValueAtTime(0, now);
      setTimeout(() => {
        old.dispose();
        oldMix.disconnect();
      }, fade * 1000 + 1500);
      current.instrument = null;
      current.mix = null;
      buildInto(current);
      if (fade > 0) {
        current.mix!.gain.value = 0;
        current.mix!.gain.setTargetAtTime(1, now, fade / 3);
      }
      return;
    }
    buildInto(current);
    current.mix!.gain.value = 1;
  };

  const ensureAudio = (): void => {
    if (!engine) {
      engine = getEngine();
      const now = (): number => engine!.ctx.currentTime;
      transport = new Transport(now);
      transport.setTempo(tempo);
      scheduler = new Scheduler(transport, now);
      scheduler.setSource((range) => lab.events({ params, seed, range }));
      scheduler.setTrigger((event, when) => {
        const bps = transport!.tempo / 60;
        slots[active].instrument?.trigger(event, when, event.dur / bps, params);
      });
      scheduler.start();
    }
    rebuildInstrument();
  };

  const getBeat = (): number => transport?.beat() ?? 0;

  /* ----------------------------------------------------- beat triggers
   * AutoRandomize / AutoRandomSeed (DroneLab's Controls tab): press the
   * randomize or reseed button on a beat grid while playing. Epochs only
   * fire forward, so seeks and restarts resync silently. */
  const epochs = { random: 0, reseed: 0 };
  let triggerTimer: ReturnType<typeof setInterval> | null = null;

  const randomize = (): void => {
    /* Non-deterministic by design: the document asked for novelty. The
       result immediately becomes the explicit current state. */
    params = randomizeParams(lab.params, params, locked, makeRng(freshSeed()));
    randomized += 1;
    slots[active].instrument?.update(params);
  };

  const reseed = (): void => {
    seed = freshSeed();
    rebuildInstrument();
  };

  const epochOf = (key: string): number =>
    Math.floor(getBeat() / Math.max(1, Number(params[key]) || 1));

  const startTriggers = (): void => {
    stopTriggers();
    epochs.random = epochOf('autoRandomBeats');
    epochs.reseed = epochOf('autoReseedBeats');
    triggerTimer = setInterval(() => {
      if (!playing) return;
      const random = epochOf('autoRandomBeats');
      if (params.autoRandom === true && random > epochs.random) randomize();
      epochs.random = random;
      const next = epochOf('autoReseedBeats');
      if (params.autoReseed === true && next > epochs.reseed) reseed();
      epochs.reseed = next;
    }, 100);
  };

  function stopTriggers(): void {
    if (triggerTimer) clearInterval(triggerTimer);
    triggerTimer = null;
  }

  /* ------------------------------------------------------------- readout */
  const piece = lab.pieceBeats;
  const bps = tempo / 60;
  const describe = (): void => {
    const beat = getBeat();
    const position = piece
      ? `${clock(beat / bps)} / ${clock(piece / bps)}`
      : `bar ${Math.floor(beat / 4) + 1}.${Math.floor(beat % 4) + 1}`;
    const notes = [
      playing ? 'PLAYING' : 'HOLD',
      position,
      `seed ${seed}`,
      randomized > 0 ? `randomized ×${randomized}` : '',
    ];
    readout.textContent = notes.filter(Boolean).join(' · ');
  };
  const readoutTimer = setInterval(describe, 250);
  describe();

  /* ----------------------------------------------------------- transport */
  const play = (): void => {
    if (playing) return;
    ensureAudio();
    /* Mobile unlock must run synchronously inside the gesture. */
    unlockAudio(engine!.ctx);
    transport!.play();
    scheduler!.resync();
    playing = true;
    startTriggers();
    describe();
  };

  const pause = (): void => {
    transport?.stop();
    playing = false;
    stopTriggers();
    describe();
  };

  const seek = (beat: number): void => {
    ensureAudio();
    transport!.seek(beat);
    scheduler!.resync();
    describe();
  };

  const stop = (): void => {
    pause();
    if (transport) seek(0);
  };

  playButton.addEventListener('click', play);
  pauseButton.addEventListener('click', pause);
  stopButton.addEventListener('click', stop);
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === ' ' && e.target === document.body) {
      e.preventDefault();
      if (playing) pause();
      else play();
    }
  };
  window.addEventListener('keydown', onKey);

  return {
    get playing() {
      return playing;
    },
    play,
    pause,
    stop,
    seek,
    getBeat,
    dispose() {
      pause();
      clearInterval(readoutTimer);
      scheduler?.stop();
      window.removeEventListener('keydown', onKey);
      for (const slot of slots) {
        slot.instrument?.dispose();
        slot.mix?.disconnect();
        slot.instrument = null;
        slot.mix = null;
      }
    },
  };
}
