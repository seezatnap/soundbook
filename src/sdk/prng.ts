/*
 * All randomness in Soundbook flows through here. Math.random is banned from
 * musical code; every stream is derived from the session seed plus a string
 * key, so the same URL always produces the same events regardless of the
 * order in which streams are consumed.
 */

/** FNV-1a 32-bit hash for deriving stream seeds from string keys. */
export function hash32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Combine a numeric seed with any number of scoping keys. */
export function deriveSeed(seed: number, ...keys: Array<string | number>): number {
  let h = seed >>> 0;
  for (const key of keys) {
    h = (h ^ hash32(String(key))) >>> 0;
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
    h = (h ^ (h >>> 15)) >>> 0;
  }
  return h >>> 0;
}

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [0, n). */
  int(n: number): number;
  /** Uniform float in [lo, hi). */
  range(lo: number, hi: number): number;
  /** Uniform pick from a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** True with probability p. */
  chance(p: number): boolean;
}

/** mulberry32 — fast, solid 32-bit PRNG, identical across JS engines. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (n) => Math.floor(next() * n),
    range: (lo, hi) => lo + next() * (hi - lo),
    pick: (items) => items[Math.floor(next() * items.length)],
    chance: (p) => next() < p,
  };
}

/** Rng scoped to (seed, keys) — the standard way labs consume randomness. */
export function rngFor(seed: number, ...keys: Array<string | number>): Rng {
  return makeRng(deriveSeed(seed, ...keys));
}

/** A fresh, non-deterministic seed for the Reseed control (user gesture only). */
export function freshSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] >>> 0;
}
