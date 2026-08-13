/**
 * Hand-drawn pixel icons.
 *
 * Each icon is a 16x16 character grid, compiled to axis-aligned SVG rectangles
 * with `shape-rendering: crispEdges` and rendered at whole-number multiples of
 * 16. Drawing them as glyph grids rather than as paths means there is no curve
 * to be anti-aliased and no chance of a half-pixel edge.
 *
 * Icons are strictly monochrome: every inked cell takes the surrounding
 * colour, so glyphs follow pressed and disabled states and never fight the
 * chrome. Grids may still mark cells `o` (historically the accent cell);
 * the mark is kept as drawing annotation but renders as currentColor.
 */

import type { JSX } from 'react';
import { CORE_ICONS } from './glyphs/core';
import { EXTENDED_ICONS } from './glyphs/extended';

const ICONS: Record<string, string[]> = { ...CORE_ICONS, ...EXTENDED_ICONS };

export type PixelIconName = keyof typeof CORE_ICONS | keyof typeof EXTENDED_ICONS;

export function pixelIconNames(): PixelIconName[] {
  return Object.keys(ICONS) as PixelIconName[];
}

export interface PixelIconProps {
  name: PixelIconName;
  /** Rendered edge in CSS pixels. Use multiples of 16 to stay pixel exact. */
  size?: number;
  className?: string;
}

export function PixelIcon({ name, size = 16, className }: PixelIconProps): JSX.Element {
  const rows = ICONS[name] ?? ICONS['warning'];
  const rects: JSX.Element[] = [];
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.') {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < row.length && row[x + run] === ch) run++;
      rects.push(
        <rect
          key={`${y}-${x}`}
          x={x}
          y={y}
          width={run}
          height={1}
          fill="currentColor"
        />,
      );
      x += run;
    }
  }
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', imageRendering: 'pixelated' }}
    >
      {rects}
    </svg>
  );
}
