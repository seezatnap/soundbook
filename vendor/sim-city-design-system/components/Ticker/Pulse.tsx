import type { HTMLAttributes, JSX } from 'react';
import { cx } from '../../lib/cx';
import './Pulse.css';

export interface PulseProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** `queued` waits in amber, `active` works in teal. */
  variant?: 'active' | 'queued';
  /** 0–1. Given, the marquee becomes a determinate run of blocks. */
  value?: number;
}

/**
 * The activity bar. Lives with the Ticker because that is what it was drawn
 * for, but the boot screen borrows it: there is one progress recipe in the
 * system and duplicating it would be duplicating the animation too.
 *
 * Pass `aria-hidden` when the row around it already says what it is; otherwise
 * it reports itself as a progressbar.
 */
export function Pulse({
  variant = 'active',
  value,
  className,
  'aria-hidden': ariaHidden,
  ...rest
}: PulseProps): JSX.Element {
  const pct = value === undefined ? null : Math.round(Math.min(1, Math.max(0, value)) * 100);
  const measured = pct !== null && !ariaHidden;
  return (
    <div
      className={cx(
        'sc-pulse',
        variant === 'queued' && 'sc-pulse--queued',
        pct !== null && 'sc-pulse--determinate',
        className,
      )}
      role={ariaHidden ? undefined : 'progressbar'}
      aria-hidden={ariaHidden}
      aria-valuemin={measured ? 0 : undefined}
      aria-valuemax={measured ? 100 : undefined}
      aria-valuenow={measured ? pct : undefined}
      {...rest}
    >
      {pct !== null && <div className="sc-pulse__fill" style={{ width: `${pct}%` }} />}
    </div>
  );
}
