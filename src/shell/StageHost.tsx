/*
 * Hosts the lab's Stage and owns the animation-rate state: the transport
 * beat ticks here at rAF rate so only the stage subtree re-renders per
 * frame, never the whole shell. The visible cycle's events are recomputed
 * only when the cycle index (or the document) changes.
 */

import { useEffect, useRef, useState, type JSX } from 'react';
import type { LabDefinition } from '@/sdk/lab';
import type { NoteEvent } from '@/sdk/events';
import type { ParamValues } from '@/sdk/params';
import { useThrottledMemo } from '@/labs/shared/stage';
import type { RecentEvent } from '@/shell/useAudio';

interface StageHostProps {
  lab: LabDefinition;
  params: ParamValues;
  seed: number;
  playing: boolean;
  getBeat(): number;
  analyser: AnalyserNode | null;
  recentRef: React.RefObject<RecentEvent[]>;
  onInspect(event: NoteEvent): void;
  onSeek(beat: number): void;
}

export function StageHost({
  lab,
  params,
  seed,
  playing,
  getBeat,
  analyser,
  recentRef,
  onInspect,
  onSeek,
}: StageHostProps): JSX.Element {
  const [beat, setBeat] = useState(0);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 640, height: 360 });

  useEffect(() => {
    let frame = 0;
    const loop = (): void => {
      /* Quarter-beat granularity: the React-visible beat only needs to
         drive the cycle window, so re-render ~8×/s at 120 BPM instead of
         every frame. Stages draw their playheads from getBeat() live. */
      const quantized = Math.floor(getBeat() * 4) / 4;
      setBeat((prev) => (prev === quantized ? prev : quantized));
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [getBeat]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(() => {
      setSize({ width: host.clientWidth, height: host.clientHeight });
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const cycleBeats = lab.cycleBeats(params);
  const cycleIndex = Math.max(0, Math.floor(beat / cycleBeats));
  /* Display-only: throttled so a fast slider drag doesn't recompute the
     window on every tick. The trailing update lands the exact value. */
  const events = useThrottledMemo<NoteEvent[]>(
    () =>
      lab.events({
        params,
        seed,
        range: { from: cycleIndex * cycleBeats, to: (cycleIndex + 1) * cycleBeats },
      }),
    [lab, params, seed, cycleIndex, cycleBeats],
    150,
  );

  const Stage = lab.Stage;
  return (
    <div ref={hostRef} className="sb-stage">
      <Stage
        params={params}
        seed={seed}
        beat={beat}
        getBeat={getBeat}
        playing={playing}
        events={events}
        recent={recentRef.current ?? []}
        analyser={analyser}
        onInspect={onInspect}
        onSeek={onSeek}
        width={size.width}
        height={size.height}
      />
    </div>
  );
}
