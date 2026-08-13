import type { HTMLAttributes, JSX, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { PixelIcon, type PixelIconName } from '../../icons/PixelIcon';
import './EmptyState.css';

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  icon?: PixelIconName;
  /** Set in caps. The one line the operator reads. */
  title: ReactNode;
  description?: ReactNode;
  /** What to do about it. Use `<Button>`. */
  action?: ReactNode;
  /** Glyph edge in CSS pixels; multiples of 16 stay pixel exact. */
  iconSize?: number;
}

/**
 * What a panel says when it has nothing to report. The glyph is drawn large
 * on purpose: a 16x16 grid blown up to 64 is four times the pixel, not a
 * blurrier one, and the coarseness is the point.
 */
export function EmptyState({
  icon = 'folder',
  title,
  description,
  action,
  iconSize = 64,
  className,
  children,
  ...rest
}: EmptyStateProps): JSX.Element {
  return (
    <div className={cx('sc-empty', className)} {...rest}>
      <span className="sc-empty__icon">
        <PixelIcon name={icon} size={iconSize} />
      </span>
      <p className="sc-empty__title">{title}</p>
      {description !== undefined && <p className="sc-empty__desc">{description}</p>}
      {children}
      {action && <div className="sc-empty__action">{action}</div>}
    </div>
  );
}
