import type { HTMLAttributes, JSX, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import './StatusBar.css';

export interface StatusBarProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

/**
 * The strip along the bottom of the shell. It is a plain flex row: what goes in
 * it is a handful of `Readout`s, and the last one usually grows to swallow the
 * leftover width.
 *
 * `aria-live` is off by default. These numbers change on every pointer move and
 * a screen reader reciting coordinates at ten hertz is not an accessibility
 * feature; anything that genuinely needs announcing says so on its own.
 */
export function StatusBar({
  className,
  children,
  role = 'status',
  'aria-live': ariaLive = 'off',
  ...rest
}: StatusBarProps): JSX.Element {
  return (
    <div className={cx('sc-statusbar', className)} role={role} aria-live={ariaLive} {...rest}>
      {children}
    </div>
  );
}

export interface ReadoutProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Uppercase caption to the left of the value. Omit for a bare message cell. */
  label?: ReactNode;
  /** `accent` is the funds-style figure; `dim` is passing commentary. */
  variant?: 'default' | 'accent' | 'dim';
  /** Takes the leftover width of the bar — the message cell. */
  grow?: boolean;
}

/** One sunken cell of the bar: a caption and a tabular value. */
export function Readout({
  label,
  variant = 'default',
  grow = false,
  className,
  children,
  ...rest
}: ReadoutProps): JSX.Element {
  return (
    <div
      className={cx(
        'sc-readout',
        variant !== 'default' && `sc-readout--${variant}`,
        grow && 'sc-readout--grow',
        className,
      )}
      {...rest}
    >
      {label !== undefined && <span className="sc-readout__label">{label}</span>}
      <span className="sc-readout__value">{children}</span>
    </div>
  );
}

export type LEDTone = 'ok' | 'warn' | 'danger' | 'idle' | 'active';

export interface LEDProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: LEDTone;
}

/**
 * An eight pixel lamp. Decorative by construction: colour alone is not a
 * status, so an LED is always accompanied by the words it is illustrating and
 * is hidden from assistive technology.
 */
export function LED({ tone = 'idle', className, ...rest }: LEDProps): JSX.Element {
  return <span className={cx('sc-led', `sc-led--${tone}`, className)} aria-hidden="true" {...rest} />;
}
