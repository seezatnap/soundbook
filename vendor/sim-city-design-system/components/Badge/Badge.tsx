import type { HTMLAttributes, JSX } from 'react';
import { cx } from '../../lib/cx';
import './Badge.css';

export type BadgeVariant = 'default' | 'accent' | 'ok' | 'warn' | 'danger';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /**
   * Status colours fill the plate solid. The colour is decoration: whatever the
   * badge means must also be in its text.
   */
  variant?: BadgeVariant;
}

export function Badge({ variant = 'default', className, children, ...rest }: BadgeProps): JSX.Element {
  return (
    <span
      className={cx('sc-badge', variant !== 'default' && `sc-badge--${variant}`, className)}
      {...rest}
    >
      {children}
    </span>
  );
}
