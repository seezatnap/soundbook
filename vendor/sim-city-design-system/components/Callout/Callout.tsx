import type { HTMLAttributes, JSX, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { PixelIcon, type PixelIconName } from '../../icons/PixelIcon';
import './Callout.css';

export type CalloutVariant = 'info' | 'ok' | 'warn' | 'danger';

const GLYPH: Record<CalloutVariant, PixelIconName> = {
  info: 'info',
  ok: 'check',
  warn: 'warning',
  danger: 'warning',
};

export interface CalloutProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: CalloutVariant;
  /** Set in caps above the message. */
  title?: ReactNode;
  /** Replace the variant's glyph. */
  icon?: PixelIconName;
}

/**
 * A message set into the form it belongs to, rather than floating over it —
 * so it takes a sunken bevel, the way a field does. Danger additionally wears
 * the hatched spine reserved for things the city will regret.
 */
export function Callout({
  variant = 'info',
  title,
  icon,
  className,
  children,
  ...rest
}: CalloutProps): JSX.Element {
  return (
    <div
      className={cx('sc-callout', `sc-callout--${variant}`, className)}
      role={variant === 'danger' ? 'alert' : 'note'}
      {...rest}
    >
      <span className="sc-callout__icon">
        <PixelIcon name={icon ?? GLYPH[variant]} size={16} />
      </span>
      <div className="sc-callout__body">
        {title !== undefined && <div className="sc-callout__title">{title}</div>}
        <div className="sc-callout__text">{children}</div>
      </div>
    </div>
  );
}
