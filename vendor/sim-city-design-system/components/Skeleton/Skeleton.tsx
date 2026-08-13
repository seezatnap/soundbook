import type { CSSProperties, HTMLAttributes, JSX } from 'react';
import { cx } from '../../lib/cx';
import './Skeleton.css';

export interface SkeletonProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** `text` draws a run of line-height bars; `rect` draws one sized plate. */
  variant?: 'text' | 'rect';
  /** Bars to draw, for `text`. The last one is short, as a last line is. */
  lines?: number;
  width?: number | string;
  height?: number | string;
}

/**
 * The plate that stands in for content that has not arrived. It is a hole in
 * the layout, not a component: `aria-hidden`, no role, nothing to announce.
 * Screen readers are told the record is loading by whatever fetched it.
 */
export function Skeleton({
  variant = 'text',
  lines = 3,
  width,
  height,
  className,
  style,
  ...rest
}: SkeletonProps): JSX.Element {
  const rootStyle: CSSProperties = {
    ...style,
    width: width ?? style?.width,
    height: height ?? style?.height,
  };

  if (variant === 'rect') {
    return (
      <div
        className={cx('sc-skeleton__plate', 'sc-skeleton--rect', className)}
        style={rootStyle}
        aria-hidden="true"
        {...rest}
      />
    );
  }

  return (
    <div className={cx('sc-skeleton', className)} style={rootStyle} aria-hidden="true" {...rest}>
      {Array.from({ length: Math.max(1, lines) }, (_, i) => (
        <div
          key={i}
          className={cx(
            'sc-skeleton__plate',
            'sc-skeleton__bar',
            i === lines - 1 && lines > 1 && 'sc-skeleton__bar--last',
          )}
        />
      ))}
    </div>
  );
}
