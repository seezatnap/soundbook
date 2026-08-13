/*
 * Colour arithmetic for the paint-shop components. Pure functions, no chrome:
 * everything here handles PAYLOAD colour — the paint being picked — so hex
 * literals and css colour strings are legal currency here, not a token
 * violation.
 *
 * Hue is degrees 0–360, saturation and lightness are whole percents, rgb
 * channels are 0–255. Everything rounds to integers on the way out: a
 * 256-colour machine has no fractional colour, and neither do we.
 *
 * Lives in the Swatch folder because Swatch depends on nothing else, so every
 * sibling can import from '@/components/Swatch/colorMath' without a cycle.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

const HEX6 = /^[0-9a-f]{6}$/i;
const HEX3 = /^[0-9a-f]{3}$/i;

/** "#abc", "abc", "#aabbcc", "AABBCC" → "#AABBCC"; anything else → null. */
export function normalizeHex(input: string): string | null {
  const raw = input.trim().replace(/^#/, '');
  if (HEX3.test(raw)) {
    return `#${raw.split('').map((c) => c + c).join('')}`.toUpperCase();
  }
  if (HEX6.test(raw)) return `#${raw}`.toUpperCase();
  return null;
}

export function hexToRgb(hex: string): Rgb | null {
  const norm = normalizeHex(hex);
  if (norm === null) return null;
  return {
    r: parseInt(norm.slice(1, 3), 16),
    g: parseInt(norm.slice(3, 5), 16),
    b: parseInt(norm.slice(5, 7), 16),
  };
}

export function rgbToHex({ r, g, b }: Rgb): string {
  const pair = (v: number): string =>
    clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return `#${pair(r)}${pair(g)}${pair(b)}`.toUpperCase();
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const rn = clamp(r, 0, 255) / 255;
  const gn = clamp(g, 0, 255) / 255;
  const bn = clamp(b, 0, 255) / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h: Math.round(h) % 360, s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const hn = ((h % 360) + 360) % 360;
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((hn / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (hn < 60) {
    r = c;
    g = x;
  } else if (hn < 120) {
    r = x;
    g = c;
  } else if (hn < 180) {
    g = c;
    b = x;
  } else if (hn < 240) {
    g = x;
    b = c;
  } else if (hn < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255),
  };
}

export function hexToHsl(hex: string): Hsl | null {
  const rgb = hexToRgb(hex);
  return rgb === null ? null : rgbToHsl(rgb);
}

export function hslToHex(hsl: Hsl): string {
  return rgbToHex(hslToRgb(hsl));
}

/** CSS colour string for an hsl triple, for painting payload cells. */
export function hslCss({ h, s, l }: Hsl): string {
  return `hsl(${h} ${s}% ${l}%)`;
}
