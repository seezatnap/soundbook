/*
 * Canvas plumbing for stage renderers — React-free, so the same helpers
 * serve the workshop and a code export: palette lookup from the chrome's
 * CSS tokens, a device-pixel-aware rAF loop, a cached static layer, and a
 * rate-limited memo for expensive display-only derivations.
 */

import type { StagePalette } from '@/sdk/lab';

export type { StagePalette };

/** The dark chrome's tokens — what a stage draws with when no CSS is set. */
export const DEFAULT_PALETTE: StagePalette = {
  ink: '#e3ede8',
  inkDim: '#9db0a8',
  face: '#3c4a46',
  faceSunken: '#2a3331',
  accent: '#f0a830',
  accent2: '#5ad2c0',
  ok: '#8ecb56',
  warn: '#e8b53a',
  danger: '#e0533a',
  edgeLight: '#71857e',
  edgeDark: '#171d1c',
};

/** CSS custom property behind each palette slot. */
export const PALETTE_VARS: Record<keyof StagePalette, string> = {
  ink: '--ink',
  inkDim: '--ink-dim',
  face: '--face',
  faceSunken: '--face-sunken',
  accent: '--accent',
  accent2: '--accent-2',
  ok: '--ok',
  warn: '--warn',
  danger: '--danger',
  edgeLight: '--edge-light',
  edgeDark: '--edge-dark',
};

export function readPalette(el: Element): StagePalette {
  const style = getComputedStyle(el);
  const out = { ...DEFAULT_PALETTE };
  for (const key of Object.keys(PALETTE_VARS) as Array<keyof StagePalette>) {
    const value = style.getPropertyValue(PALETTE_VARS[key]).trim();
    if (value) out[key] = value;
  }
  return out;
}

export type CanvasDraw = (
  g: CanvasRenderingContext2D,
  width: number,
  height: number,
  palette: StagePalette,
  nowMs: number,
) => void;

/**
 * Run `draw` every animation frame with the canvas sized to its CSS box at
 * device-pixel resolution. Returns a stop function. The backing store is
 * only reallocated when the size actually changes.
 */
export function startCanvasLoop(
  canvas: HTMLCanvasElement,
  draw: CanvasDraw,
  getPalette: () => StagePalette,
): () => void {
  const g = canvas.getContext('2d');
  if (!g) return () => {};
  let frame = 0;
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
      draw(g, w, h, getPalette(), performance.now());
    }
    frame = requestAnimationFrame(loop);
  };
  frame = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(frame);
}

/**
 * A memo with a rate limit, for a stage's full-piece score. Recomputing a
 * whole display score on every tick of a slider drag (~60 Hz) allocates
 * hundreds of megabytes a second for pictures nobody sees. The first call
 * computes; a changed key recomputes at most once per `ms`, and because
 * draw runs every frame the settled key always lands exactly. Purely
 * visual — the audio path computes its own small windows and never goes
 * stale.
 */
export function makeThrottledMemo<T>(
  ms: number,
): (key: string, compute: () => T, nowMs: number) => T {
  let key: string | null = null;
  let value!: T;
  let last = -Infinity;
  return (nextKey, compute, nowMs) => {
    if (key === null || (nextKey !== key && nowMs - last >= ms)) {
      value = compute();
      key = nextKey;
      last = nowMs;
    }
    return value;
  };
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
