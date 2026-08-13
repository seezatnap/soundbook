import type { HTMLAttributes, JSX, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import './Legend.css';

export interface LegendEntry {
  /** Any CSS colour; map components pass the `--map-*` tokens through `var()`. */
  color: string;
  label: ReactNode;
}

export interface LegendProps extends HTMLAttributes<HTMLUListElement> {
  entries: LegendEntry[];
  /** Columns of key. One is the default: a legend is read down, not across. */
  columns?: number;
}

/**
 * The key to a map surface. Carries no frame of its own — drop it in a Panel,
 * or under a minimap, and it takes the surrounding chrome.
 *
 * The swatches are hidden from assistive technology: a colour is not a fact a
 * screen reader can use, and the label beside it already carries the meaning.
 */
export function Legend({ entries, columns = 1, className, style, ...rest }: LegendProps): JSX.Element {
  return (
    <ul
      className={cx('sc-legend', className)}
      style={{ gridTemplateColumns: `repeat(${Math.max(1, columns)}, auto)`, ...style }}
      role="list"
      {...rest}
    >
      {entries.map((entry, index) => (
        <li className="sc-legend__item" key={index}>
          <span
            className="sc-legend__swatch"
            style={{ background: entry.color }}
            aria-hidden="true"
          />
          <span className="sc-legend__label">{entry.label}</span>
        </li>
      ))}
    </ul>
  );
}
