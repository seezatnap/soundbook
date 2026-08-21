/*
 * Wires the session to the engine: builds the lab's instrument, feeds the
 * scheduler from the lab's pure event function, and exposes transport
 * controls. The audio stack is created lazily on the first play gesture
 * (browsers gate sound behind one), but all state flows through refs so the
 * running scheduler always sees the latest params without rebuilds.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Engine, getEngine, MAX_VOICES } from '@/engine/engine';
import {
  mediaSessionHandlers,
  mediaSessionMetadata,
  mediaSessionPlaybackState,
  mediaSessionPosition,
} from '@/engine/media-session';
import { unlockAudio } from '@/engine/unlock';
import { Transport } from '@/engine/transport';
import { Scheduler } from '@/engine/scheduler';
import { renderWav } from '@/engine/wav';
import type { LabDefinition, Instrument, RecentEvent } from '@/sdk/lab';
import type { ParamValues } from '@/sdk/params';

export type { RecentEvent };

export interface AudioApi {
  playing: boolean;
  play(): void;
  stop(): void;
  step(): void;
  rewind(): void;
  seek(beat: number): void;
  getBeat(): number;
  analyser: AnalyserNode | null;
  recentRef: React.RefObject<RecentEvent[]>;
  diagnostics(): Record<string, string | number>;
  exportWav(cycles: number): Promise<Blob>;
}

/* Instrument swaps (reseed, lab switch) crossfade instead of cutting. A lab
   that declares a `fadeBeats` param (DroneLab's Master tab) sets the window
   in beats; anything else gets this default. */
const DEFAULT_RETIRE_SEC = 2.5;

export function useAudio(
  lab: LabDefinition,
  params: ParamValues,
  seed: number,
  tempo: number,
): AudioApi {
  const [playing, setPlaying] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const engineRef = useRef<Engine | null>(null);
  const transportRef = useRef<Transport | null>(null);
  const schedulerRef = useRef<Scheduler | null>(null);
  /*
   * Two instrument slots, crossfaded on reseed. Chrome pins every
   * AudioNode wrapper (and, transitively, its buffers) while the context
   * runs, so building a fresh instrument per reseed leaks native memory
   * until playback stops. Labs whose instruments implement retune() keep
   * these two forever: the spare adopts the new seed in place and fades
   * in. Labs without retune fall back to build-and-retire.
   */
  const slotsRef = useRef<Array<{ instrument: Instrument | null; mix: GainNode | null; seed: number }>>([
    { instrument: null, mix: null, seed: 0 },
    { instrument: null, mix: null, seed: 0 },
  ]);
  const activeSlotRef = useRef(0);
  const builtLabRef = useRef<string>('');
  const recentRef = useRef<RecentEvent[]>([]);

  const labRef = useRef(lab);
  const paramsRef = useRef(params);
  const seedRef = useRef(seed);
  const tempoRef = useRef(tempo);
  labRef.current = lab;
  paramsRef.current = params;
  seedRef.current = seed;
  tempoRef.current = tempo;

  /* Lock-screen buttons call through refs so the handlers register once. */
  const playRef = useRef<() => void>(() => {});
  const stopRef = useRef<() => void>(() => {});
  const rewindRef = useRef<() => void>(() => {});

  const syncMediaPosition = useCallback((): void => {
    const transport = transportRef.current;
    const piece = labRef.current.pieceBeats;
    if (!transport || !piece) return;
    const bps = transport.tempo / 60;
    const position = (((transport.beat() % piece) + piece) % piece) / bps;
    mediaSessionPosition(piece / bps, position);
  }, []);

  const rebuildInstrument = useCallback((): void => {
    const engine = engineRef.current;
    if (!engine) return;
    const lab = labRef.current;
    const seed = seedRef.current;
    const slots = slotsRef.current;
    const active = slots[activeSlotRef.current];
    const sameLab = builtLabRef.current === lab.id;
    if (sameLab && active.instrument && active.seed === seed) return;

    const fadeBeats = Number(paramsRef.current.fadeBeats);
    const fadeSec =
      Number.isFinite(fadeBeats) && fadeBeats >= 0
        ? fadeBeats / (tempoRef.current / 60)
        : DEFAULT_RETIRE_SEC;
    const now = engine.ctx.currentTime;
    const buildInto = (slot: (typeof slots)[number]): void => {
      const mix = slot.mix ?? engine.ctx.createGain();
      if (!slot.mix) mix.connect(engine.out);
      slot.mix = mix;
      slot.instrument = lab.makeInstrument(
        { ctx: engine.ctx, out: mix, acquireVoice: () => engine.acquireVoice() },
        paramsRef.current,
        seed,
      );
      slot.seed = seed;
    };

    if (sameLab && active.instrument && active.mix) {
      const spareIdx = 1 - activeSlotRef.current;
      const spare = slots[spareIdx];
      if (active.instrument.retune) {
        /* Reseed in place: the spare adopts the new seed on its existing
           nodes (first reseed ever builds it — the population is then
           fixed), syncs params, and the two mixes crossfade. Nothing is
           discarded, so nothing accumulates. */
        if (spare.instrument) {
          spare.instrument.retune!(seed);
          spare.instrument.update(paramsRef.current);
          spare.seed = seed;
        } else {
          buildInto(spare);
        }
        if (fadeSec > 0) {
          active.mix.gain.setValueAtTime(active.mix.gain.value, now);
          active.mix.gain.setTargetAtTime(0, now, fadeSec / 3);
          spare.mix!.gain.setValueAtTime(spare.mix!.gain.value, now);
          spare.mix!.gain.setTargetAtTime(1, now, fadeSec / 3);
        } else {
          active.mix.gain.setValueAtTime(0, now);
          spare.mix!.gain.setValueAtTime(1, now);
        }
        activeSlotRef.current = spareIdx;
        return;
      }
      /* Fallback for instruments that cannot retune: retire under a fade. */
      const old = active.instrument;
      const oldMix = active.mix;
      if (fadeSec > 0) {
        oldMix.gain.setValueAtTime(oldMix.gain.value, now);
        oldMix.gain.setTargetAtTime(0, now, fadeSec / 3);
      } else {
        oldMix.gain.setValueAtTime(0, now);
      }
      setTimeout(() => {
        old.dispose();
        oldMix.disconnect();
      }, fadeSec * 1000 + 1500);
      active.instrument = null;
      active.mix = null;
      buildInto(active);
      if (fadeSec > 0) {
        active.mix!.gain.value = 0;
        active.mix!.gain.setTargetAtTime(1, now, fadeSec / 3);
      }
      return;
    }

    /* Lab switch or first build: hard reset both slots. */
    for (const slot of slots) {
      slot.instrument?.dispose();
      slot.mix?.disconnect();
      slot.instrument = null;
      slot.mix = null;
    }
    activeSlotRef.current = 0;
    buildInto(slots[0]);
    slots[0].mix!.gain.value = 1;
    builtLabRef.current = lab.id;
  }, []);

  const ensureAudio = useCallback((): void => {
    if (!engineRef.current) {
      const engine = getEngine();
      engineRef.current = engine;
      const now = (): number => engine.ctx.currentTime;
      const transport = new Transport(now);
      transport.setTempo(tempoRef.current);
      transportRef.current = transport;
      const scheduler = new Scheduler(transport, now);
      scheduler.setSource((range) =>
        labRef.current.events({ params: paramsRef.current, seed: seedRef.current, range }),
      );
      scheduler.setTrigger((event, when) => {
        const bps = transport.tempo / 60;
        const slot = slotsRef.current[activeSlotRef.current];
        slot.instrument?.trigger(event, when, event.dur / bps, paramsRef.current);
      });
      scheduler.onScheduled = (batch) => {
        const ctxNow = engine.ctx.currentTime;
        const perfNow = performance.now();
        const recent = recentRef.current;
        for (const item of batch) {
          recent.push({ event: item.event, at: perfNow + (item.when - ctxNow) * 1000 });
        }
        /* Trim to the last 12 seconds. */
        const cutoff = perfNow - 12000;
        while (recent.length > 0 && recent[0].at < cutoff) recent.shift();
      };
      scheduler.start();
      schedulerRef.current = scheduler;
      setAnalyser(engine.analyser);
      mediaSessionHandlers({
        play: () => playRef.current(),
        pause: () => stopRef.current(),
        rewind: () => rewindRef.current(),
      });
    }
    rebuildInstrument();
  }, [rebuildInstrument]);

  /* Lab or seed changed: swap the instrument (if audio is up). */
  useEffect(() => {
    if (engineRef.current) rebuildInstrument();
  }, [lab, seed, rebuildInstrument]);

  /* Params changed: live-update the active instrument (the spare syncs
     right before it fades in on the next reseed). */
  useEffect(() => {
    slotsRef.current[activeSlotRef.current].instrument?.update(params);
  }, [params]);

  /* Tempo changed: re-anchor transport, resync scheduler frontier. */
  useEffect(() => {
    const transport = transportRef.current;
    if (!transport) return;
    transport.setTempo(tempo);
    schedulerRef.current?.resync();
    syncMediaPosition();
  }, [tempo, syncMediaPosition]);

  /* When the lab changes, rewind so cycles start clean. */
  useEffect(() => {
    transportRef.current?.seek(0);
    schedulerRef.current?.resync();
    recentRef.current.length = 0;
    mediaSessionMetadata(lab.title);
  }, [lab]);

  useEffect(
    () => () => {
      schedulerRef.current?.stop();
      for (const slot of slotsRef.current) {
        slot.instrument?.dispose();
        slot.instrument = null;
        slot.mix?.disconnect();
        slot.mix = null;
      }
      builtLabRef.current = '';
    },
    [],
  );

  const play = useCallback((): void => {
    ensureAudio();
    /* Mobile unlock must run synchronously inside this gesture: it claims
       iOS's playback channel (silent switch immunity) before resuming. */
    if (engineRef.current) unlockAudio(engineRef.current.ctx as AudioContext);
    transportRef.current?.play();
    schedulerRef.current?.resync();
    setPlaying(true);
    mediaSessionMetadata(labRef.current.title);
    mediaSessionPlaybackState(true);
    syncMediaPosition();
  }, [ensureAudio, syncMediaPosition]);

  const stop = useCallback((): void => {
    transportRef.current?.stop();
    setPlaying(false);
    mediaSessionPlaybackState(false);
    syncMediaPosition();
  }, [syncMediaPosition]);

  const step = useCallback((): void => {
    ensureAudio();
    if (engineRef.current) unlockAudio(engineRef.current.ctx as AudioContext);
    if (transportRef.current?.state === 'playing') return;
    schedulerRef.current?.step();
  }, [ensureAudio]);

  const seek = useCallback(
    (beat: number): void => {
      /* Stage clicks may seek before the first play; build the stack so the
         playhead actually moves (still silent until play resumes audio). */
      ensureAudio();
      transportRef.current?.seek(beat);
      schedulerRef.current?.resync();
      syncMediaPosition();
    },
    [ensureAudio, syncMediaPosition],
  );

  const rewind = useCallback((): void => {
    seek(0);
    recentRef.current.length = 0;
  }, [seek]);

  const getBeat = useCallback((): number => transportRef.current?.beat() ?? 0, []);

  playRef.current = play;
  stopRef.current = stop;
  rewindRef.current = rewind;

  const diagnostics = useCallback((): Record<string, string | number> => {
    const engine = engineRef.current;
    if (!engine) return { engine: 'not started (press play)' };
    return {
      context: engine.ctx.state,
      'sample rate': `${engine.ctx.sampleRate} Hz`,
      'base latency': `${((engine.ctx.baseLatency ?? 0) * 1000).toFixed(1)} ms`,
      voices: `${engine.activeVoices} / ${MAX_VOICES}`,
      'events performed': schedulerRef.current?.performed.length ?? 0,
    };
  }, []);

  const exportWav = useCallback(
    (cycles: number): Promise<Blob> =>
      renderWav(labRef.current, paramsRef.current, seedRef.current, tempoRef.current, cycles),
    [],
  );

  return {
    playing,
    play,
    stop,
    step,
    rewind,
    seek,
    getBeat,
    analyser,
    recentRef,
    diagnostics,
    exportWav,
  };
}
