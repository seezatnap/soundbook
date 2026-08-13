import type { JSX, LabelHTMLAttributes } from 'react';
import { cx } from '../../lib/cx';
import './Label.css';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /**
   * Draws the accent asterisk. Decorative only: the field itself must carry
   * `required`/`aria-required`, so the marker is hidden from assistive tech
   * rather than read out a second time.
   */
  required?: boolean;
}

export function Label({ required = false, className, children, ...rest }: LabelProps): JSX.Element {
  return (
    <label className={cx('sc-label', className)} {...rest}>
      {children}
      {required && (
        <span className="sc-label__required" aria-hidden="true">
          *
        </span>
      )}
    </label>
  );
}
