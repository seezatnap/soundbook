/*
 * Swatch: a hard plate of PAYLOAD colour behind a single 1px dark keyline —
 * the one place in the system where the chrome shuts up and the data is the
 * surface. Selection is an accent ring plus a stamped corner check, because a
 * ring alone can vanish against an accent-coloured paint.
 *
 * SwatchGroup is the APG radio pattern laid out on a grid: one tab stop,
 * arrows move focus AND selection in two dimensions (columns wide), Home/End
 * jump to the rails, Space/Enter confirm the focused plate.
 */

import {
  createContext,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { cx } from '../../lib/cx';
import { useControllableState } from '../../lib/useControllableState';
import './Swatch.css';

/*
 * Private glyph: a check small enough for the corner of a 16px plate. Same
 * character-grid technique as PixelIcon, but on an 8x8 grid — a 16x16 grid
 * cannot render whole-pixel at 8px. Candidate for promotion to the registry
 * as a half-size glyph set.
 */
const CHECK_8 = [
  '........',
  '........',
  '......#.',
  '.....##.',
  '.#..##..',
  '.####...',
  '..##....',
  '........',
];

function CornerCheck(): JSX.Element {
  const rects: JSX.Element[] = [];
  CHECK_8.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      if (row[x] !== '#') {
        x++;
        continue;
      }
      let run = 1;
      while (row[x + run] === '#') run++;
      rects.push(<rect key={`${y}-${x}`} x={x} y={y} width={run} height={1} fill="currentColor" />);
      x += run;
    }
  });
  return (
    <svg
      width={8}
      height={8}
      viewBox="0 0 8 8"
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block', imageRendering: 'pixelated' }}
    >
      {rects}
    </svg>
  );
}

export type SwatchSize = 16 | 20 | 32;

interface SwatchGroupContextValue {
  value: string | null;
  select: (value: string) => void;
  disabled: boolean;
  size: SwatchSize;
}

const SwatchGroupContext = createContext<SwatchGroupContextValue | null>(null);

export interface SwatchProps {
  /** The paint itself: any CSS colour, normally hex. Payload, never chrome. */
  color: string;
  /** Radiogroup identity inside a SwatchGroup; defaults to `color`. */
  value?: string;
  /** Accessible name — a colour name or the hex. Defaults to `color`. */
  label?: string;
  size?: SwatchSize;
  /** Standalone selected ring; inside a group, selection comes from value. */
  selected?: boolean;
  disabled?: boolean;
  className?: string;
}

export function Swatch({
  color,
  value,
  label,
  size,
  selected,
  disabled = false,
  className,
}: SwatchProps): JSX.Element {
  const group = useContext(SwatchGroupContext);
  const identity = value ?? color;
  const isSelected = group ? group.value === identity : Boolean(selected);
  const isDisabled = disabled || (group?.disabled ?? false);
  const plateSize = size ?? group?.size ?? 20;
  const ariaLabel = label ?? color;

  function handleClick(event: MouseEvent<HTMLSpanElement>): void {
    if (!group || isDisabled) return;
    // Safari does not always focus tabindex elements on click; insist.
    event.currentTarget.focus();
    group.select(identity);
  }

  const classes = cx(
    'sc-swatch',
    plateSize !== 20 && `sc-swatch--${plateSize}`,
    isSelected && 'sc-swatch--selected',
    isDisabled && 'sc-swatch--disabled',
    group !== null && 'sc-swatch--interactive',
    className,
  );

  const check = isSelected ? (
    <span className="sc-swatch__check" aria-hidden="true">
      <CornerCheck />
    </span>
  ) : null;

  if (group !== null) {
    return (
      <span
        role="radio"
        aria-checked={isSelected}
        aria-disabled={isDisabled || undefined}
        aria-label={ariaLabel}
        data-value={identity}
        onClick={handleClick}
        className={classes}
        style={{ background: color }}
      >
        {check}
      </span>
    );
  }

  return (
    <span role="img" aria-label={ariaLabel} className={classes} style={{ background: color }}>
      {check}
    </span>
  );
}

export interface SwatchGroupProps {
  /** Uppercase dim band above the plates. */
  label: ReactNode;
  /** Swatch children (wrappers between them are fine). */
  children: ReactNode;
  /** Grid width; arrows use it to move vertically. */
  columns?: number;
  /** Controlled value; pass null for "nothing selected yet". */
  value?: string | null;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Plate size handed to children that do not set their own. */
  size?: SwatchSize;
  disabled?: boolean;
  className?: string;
}

export function SwatchGroup({
  label,
  children,
  columns = 8,
  value: valueProp,
  defaultValue,
  onValueChange,
  size = 20,
  disabled = false,
  className,
}: SwatchGroupProps): JSX.Element {
  const [value, setValue] = useControllableState<string | null>(
    valueProp,
    defaultValue ?? null,
    (next) => {
      if (next !== null) onValueChange?.(next);
    },
  );

  const context = useMemo<SwatchGroupContextValue>(
    () => ({ value, select: setValue, disabled, size }),
    [value, setValue, disabled, size],
  );

  const gridRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const cols = Math.max(1, Math.round(columns));

  function plates(): HTMLElement[] {
    const root = gridRef.current;
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>('[role="radio"]'));
  }

  /*
   * The roving tab stop: exactly one plate is tabbable — the checked one, or
   * the first enabled one when nothing is checked yet. Recomputed after every
   * render of the group.
   */
  useLayoutEffect(() => {
    const all = plates();
    const enabled = all.filter((el) => el.getAttribute('aria-disabled') !== 'true');
    const checked = enabled.find((el) => el.getAttribute('aria-checked') === 'true');
    const stop = checked ?? enabled[0];
    for (const el of all) el.tabIndex = el === stop ? 0 : -1;
  });

  /* Walk from `index` by `delta`, skipping disabled plates in that direction. */
  function walk(all: HTMLElement[], index: number, delta: number): HTMLElement | null {
    let i = index + delta;
    while (i >= 0 && i < all.length) {
      if (all[i].getAttribute('aria-disabled') !== 'true') return all[i];
      i += delta;
    }
    return null;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const origin = (event.target as HTMLElement).closest<HTMLElement>('[role="radio"]');
    if (!origin) return;
    const all = plates();
    const index = all.indexOf(origin);
    if (index < 0) return;
    const enabled = all.filter((el) => el.getAttribute('aria-disabled') !== 'true');

    let next: HTMLElement | null = null;
    switch (event.key) {
      case 'ArrowRight':
        next = walk(all, index, 1);
        break;
      case 'ArrowLeft':
        next = walk(all, index, -1);
        break;
      case 'ArrowDown':
        next = walk(all, index, cols);
        break;
      case 'ArrowUp':
        next = walk(all, index, -cols);
        break;
      case 'Home':
        next = enabled[0] ?? null;
        break;
      case 'End':
        next = enabled[enabled.length - 1] ?? null;
        break;
      case ' ':
      case 'Enter':
        event.preventDefault();
        if (origin.dataset.value !== undefined) setValue(origin.dataset.value);
        return;
      default:
        return;
    }
    event.preventDefault();
    if (next) {
      next.focus();
      if (next.dataset.value !== undefined) setValue(next.dataset.value);
    }
  }

  return (
    <div className={cx('sc-swatch-group', disabled && 'sc-swatch-group--disabled', className)}>
      <div className="sc-swatch-group__label" id={labelId}>
        {label}
      </div>
      <div
        ref={gridRef}
        role="radiogroup"
        aria-labelledby={labelId}
        aria-disabled={disabled || undefined}
        onKeyDown={disabled ? undefined : handleKeyDown}
        className="sc-swatch-group__grid"
        style={{ gridTemplateColumns: `repeat(${cols}, max-content)` }}
      >
        <SwatchGroupContext.Provider value={context}>{children}</SwatchGroupContext.Provider>
      </div>
    </div>
  );
}
