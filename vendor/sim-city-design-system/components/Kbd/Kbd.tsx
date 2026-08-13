import type { HTMLAttributes, JSX } from 'react';
import { cx } from '../../lib/cx';
import './Kbd.css';

export type KbdProps = HTMLAttributes<HTMLElement>;

/** A single key cap. Combos are written out as separate caps with a "+" between. */
export function Kbd({ className, children, ...rest }: KbdProps): JSX.Element {
  return (
    <kbd className={cx('sc-kbd', className)} {...rest}>
      {children}
    </kbd>
  );
}
