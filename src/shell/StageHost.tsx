/*
 * Hosts the lab's stage renderer and owns the animation-rate state: the
 * transport beat ticks here at rAF rate so only this subtree re-renders
 * per frame, never the whole shell. The visible cycle's events are
 * recomputed only when the cycle index (or the document) changes. The
 * renderer itself is pure (see StageRenderer) — this is the only place in
 * the workshop that turns React props into a StageFrame.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import type { RecentEvent, StagedLab, StageFrame } from '@/sdk/lab';
import type { NoteEvent } from '@/sdk/events';
import type { ParamValues } from '@/sdk/params';
import { useStageCanvas, useThrottledMemo } from '@/shell/stage-hooks';

interface StageHostProps {
  lab: StagedLab;
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

  useEffect(() => {
    let frame = 0;
    const loop = (): void => {
      /* Quarter-beat granularity: the React-visible beat only needs to
         drive the cycle window, so re-render ~8×/s at 120 BPM instead of
         every frame. Renderers draw their playheads from the live beat. */
      const quantized = Math.floor(getBeat() * 4) / 4;
      setBeat((prev) => (prev === quantized ? prev : quantized));
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [getBeat]);

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

  /* One renderer per lab mount; its closure holds the per-canvas caches. */
  const renderer = useMemo(() => lab.makeStage(), [lab]);

  const docRef = useRef({ params, seed, playing, events, analyser });
  docRef.current = { params, seed, playing, events, analyser };

  const frameAt = useCallback(
    (width: number, height: number, nowMs: number): StageFrame => ({
      ...docRef.current,
      beat: getBeat(),
      recent: recentRef.current ?? [],
      width,
      height,
      nowMs,
    }),
    [getBeat, recentRef],
  );

  const canvasRef = useStageCanvas((g, w, h, pal, nowMs) => {
    renderer.draw(g, frameAt(w, h, nowMs), pal);
  });

  return (
    <div className="sb-stage">
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: renderer.click ? 'pointer' : 'default',
        }}
        onClick={(e) => {
          if (!renderer.click) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const hit = renderer.click(
            e.clientX - rect.left,
            e.clientY - rect.top,
            frameAt(rect.width, rect.height, performance.now()),
          );
          if (!hit) return;
          if (hit.seek !== undefined) onSeek(hit.seek);
          if (hit.inspect) onInspect(hit.inspect);
        }}
      />
    </div>
  );
}
