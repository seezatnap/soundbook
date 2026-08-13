import type { HTMLAttributes, JSX } from 'react';
import { cx } from '../../lib/cx';
import './StatusLight.css';

export type StatusLightVariant = 'ok' | 'warn' | 'danger' | 'idle' | 'active' | 'queued';

export interface StatusLightProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: StatusLightVariant;
}

/**
 * An 8px lamp beside a word. The lamp is hidden from assistive tech on purpose:
 * colour is the fastest read for a sighted operator scanning a rack of them,
 * and the word beside it is the actual state.
 */
export function StatusLight({
  variant = 'idle',
  className,
  children,
  ...rest
}: StatusLightProps): JSX.Element {
  return (
    <span className={cx('sc-status-light', className)} {...rest}>
      <span
        className={cx('sc-status-light__led', `sc-status-light__led--${variant}`)}
        aria-hidden="true"
      />
      <span className="sc-status-light__label">{children}</span>
    </span>
  );
}
