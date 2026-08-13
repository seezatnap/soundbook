/*
 * Shared geometry for the one- and two-thumb sliders. Positions live on a
 * "rail" — the stage minus one thumb width — so a thumb at 0% sits flush
 * left and at 100% flush right, and every value maps to a whole-feeling
 * offset without transforms.
 */

/** Thumb plate width in px; the rail is the stage minus one of these. */
export const THUMB = 12;

export function clampValue(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function stepDecimals(step: number): number {
  const s = String(step);
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
}

/** Quantize onto the step lattice anchored at `min`, then clamp. */
export function snapToStep(raw: number, min: number, max: number, step: number): number {
  const stepped = min + Math.round((raw - min) / step) * step;
  return clampValue(Number(stepped.toFixed(stepDecimals(step))), min, max);
}

/** Horizontal offset of a value: pct of rail, optionally at thumb center. */
export function railLeft(pct: number, centered: boolean): string {
  const bias = (pct * THUMB) / 100;
  return centered ? `calc(${pct}% - ${bias}px + ${THUMB / 2}px)` : `calc(${pct}% - ${bias}px)`;
}
