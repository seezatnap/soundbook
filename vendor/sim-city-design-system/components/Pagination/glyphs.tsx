/*
 * Private glyphs: doubled chevrons for FIRST/LAST. Not in the shared registry
 * yet; drawn here with the same 16x16 grid-to-rects technique as PixelIcon so
 * they can be promoted verbatim. `#` = currentColor, `.` = transparent.
 */

import type { JSX } from 'react';

const GRIDS = {
  'chevrons-left': [
    '................',
    '................',
    '................',
    '......##....##..',
    '.....##....##...',
    '....##....##....',
    '...##....##.....',
    '..##....##......',
    '..##....##......',
    '...##....##.....',
    '....##....##....',
    '.....##....##...',
    '......##....##..',
    '................',
    '................',
    '................',
  ],
  'chevrons-right': [
    '................',
    '................',
    '................',
    '..##....##......',
    '...##....##.....',
    '....##....##....',
    '.....##....##...',
    '......##....##..',
    '......##....##..',
    '.....##....##...',
    '....##....##....',
    '...##....##.....',
    '..##....##......',
    '................',
    '................',
    '................',
  ],
} satisfies Record<string, string[]>;

export type PaginationGlyphName = keyof typeof GRIDS;

export function PaginationGlyph({ name }: { name: PaginationGlyphName }): JSX.Element {
  const rows = GRIDS[name];
  const rects: JSX.Element[] = [];
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    let x = 0;
    while (x < row.length) {
      if (row[x] === '.') {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < row.length && row[x + run] === '#') run++;
      rects.push(<rect key={`${y}-${x}`} x={x} y={y} width={run} height={1} fill="currentColor" />);
      x += run;
    }
  }
  return (
    <svg
      width={16}
      height={16}
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
