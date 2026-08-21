/*
 * React bindings over the pure canvas helpers in src/labs/shared/stage.ts.
 * Shell-only: labs never import React, so these hooks live here.
 */

import { useEffect, useReducer, useRef, type RefObject } from 'react';
import { readPalette, startCanvasLoop, type CanvasDraw } from '@/labs/shared/stage';

/**
 * useMemo with a rate limit. Recomputes immediately on the first change,
 * then at most once per `ms`, with a trailing update so the settled value
 * is always exact. Purely visual — see makeThrottledMemo for the rationale.
 */
export function useThrottledMemo<T>(compute: () => T, deps: readonly unknown[], ms: number): T {
  const ref = useRef<{
    value: T;
    deps: readonly unknown[];
    last: number;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);
  const [, force] = useReducer((x: number) => x + 1, 0);

  const stale =
    ref.current === null ||
    ref.current.deps.length !== deps.length ||
    !deps.every((dep, i) => ref.current!.deps[i] === dep);

  if (ref.current === null) {
    ref.current = { value: compute(), deps, last: performance.now(), timer: null };
  } else if (stale) {
    const now = performance.now();
    if (now - ref.current.last >= ms) {
      ref.current.value = compute();
      ref.current.deps = deps;
      ref.current.last = now;
    } else if (ref.current.timer === null) {
      /* Trailing edge: re-render once the window opens; that render sees
         the latest deps and computes with them. */
      ref.current.timer = setTimeout(
        () => {
          if (ref.current) ref.current.timer = null;
          force();
        },
        ms - (now - ref.current.last) + 5,
      );
    }
  }

  useEffect(
    () => () => {
      if (ref.current?.timer) clearTimeout(ref.current.timer);
    },
    [],
  );

  return ref.current.value;
}

/**
 * Returns a ref for a <canvas>; `draw` runs every animation frame with the
 * canvas sized to its CSS box at device-pixel resolution and the palette
 * re-read whenever the chrome variant flips. The latest draw closure is
 * always used, so components simply re-render with new props.
 */
export function useStageCanvas(draw: CanvasDraw): RefObject<HTMLCanvasElement | null> {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef<CanvasDraw>(draw);
  drawRef.current = draw;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let palette = readPalette(canvas);
    const chromeObserver = new MutationObserver(() => {
      palette = readPalette(canvas);
    });
    chromeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-chrome'],
    });
    const stop = startCanvasLoop(
      canvas,
      (g, w, h, pal, nowMs) => drawRef.current(g, w, h, pal, nowMs),
      () => palette,
    );
    return () => {
      stop();
      chromeObserver.disconnect();
    };
  }, []);

  return canvasRef;
}
