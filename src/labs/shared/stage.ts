/*
 * Canvas plumbing for stage views: device-pixel scaling, resize tracking,
 * one rAF loop, and access to the design-system palette so the drawings
 * match the chrome in both variants.
 */

import { useEffect, useReducer, useRef, type RefObject } from 'react';

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

export function readPalette(el: HTMLElement): StagePalette {
  const style = getComputedStyle(el);
  const v = (name: string, fallback: string): string =>
    style.getPropertyValue(name).trim() || fallback;
  return {
    ink: v('--ink', '#d8d8c8'),
    inkDim: v('--ink-dim', '#8a8a7a'),
    face: v('--face', '#3a3a34'),
    faceSunken: v('--face-sunken', '#262622'),
    accent: v('--accent', '#e0a020'),
    accent2: v('--accent-2', '#70b8e0'),
    ok: v('--ok', '#58c470'),
    warn: v('--warn', '#e0b040'),
    danger: v('--danger', '#e05040'),
    edgeLight: v('--edge-light', '#55554c'),
    edgeDark: v('--edge-dark', '#181816'),
  };
}

export type StageDraw = (
  g: CanvasRenderingContext2D,
  width: number,
  height: number,
  palette: StagePalette,
  nowMs: number,
) => void;

/**
 * useMemo with a rate limit. A timeline stage's full-piece score is pure
 * display: recomputing it on every tick of a slider drag (~60 Hz) allocates
 * hundreds of megabytes a second for pictures nobody sees. This recomputes
 * immediately on the first change, then at most once per `ms`, with a
 * trailing update so the settled value is always exact. Purely visual —
 * the audio path computes its own small windows and never goes stale.
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
 * A cached canvas layer for the static part of a stage. Timeline stages
 * draw thousands of marks that only change when the document changes;
 * redrawing them at animation rate is most of a stage's CPU. The returned
 * function hands back a bitmap redrawn only when size, pixel density or any
 * dep (compared by identity) changes — blit it, then draw the playhead and
 * flashes on top.
 */
export function makeLayerCache(): (
  width: number,
  height: number,
  dpr: number,
  deps: readonly unknown[],
  draw: (g: CanvasRenderingContext2D, width: number, height: number) => void,
) => HTMLCanvasElement {
  let canvas: HTMLCanvasElement | null = null;
  let key: unknown[] | null = null;
  return (width, height, dpr, deps, draw) => {
    const fresh =
      canvas !== null &&
      key !== null &&
      key.length === deps.length + 3 &&
      key[0] === width &&
      key[1] === height &&
      key[2] === dpr &&
      deps.every((dep, i) => key![i + 3] === dep);
    if (fresh) return canvas!;
    canvas = canvas ?? document.createElement('canvas');
    const pw = Math.max(1, Math.round(width * dpr));
    const ph = Math.max(1, Math.round(height * dpr));
    /* Only touch the dimensions when they actually changed — assigning
       canvas.width discards and reallocates the multi-MB backing store. */
    const g = canvas.getContext('2d')!;
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    } else {
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, pw, ph);
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(g, width, height);
    key = [width, height, dpr, ...deps];
    return canvas;
  };
}

/**
 * Returns a ref for a <canvas>; `draw` runs every animation frame with the
 * canvas sized to its CSS box at device-pixel resolution. The latest draw
 * closure is always used, so components simply re-render with new props.
 */
export function useStageCanvas(draw: StageDraw): RefObject<HTMLCanvasElement | null> {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawRef = useRef<StageDraw>(draw);
  drawRef.current = draw;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = canvas.getContext('2d');
    if (!g) return;
    let frame = 0;
    let palette = readPalette(canvas);
    const chromeObserver = new MutationObserver(() => {
      palette = readPalette(canvas);
    });
    chromeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-chrome'],
    });

    const loop = (): void => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w > 0 && h > 0) {
        const pw = Math.round(w * dpr);
        const ph = Math.round(h * dpr);
        if (canvas.width !== pw || canvas.height !== ph) {
          canvas.width = pw;
          canvas.height = ph;
        }
        g.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawRef.current(g, w, h, palette, performance.now());
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(frame);
      chromeObserver.disconnect();
    };
  }, []);

  return canvasRef;
}
