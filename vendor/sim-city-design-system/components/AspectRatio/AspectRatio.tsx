import type { HTMLAttributes, JSX } from 'react';
import { cx } from '../../lib/cx';
import './AspectRatio.css';

export interface AspectRatioProps extends HTMLAttributes<HTMLDivElement> {
  /** Width over height: 16 / 9, 4 / 3, 1. */
  ratio?: number;
}

/** Holds a shape open at a fixed ratio; the child fills it exactly. */
export function AspectRatio({
  ratio = 1,
  className,
  style,
  children,
  ...rest
}: AspectRatioProps): JSX.Element {
  return (
    <div
      className={cx('sc-aspect-ratio', className)}
      style={{ aspectRatio: String(ratio), ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}
