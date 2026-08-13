/*
 * Switch: a sunken track with a raised square thumb that JUMPS — a rocker,
 * not a slide. No easing exists in this system; the thumb is on one side or
 * the other, and the ON side floods with accent behind it. The I / O marks
 * are drawn as blocks (the O is square; there are no circles here).
 *
 * A hidden native checkbox with role="switch" carries the semantics. Space
 * toggles natively; Enter is added by hand because the pattern demands it.
 */

import { useId, type ChangeEvent, type JSX, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { useControllableState } from '../../lib/useControllableState';
import './Switch.css';

export interface SwitchProps {
  /** Sits to the right of the track; clicking it toggles. */
  label: ReactNode;
  /** Secondary line under the label, dim ink, wired via aria-describedby. */
  description?: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
  id?: string;
  className?: string;
}

export function Switch({
  label,
  description,
  checked,
  defaultChecked,
  onCheckedChange,
  disabled = false,
  name,
  id,
  className,
}: SwitchProps): JSX.Element {
  const [isOn, setOn] = useControllableState(checked, defaultChecked ?? false, onCheckedChange);
  const descriptionId = useId();

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    setOn(event.currentTarget.checked);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    // Space is native; Enter submits forms instead of toggling, so claim it.
    if (event.key === 'Enter') {
      event.preventDefault();
      setOn(!isOn);
    }
  }

  return (
    <label
      className={cx(
        'sc-switch',
        isOn && 'sc-switch--on',
        disabled && 'sc-switch--disabled',
        className,
      )}
    >
      <input
        type="checkbox"
        role="switch"
        className="sc-switch__input"
        id={id}
        name={name}
        checked={isOn}
        onChange={handleChange}
        onKeyDown={disabled ? undefined : handleKeyDown}
        disabled={disabled}
        aria-checked={isOn}
        aria-describedby={description ? descriptionId : undefined}
      />
      <span className="sc-switch__track" aria-hidden="true">
        <span className="sc-switch__fill" />
        <span className="sc-switch__mark-on" />
        <span className="sc-switch__mark-off" />
        <span className="sc-switch__thumb" />
      </span>
      <span className="sc-switch__text">
        <span className="sc-switch__label">{label}</span>
        {description !== undefined && (
          <span className="sc-switch__description" id={descriptionId}>
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
