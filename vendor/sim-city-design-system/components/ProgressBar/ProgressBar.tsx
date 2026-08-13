import { useId, type HTMLAttributes, type JSX, type ReactNode } from 'react';
import { cx } from '../../lib/cx';
import './ProgressBar.css';

export interface ProgressBarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Amount done, in the same units as `max`. Omit entirely for indeterminate work. */
  value?: number;
  max?: number;
  /** Caption above the channel. Also names the progressbar for assistive tech. */
  label?: ReactNode;
  /** Right-aligned percent readout on the caption row. */
  showValue?: boolean;
  /** Work that is waiting its turn: amber blocks rather than teal. */
  queued?: boolean;
}

/**
 * A job meter. Determinate work fills from the left in hard blocks and the
 * width snaps — a progress bar that slides is a progress bar that lies about
 * when the work happened. Indeterminate work marches instead: the same blocks
 * travelling right forever, because the machine is busy and cannot say more.
 */
export function ProgressBar({
  value,
  max = 100,
  label,
  showValue = false,
  queued = false,
  className,
  ...rest
}: ProgressBarProps): JSX.Element {
  const labelId = useId();
  const indeterminate = value === undefined;
  const clamped = value === undefined ? 0 : Math.min(Math.max(value, 0), max);
  const percent = max > 0 ? Math.round((clamped / max) * 100) : 0;

  return (
    <div
      className={cx('sc-progress', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={indeterminate ? undefined : clamped}
      aria-labelledby={label !== undefined ? labelId : undefined}
      {...rest}
    >
      {(label !== undefined || showValue) && (
        <div className="sc-progress__head">
          <span className="sc-progress__label" id={labelId}>
            {label}
          </span>
          {showValue && (
            <span className="sc-progress__value">{indeterminate ? '--%' : `${percent}%`}</span>
          )}
        </div>
      )}
      <div
        className={cx(
          'sc-progress__channel',
          indeterminate && 'sc-progress__channel--marching',
          indeterminate && queued && 'sc-progress__channel--queued',
        )}
      >
        {!indeterminate && (
          <div
            className={cx('sc-progress__fill', queued && 'sc-progress__fill--queued')}
            style={{ width: `${percent}%` }}
          />
        )}
      </div>
    </div>
  );
}
