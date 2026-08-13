/*
 * Canvas plumbing for stage views: device-pixel scaling, resize tracking,
 * one rAF loop, and access to the design-system palette so the drawings
 * match the chrome in both variants.
 */

import { useEffect, useRef, type RefObject } from 'react';

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
