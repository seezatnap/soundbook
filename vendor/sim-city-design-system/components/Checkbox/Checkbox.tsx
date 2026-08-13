/*
 * Checkbox: a sunken 16px well that a hard amber check drops into. No curve
 * anywhere — the check is drawn as pixel runs, the indeterminate state is a
 * plain accent bar. A hidden native input carries the semantics so forms,
 * screen readers and the keyboard all get the real thing.
 */

import {
  useContext,
  useEffect,
  useId,
  useRef,
  type ChangeEvent,
  type JSX,
  type ReactNode,
} from 'react';
import { cx } from '../../lib/cx';
import { useControllableState } from '../../lib/useControllableState';
import { CheckboxGroupContext } from './CheckboxGroupContext';
import './Checkbox.css';

/*
 * Private glyph: the registry `check` cropped to the 12px well inside the
 * 2px bevel. A 16-grid glyph shrunk to 12px would land on quarter pixels,
 * so this one is drawn on a 12-grid. Candidate for promotion as `check-12`.
 */
const CHECK_12 = [
  '............',
  '............',
  '...........#',
  '..........##',
  '.........##.',
  '........##..',
  '#......##...',
  '##....##....',
  '.##..##.....',
  '..####......',
  '...##.......',
  '............',
];

/** Same technique as PixelIcon, sized to the grid it is given. */
function GlyphRects({ grid }: { grid: string[] }): JSX.Element {
  const cells = grid.length;
  const rects: JSX.Element[] = [];
  for (let y = 0; y < grid.length; y++) {
    const row = grid[y];
    let x = 0;
    while (x < row.length) {
      if (row[x] === '.') {
        x++;
        continue;
      }
      let run = 1;
      while (x + run < row.length && row[x + run] === '#') run++;
      rects.push(<rect key={`${y}-${x}`} x={x} y={y} width={run} height={1} fill="currentColor" />);
      x += run;
    }
  }
  return (
    <svg
      width={cells}
      height={cells}
      viewBox={`0 0 ${cells} ${cells}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'block' }}
    >
      {rects}
    </svg>
  );
}

export interface CheckboxProps {
  /** Sits to the right of the box; clicking it toggles. */
  label: ReactNode;
  /** Secondary line under the label, dim ink, wired via aria-describedby. */
  description?: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Neither on nor off: an accent bar. Reported to AT as "mixed". */
  indeterminate?: boolean;
  disabled?: boolean;
  /** Membership key when rendered inside a CheckboxGroup. */
  value?: string;
  name?: string;
  id?: string;
  className?: string;
}

export function Checkbox({
  label,
  description,
  checked,
  defaultChecked,
  onCheckedChange,
  indeterminate = false,
  disabled = false,
  value,
  name,
  id,
  className,
}: CheckboxProps): JSX.Element {
  const group = useContext(CheckboxGroupContext);
  const inGroup = group !== null && value !== undefined;

  const [selfChecked, setSelfChecked] = useControllableState(
    checked,
    defaultChecked ?? false,
    onCheckedChange,
  );
  const isChecked = inGroup ? group.value.includes(value) : selfChecked;
  const isDisabled = disabled || (group?.disabled ?? false);

  const inputRef = useRef<HTMLInputElement>(null);
  // Re-asserted every render: activating a native indeterminate checkbox
  // clears the flag behind React's back.
  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = indeterminate;
  });

  const descriptionId = useId();

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const next = event.currentTarget.checked;
    if (inGroup) {
      group.toggle(value);
      onCheckedChange?.(next);
    } else {
      setSelfChecked(next);
    }
  }

  return (
    <label className={cx('sc-checkbox', isDisabled && 'sc-checkbox--disabled', className)}>
      <input
        ref={inputRef}
        type="checkbox"
        className="sc-checkbox__input"
        id={id}
        name={name ?? group?.name}
        value={value}
        checked={isChecked}
        onChange={handleChange}
        disabled={isDisabled}
        aria-checked={indeterminate ? 'mixed' : undefined}
        aria-describedby={description ? descriptionId : undefined}
      />
      <span className="sc-checkbox__box" aria-hidden="true">
        {indeterminate ? (
          <span className="sc-checkbox__bar" />
        ) : isChecked ? (
          <GlyphRects grid={CHECK_12} />
        ) : null}
      </span>
      <span className="sc-checkbox__text">
        <span className="sc-checkbox__label">{label}</span>
        {description !== undefined && (
          <span className="sc-checkbox__description" id={descriptionId}>
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
