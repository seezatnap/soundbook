import type { HTMLAttributes, JSX } from 'react';
import { cx } from '../../lib/cx';
import './Spinner.css';

/*
 * Eight 3x3 blocks on a 6px pitch, walked clockwise from the top-left corner.
 * A square ring rather than a circle: at this size a circle is four ugly
 * compromises, and the machine this pretends to be could not draw one anyway.
 * The ring spans 15 of the 16 grid units — an odd span cannot be centred in an
 * even box, so the spare unit is left at the far edge where nothing reads it.
 */
const RING: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [6, 0],
  [12, 0],
  [12, 6],
  [12, 12],
  [6, 12],
  [0, 12],
  [0, 6],
];

export interface SpinnerProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Rendered edge in CSS pixels. Multiples of 16 stay pixel exact. */
  size?: number;
  /** Announced by screen readers; the ring itself is decorative. */
  label?: string;
}

export function Spinner({
  size = 16,
  label = 'Working…',
  className,
  ...rest
}: SpinnerProps): JSX.Element {
  return (
    <span className={cx('sc-spinner', className)} role="status" {...rest}>
      <svg
        className="sc-spinner__ring"
        width={size}
        height={size}
        viewBox="0 0 16 16"
        shapeRendering="crispEdges"
        aria-hidden="true"
        focusable="false"
      >
        {RING.map(([x, y]) => (
          <rect key={`${x}-${y}`} className="sc-spinner__block" x={x} y={y} width={3} height={3} />
        ))}
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
