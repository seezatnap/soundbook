import type { HTMLAttributes, JSX } from 'react';
import { cx } from '../../lib/cx';
import './Separator.css';

export interface SeparatorProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
  /** Purely visual: hidden from assistive tech rather than announced as a separator. */
  decorative?: boolean;
}

export function Separator({
  orientation = 'horizontal',
  decorative = false,
  className,
  ...rest
}: SeparatorProps): JSX.Element {
  return (
    <div
      className={cx('sc-separator', `sc-separator--${orientation}`, className)}
      role={decorative ? undefined : 'separator'}
      /* `separator` is horizontal by default, so only the vertical case declares it. */
      aria-orientation={!decorative && orientation === 'vertical' ? 'vertical' : undefined}
      aria-hidden={decorative || undefined}
      {...rest}
    />
  );
}
