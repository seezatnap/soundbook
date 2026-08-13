import type { HTMLAttributes, JSX, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { PixelIcon, type PixelIconName } from '../../icons/PixelIcon';
import type { CalloutVariant } from '../Callout';
import './Banner.css';

const GLYPH: Record<CalloutVariant, PixelIconName> = {
  info: 'info',
  ok: 'check',
  warn: 'warning',
  danger: 'warning',
};

export interface BannerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: CalloutVariant;
  /** Set in caps ahead of the message, on the same line. */
  title?: ReactNode;
  /** Replace the variant's glyph. */
  icon?: PixelIconName;
  /** One action, at the right end. Use `<Button size="sm">`. */
  action?: ReactNode;
  /** Adds the dismiss box. */
  onDismiss?: () => void;
}

/**
 * The page-level notice: a raised band running the full width of whatever
 * contains it, with no side edges, so it reads as a strip laid across the
 * chrome rather than a card sitting on it.
 */
export function Banner({
  variant = 'info',
  title,
  icon,
  action,
  onDismiss,
  className,
  children,
  ...rest
}: BannerProps): JSX.Element {
  return (
    <div
      className={cx('sc-banner', `sc-banner--${variant}`, className)}
      role={variant === 'danger' ? 'alert' : 'status'}
      {...rest}
    >
      <span className="sc-banner__icon">
        <PixelIcon name={icon ?? GLYPH[variant]} size={16} />
      </span>
      <div className="sc-banner__body">
        {title !== undefined && <span className="sc-banner__title">{title}</span>}
        <span className="sc-banner__text">{children}</span>
      </div>
      {action && <span className="sc-banner__action">{action}</span>}
      {onDismiss && (
        <button
          type="button"
          className="sc-banner__dismiss"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          <PixelIcon name="close" size={16} />
        </button>
      )}
    </div>
  );
}
