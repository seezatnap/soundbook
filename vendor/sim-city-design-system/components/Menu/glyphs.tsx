/*
 * Private glyphs for the menu family. The radio column wants a solid block —
 * the shared registry has no such glyph, so it is drawn here with the same
 * character-grid-to-rects technique as PixelIcon, ready to be promoted later.
 */

import type { JSX } from 'react';

const RADIO_BLOCK = [
  '................',
  '................',
  '................',
  '................',
  '................',
  '.....######.....',
  '.....######.....',
  '.....######.....',
  '.....######.....',
  '.....######.....',
  '.....######.....',
  '................',
  '................',
  '................',
  '................',
  '................',
];

export function RadioBlock({ size = 16 }: { size?: number }): JSX.Element {
  const rects: JSX.Element[] = [];
  for (let y = 0; y < RADIO_BLOCK.length; y++) {
    const row = RADIO_BLOCK[y];
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
