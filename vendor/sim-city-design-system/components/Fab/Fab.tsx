/*
 * The floating action button: the one 42px accent plate allowed to sit on top
 * of the work. Same bevel flip as every button — floating buys no new physics.
 *
 * `position` values other than 'static' render `position: absolute` with 16px
 * margins inside the nearest positioned ancestor. Apps that want it pinned to
 * the screen should mount it in their own fixed, positioned wrapper (e.g.
 * `position: fixed; inset: 0; pointer-events: none` with the FAB opting back
 * in) — the component deliberately never fixes itself to the viewport, so
 * demos and docs pages stay uncovered.
 */

import type { ButtonHTMLAttributes, JSX } from 'react';
import { PixelIcon, type PixelIconName } from '../../icons/PixelIcon';
import { cx } from '../../lib/cx';
import './Fab.css';

export interface FabProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: PixelIconName;
  /** Required: names the action; becomes visible text in `extended` mode. */
  label: string;
  variant?: 'accent' | 'danger';
  /** Show the label as an uppercase caption beside the glyph. */
  extended?: boolean;
  /** Corner within the nearest positioned ancestor, or 'static' to sit in flow. */
  position?: 'br' | 'bl' | 'tr' | 'tl' | 'static';
}

export function Fab({
  icon,
  label,
  variant = 'accent',
  extended = false,
  position = 'static',
  className,
  type = 'button',
  ...rest
}: FabProps): JSX.Element {
  return (
    <button
      type={type}
      title={label}
      aria-label={extended ? undefined : label}
      className={cx(
        'sc-fab',
        variant === 'danger' && 'sc-fab--danger',
        extended && 'sc-fab--extended',
        position !== 'static' && `sc-fab--pos-${position}`,
        className,
      )}
      {...rest}
    >
      <PixelIcon name={icon} size={32} />
      {extended && <span className="sc-fab__label">{label}</span>}
    </button>
  );
}
