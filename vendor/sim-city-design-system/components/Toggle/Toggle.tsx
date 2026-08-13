import type { ButtonHTMLAttributes, JSX, MouseEvent } from 'react';
import { PixelIcon, type PixelIconName } from '../../icons/PixelIcon';
import { cx } from '../../lib/cx';
import { useControllableState } from '../../lib/useControllableState';
import './Toggle.css';

export interface ToggleProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  /** Controlled state. Leave undefined to let the toggle keep its own. */
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  /** Leading pixel glyph. */
  icon?: PixelIconName;
  size?: 'md' | 'sm';
}

export function Toggle({
  pressed,
  defaultPressed = false,
  onPressedChange,
  icon,
  size = 'md',
  className,
  children,
  onClick,
  type = 'button',
  ...rest
}: ToggleProps): JSX.Element {
  const [on, setOn] = useControllableState(pressed, defaultPressed, onPressedChange);

  function handleClick(event: MouseEvent<HTMLButtonElement>): void {
    onClick?.(event);
    if (event.defaultPrevented) return;
    setOn(!on);
  }

  return (
    <button
      type={type}
      aria-pressed={on}
      className={cx('sc-toggle', size === 'sm' && 'sc-toggle--sm', className)}
      onClick={handleClick}
      {...rest}
    >
      {icon ? <PixelIcon name={icon} size={16} /> : null}
      {children}
    </button>
  );
}
