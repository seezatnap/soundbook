/*
 * Shared fixtures for the layout patterns: the pixel city and the little
 * municipal arithmetic the stories lean on. Everything here is deterministic
 * — the same city boots off the cartridge every time — because a demo that
 * shuffles itself is a demo you cannot describe to a colleague.
 */

import { useMemo, type CSSProperties, type JSX } from 'react';
import { cx } from '../../lib/cx';
import './layouts.css';

/** A cheap integer hash onto [0, 1). Same (x, y) in, same terrain out. */
export function tileHash(x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) ^ 0x5bf03635;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export interface CityDistrict {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The three named districts, in tile coordinates. */
export const CITY_DISTRICTS: CityDistrict[] = [
  { name: 'Norton Heights', x: 15, y: 3, w: 9, h: 6 },
  { name: 'Foundry Flats', x: 27, y: 15, w: 12, h: 8 },
  { name: 'Old Port', x: 2, y: 15, w: 8, h: 7 },
];

/**
 * The ground itself. A river down the west side, a street grid, built blocks
 * inside the districts, scrub on the outskirts — all decided by coordinates,
 * never by chance.
 */
export function cityCellColor(x: number, y: number): string {
  const bank = 11 + Math.floor(y / 4);
  if (x >= bank - 1 && x <= bank + 1) {
    return (x + y) % 2 === 0 ? 'var(--map-void)' : 'var(--map-void-dither)';
  }
  if (x % 10 === 0 || y % 8 === 0) return 'var(--map-grid)';
  for (const district of CITY_DISTRICTS) {
    if (
      x >= district.x &&
      x < district.x + district.w &&
      y >= district.y &&
      y < district.y + district.h
    ) {
      const roll = tileHash(x, y);
      if (roll < 0.14) return 'var(--map-empty)';
      if (roll < 0.24) return 'var(--map-grid)';
      return (x + y) % 2 === 0 ? 'var(--map-grid-strong)' : 'var(--map-empty)';
    }
  }
  const roll = tileHash(x, y);
  if (roll > 0.955) return 'var(--map-grid-strong)';
  if (roll > 0.87) return 'var(--map-void-dither)';
  return 'var(--map-empty)';
}

export interface CityMark {
  x: number;
  y: number;
  color: string;
}

/** Public works in flight, painted over the terrain in the status colours. */
export const CITY_WORKS: CityMark[] = [
  { x: 17, y: 5, color: 'var(--map-queued)' },
  { x: 18, y: 5, color: 'var(--map-queued)' },
  { x: 30, y: 17, color: 'var(--map-generating)' },
  { x: 31, y: 17, color: 'var(--map-generating)' },
  { x: 31, y: 18, color: 'var(--map-generating)' },
  { x: 5, y: 18, color: 'var(--map-failed)' },
];

export interface PixelCityProps {
  cols: number;
  rows: number;
  /** Tile edge in px; 16 for the main map, small for minimaps. */
  tile: number;
  /** Paint district names over the ground. */
  labels?: boolean;
  marks?: CityMark[];
  className?: string;
  style?: CSSProperties;
}

/**
 * The city, drawn as an inline grid of hard-coloured cells. Decorative by
 * construction — every fact on it is also somewhere legible — so the whole
 * plate is hidden from assistive technology.
 */
export function PixelCity({
  cols,
  rows,
  tile,
  labels = false,
  marks,
  className,
  style,
}: PixelCityProps): JSX.Element {
  const cells = useMemo(() => {
    const marked = new Map<string, string>();
    for (const mark of marks ?? []) marked.set(`${mark.x},${mark.y}`, mark.color);
    const out: JSX.Element[] = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        out.push(
          <div
            key={`${x},${y}`}
            style={{ background: marked.get(`${x},${y}`) ?? cityCellColor(x, y) }}
          />,
        );
      }
    }
    return out;
  }, [cols, rows, marks]);

  return (
    <div
      className={cx('sc-lay-city', className)}
      style={{
        gridTemplateColumns: `repeat(${cols}, ${tile}px)`,
        gridAutoRows: `${tile}px`,
        ...style,
      }}
      aria-hidden="true"
    >
      {cells}
      {labels &&
        CITY_DISTRICTS.map((district) => (
          <span
            key={district.name}
            className="sc-lay-city__label"
            style={{ left: (district.x + 1) * tile, top: (district.y + 1) * tile }}
          >
            {district.name}
          </span>
        ))}
    </div>
  );
}

/** Municipal money: the section-sign ledger format. */
export function funds(amount: number): string {
  return `§${amount.toLocaleString('en-US')}`;
}
