/*
 * Wires the session to the engine: builds the lab's instrument, feeds the
 * scheduler from the lab's pure event function, and exposes transport
 * controls. The audio stack is created lazily on the first play gesture
 * (browsers gate sound behind one), but all state flows through refs so the
 * running scheduler always sees the latest params without rebuilds.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Engine, getEngine, MAX_VOICES } from '@/engine/engine';
import { unlockAudio } from '@/engine/unlock';
import { Transport } from '@/engine/transport';
import { Scheduler } from '@/engine/scheduler';
import { renderWav } from '@/engine/wav';
import type { LabDefinition, Instrument } from '@/sdk/lab';
import type { NoteEvent } from '@/sdk/events';
import type { ParamValues } from '@/sdk/params';

export interface RecentEvent {
  event: NoteEvent;
  /** performance.now()-comparable ms timestamp of the event's onset. */
  at: number;
}

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
  const instrumentRef = useRef<Instrument | null>(null);
  const mixRef = useRef<GainNode | null>(null);
  const builtForRef = useRef<string>('');
  const recentRef = useRef<RecentEvent[]>([]);

  const labRef = useRef(lab);
  const paramsRef = useRef(params);
  const seedRef = useRef(seed);
  const tempoRef = useRef(tempo);
  labRef.current = lab;
  paramsRef.current = params;
  seedRef.current = seed;
  tempoRef.current = tempo;

  const rebuildInstrument = useCallback((): void => {
    const engine = engineRef.current;
    if (!engine) return;
    const key = `${labRef.current.id}:${seedRef.current}`;
    if (builtForRef.current === key && instrumentRef.current) return;
    /* Retire, don't cut. Each instrument plays into its own mix node, so a
       reseed lets the old iteration ring out under a fade while the new
       one fades in on top — a crossfade instead of a hard swap. */
    const fadeBeats = Number(paramsRef.current.fadeBeats);
    const fadeSec =
      Number.isFinite(fadeBeats) && fadeBeats >= 0
        ? fadeBeats / (tempoRef.current / 60)
        : DEFAULT_RETIRE_SEC;
    const now = engine.ctx.currentTime;
    const old = instrumentRef.current;
    const oldMix = mixRef.current;
    if (old && oldMix) {
      if (fadeSec > 0) {
        oldMix.gain.setValueAtTime(oldMix.gain.value, now);
        oldMix.gain.setTargetAtTime(0, now, fadeSec / 3);
      } else {
        oldMix.gain.setValueAtTime(0, now);
      }
      /* Dispose after the fade plus a margin for reverb tails. */
      setTimeout(() => {
        old.dispose();
        oldMix.disconnect();
      }, fadeSec * 1000 + 1500);
    } else {
      old?.dispose();
      oldMix?.disconnect();
    }
    const mix = engine.ctx.createGain();
    if (old && fadeSec > 0) {
      mix.gain.value = 0;
      mix.gain.setTargetAtTime(1, now, fadeSec / 3);
    }
    mix.connect(engine.out);
    mixRef.current = mix;
    instrumentRef.current = labRef.current.makeInstrument(
      { ctx: engine.ctx, out: mix, acquireVoice: () => engine.acquireVoice() },
      paramsRef.current,
      seedRef.current,
    );
    builtForRef.current = key;
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
        instrumentRef.current?.trigger(event, when, event.dur / bps, paramsRef.current);
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
    }
    rebuildInstrument();
  }, [rebuildInstrument]);

  /* Lab or seed changed: swap the instrument (if audio is up). */
  useEffect(() => {
    if (engineRef.current) rebuildInstrument();
  }, [lab, seed, rebuildInstrument]);

  /* Params changed: live-update the instrument. */
  useEffect(() => {
    instrumentRef.current?.update(params);
  }, [params]);

  /* Tempo changed: re-anchor transport, resync scheduler frontier. */
  useEffect(() => {
    const transport = transportRef.current;
    if (!transport) return;
    transport.setTempo(tempo);
    schedulerRef.current?.resync();
  }, [tempo]);

  /* When the lab changes, rewind so cycles start clean. */
  useEffect(() => {
    transportRef.current?.seek(0);
    schedulerRef.current?.resync();
    recentRef.current.length = 0;
  }, [lab]);

  useEffect(
    () => () => {
      schedulerRef.current?.stop();
      instrumentRef.current?.dispose();
      instrumentRef.current = null;
      mixRef.current?.disconnect();
      mixRef.current = null;
      builtForRef.current = '';
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
  }, [ensureAudio]);

  const stop = useCallback((): void => {
    transportRef.current?.stop();
    setPlaying(false);
  }, []);

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
    },
    [ensureAudio],
  );

  const rewind = useCallback((): void => {
    seek(0);
    recentRef.current.length = 0;
  }, [seek]);

  const getBeat = useCallback((): number => transportRef.current?.beat() ?? 0, []);

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
