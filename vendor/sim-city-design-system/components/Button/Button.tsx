import type { ButtonHTMLAttributes, JSX } from 'react';
import { PixelIcon, type PixelIconName } from '../../icons/PixelIcon';
import './Button.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** "accent" is the one action the panel exists for; "danger" destroys. */
  variant?: 'default' | 'accent' | 'danger';
  size?: 'md' | 'sm';
  /** Leading pixel glyph. */
  icon?: PixelIconName;
}

export function Button({
  variant = 'default',
  size = 'md',
  icon,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps): JSX.Element {
  const classes = [
    'sc-button',
    variant !== 'default' && `sc-button--${variant}`,
    size === 'sm' && 'sc-button--sm',
    className,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={classes} {...rest}>
      {icon ? <PixelIcon name={icon} size={16} /> : null}
      {children}
    </button>
  );
}
