import type { ButtonHTMLAttributes, JSX } from 'react';
import { PixelIcon, type PixelIconName } from '../../icons/PixelIcon';
import { cx } from '../../lib/cx';
import './IconButton.css';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: PixelIconName;
  /** Required: a control with no visible text has to be named some other way. */
  label: string;
  /** 24 / 32 / 42px square. `lg` is the tool-palette hit target. */
  size?: 'sm' | 'md' | 'lg';
  /** "accent" is the one action the palette exists for; "danger" destroys. */
  variant?: 'default' | 'accent' | 'danger';
}

export function IconButton({
  icon,
  label,
  size = 'md',
  variant = 'default',
  className,
  type = 'button',
  ...rest
}: IconButtonProps): JSX.Element {
  return (
    <button
      type={type}
      title={label}
      className={cx(
        'sc-icon-button',
        `sc-icon-button--${size}`,
        variant !== 'default' && `sc-icon-button--${variant}`,
        className,
      )}
      {...rest}
      aria-label={label}
    >
      <PixelIcon name={icon} size={size === 'lg' ? 32 : 16} />
    </button>
  );
}
