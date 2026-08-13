/*
 * The sunken content well: an inverted 2px bevel around read-only material —
 * excerpts, legal text, machine output. It is set INTO the page where a card
 * sits ON it. `dithered` lays the shared hard-stop texture over the face for
 * wells that hold something inert.
 */

import type { HTMLAttributes, JSX } from 'react';
import { cx } from '../../lib/cx';
import './Well.css';

export interface WellProps extends HTMLAttributes<HTMLDivElement> {
  /** The shared `.dither` texture over the sunken face. */
  dithered?: boolean;
}

export function Well({ dithered = false, className, children, ...rest }: WellProps): JSX.Element {
  return (
    <div className={cx('sc-well', dithered && 'dither', className)} {...rest}>
      {children}
    </div>
  );
}
