/*
 * Declarative parameter schemas. A lab declares its params once; the shell
 * generates controls, validation, randomization, URL serialization and reset
 * from the same declaration. No hidden musical state: if it affects sound,
 * it is in here (or it is the seed).
 */

import { type Rng } from '@/sdk/prng';

export type ParamValue = number | string | boolean;
export type ParamValues = Record<string, ParamValue>;

interface ParamBase {
  key: string;
  label: string;
  /** One-line explanation surfaced in the control's tooltip/docs. */
  hint?: string;
  /**
   * A transport/console control that steers playback rather than the
   * material (loop, AutoRandomize, fade window): randomize never touches it
   * and A/B morph pins it to A, no lock needed. Still serialized like any
   * other param — the URL carries it.
   */
  control?: boolean;
}

export interface NumberParam extends ParamBase {
  kind: 'number';
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
}

export interface IntParam extends ParamBase {
  kind: 'int';
  min: number;
  max: number;
  default: number;
}

export interface SelectParam extends ParamBase {
  kind: 'select';
  options: Array<{ value: string; label: string }>;
  default: string;
}

export interface ToggleParam extends ParamBase {
  kind: 'toggle';
  default: boolean;
}

export type ParamSpec = NumberParam | IntParam | SelectParam | ToggleParam;

export function defaultsOf(specs: readonly ParamSpec[]): ParamValues {
  const out: ParamValues = {};
  for (const spec of specs) out[spec.key] = spec.default;
  return out;
}

function snap(value: number, min: number, max: number, step: number): number {
  const stepped = Math.round((value - min) / step) * step + min;
  const clamped = Math.min(max, Math.max(min, stepped));
  /* Kill float dust so URL payloads stay short and comparisons exact. */
  return Number(clamped.toFixed(6));
}

/** Coerce one value to a legal value for its spec; fall back to default. */
export function sanitize(spec: ParamSpec, value: unknown): ParamValue {
  switch (spec.kind) {
    case 'number': {
      const n = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(n) ? snap(n, spec.min, spec.max, spec.step) : spec.default;
    }
    case 'int': {
      const n = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(n)
        ? Math.min(spec.max, Math.max(spec.min, Math.round(n)))
        : spec.default;
    }
    case 'select':
      return spec.options.some((o) => o.value === value) ? (value as string) : spec.default;
    case 'toggle':
      return typeof value === 'boolean' ? value : spec.default;
  }
}

/** Validate a whole record: unknown keys dropped, bad values defaulted. */
export function sanitizeAll(specs: readonly ParamSpec[], values: unknown): ParamValues {
  const source = (values && typeof values === 'object' ? values : {}) as Record<string, unknown>;
  const out: ParamValues = {};
  for (const spec of specs) {
    out[spec.key] = spec.key in source ? sanitize(spec, source[spec.key]) : spec.default;
  }
  return out;
}

/** Only the entries that differ from defaults — what the URL carries. */
export function diffFromDefaults(specs: readonly ParamSpec[], values: ParamValues): ParamValues {
  const out: ParamValues = {};
  for (const spec of specs) {
    if (values[spec.key] !== spec.default) out[spec.key] = values[spec.key];
  }
  return out;
}

/** Seeded randomization; locked keys keep their current value. */
export function randomizeParams(
  specs: readonly ParamSpec[],
  current: ParamValues,
  locked: ReadonlySet<string>,
  rng: Rng,
): ParamValues {
  const out: ParamValues = {};
  for (const spec of specs) {
    if (locked.has(spec.key) || spec.control) {
      out[spec.key] = current[spec.key];
      continue;
    }
    switch (spec.kind) {
      case 'number':
        out[spec.key] = snap(rng.range(spec.min, spec.max), spec.min, spec.max, spec.step);
        break;
      case 'int':
        out[spec.key] = spec.min + rng.int(spec.max - spec.min + 1);
        break;
      case 'select':
        out[spec.key] = rng.pick(spec.options).value;
        break;
      case 'toggle':
        out[spec.key] = rng.chance(0.5);
        break;
    }
  }
  return out;
}

/**
 * Interpolate between two param records for A/B morphing. Continuous params
 * blend; discrete params (int/select/toggle) switch at the midpoint.
 */
export function morphParams(
  specs: readonly ParamSpec[],
  a: ParamValues,
  b: ParamValues,
  t: number,
): ParamValues {
  const out: ParamValues = {};
  for (const spec of specs) {
    const va = a[spec.key] ?? spec.default;
    const vb = b[spec.key] ?? spec.default;
    /* Transport controls sit the morph out — they hold A's value. */
    if (spec.control) {
      out[spec.key] = va;
      continue;
    }
    if (spec.kind === 'number') {
      out[spec.key] = snap(
        (va as number) * (1 - t) + (vb as number) * t,
        spec.min,
        spec.max,
        spec.step,
      );
    } else if (spec.kind === 'int') {
      out[spec.key] = Math.round((va as number) * (1 - t) + (vb as number) * t);
    } else {
      out[spec.key] = t < 0.5 ? va : vb;
    }
  }
  return out;
}
