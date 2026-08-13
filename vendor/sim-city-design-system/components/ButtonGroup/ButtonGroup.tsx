import type { HTMLAttributes, JSX } from 'react';
import { cx } from '../../lib/cx';
import './ButtonGroup.css';

export interface ButtonGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** Required: a group of controls has to say what it is a group of. */
  'aria-label': string;
  /** Fuse the buttons into one continuous run of chrome. */
  attached?: boolean;
}

export function ButtonGroup({
  attached = true,
  className,
  children,
  ...rest
}: ButtonGroupProps): JSX.Element {
  return (
    <div
      role="group"
      className={cx(
        'sc-button-group',
        attached ? 'sc-button-group--attached' : 'sc-button-group--spaced',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
