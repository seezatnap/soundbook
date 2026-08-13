/*
 * Small music-theory toolkit shared by labs: scales, euclidean rhythms,
 * and integer helpers. Everything pure.
 */

export const SCALES: Record<string, number[]> = {
  pentatonic: [0, 2, 4, 7, 9],
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  wholetone: [0, 2, 4, 6, 8, 10],
};

/** Degree → MIDI within a scale, degrees beyond the octave wrap upward. */
export function scaleNote(root: number, scale: readonly number[], degree: number): number {
  const len = scale.length;
  const octave = Math.floor(degree / len);
  const idx = ((degree % len) + len) % len;
  return root + octave * 12 + scale[idx];
}

/**
 * Euclidean rhythm E(pulses, steps) via Bjorklund's algorithm — the
 * canonical patterns from Toussaint's paper (E(3,8) = x..x..x.,
 * E(5,16) = x..x..x..x..x...), first pulse on step 0.
 */
export function euclid(pulses: number, steps: number): boolean[] {
  const k = Math.max(0, Math.min(pulses, steps));
  if (steps === 0) return [];
  if (k === 0) return new Array(steps).fill(false);
  let a: boolean[][] = Array.from({ length: k }, () => [true]);
  let b: boolean[][] = Array.from({ length: steps - k }, () => [false]);
  while (b.length > 1) {
    const m = Math.min(a.length, b.length);
    const merged: boolean[][] = [];
    for (let i = 0; i < m; i++) merged.push([...a[i], ...b[i]]);
    const rest = a.length > m ? a.slice(m) : b.slice(m);
    a = merged;
    b = rest;
  }
  return [...a, ...b].flat();
}

/** Rotate a step pattern left by n (hit at index n moves to index 0). */
export function rotate<T>(pattern: readonly T[], n: number): T[] {
  const len = pattern.length;
  if (len === 0) return [];
  const shift = ((n % len) + len) % len;
  return pattern.map((_, i) => pattern[(i + shift) % len]);
}

export function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) [x, y] = [y, x % y];
  return x;
}

export function lcm(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : Math.abs(a * b) / gcd(a, b);
}

export function lcmAll(values: readonly number[]): number {
  return values.reduce((acc, v) => lcm(acc, v), 1);
}
