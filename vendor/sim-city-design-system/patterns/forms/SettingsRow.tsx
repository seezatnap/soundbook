/*
 * One line of a 1993 options page: the setting's name and its consequences on
 * the left, the control on the right, a hard 1px rule between neighbours.
 * When the control is a labelable element pass its id as `htmlFor` and the
 * row text becomes the real label; composite controls (radio groups, sliders)
 * carry their own sr-only name instead and the row text stays a plain span.
 */

import type { JSX, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import './SettingsRow.css';

export interface SettingsRowProps {
  label: ReactNode;
  description?: ReactNode;
  /** id of the control on the right; makes the row text a `<label>` for it. */
  htmlFor?: string;
  /** Fixed width for the control column; omit to size to content. */
  controlWidth?: number;
  className?: string;
  children: ReactNode;
}

export function SettingsRow({
  label,
  description,
  htmlFor,
  controlWidth,
  className,
  children,
}: SettingsRowProps): JSX.Element {
  return (
    <div className={cx('sc-settings-row', className)}>
      <div className="sc-settings-row__text">
        {htmlFor !== undefined ? (
          <label className="sc-settings-row__label" htmlFor={htmlFor}>
            {label}
          </label>
        ) : (
          <span className="sc-settings-row__label">{label}</span>
        )}
        {description !== undefined && (
          <span className="sc-settings-row__description">{description}</span>
        )}
      </div>
      <div
        className="sc-settings-row__control"
        style={controlWidth !== undefined ? { width: controlWidth } : undefined}
      >
        {children}
      </div>
    </div>
  );
}
