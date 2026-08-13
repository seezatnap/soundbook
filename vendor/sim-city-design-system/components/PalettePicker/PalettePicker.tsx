/*
 * PalettePicker: the system palette as a municipal fixture — a dense grid of
 * 12px payload cells in a deep sunken well, with a sunken tabular readout
 * strip bolted underneath. The default palette is the 216-colour web-safe
 * cube plus a 16-step grey ramp: the entire gamut this machine admits to
 * having, laid out flat with no blending between neighbours.
 *
 * Keyboard: one roving tab stop, arrows move focus in two dimensions,
 * Home/End jump to the rails, Enter/Space commit. Arrows deliberately move
 * focus WITHOUT selecting — the APG-sanctioned variation for radio-style
 * widgets where selection is consequential — because sweeping across 232
 * inks should not repaint anything until the clerk stamps one.
 */

import {
  useId,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { cx } from '../../lib/cx';
import { useControllableState } from '../../lib/useControllableState';
import { normalizeHex } from '../Swatch/colorMath';
import './PalettePicker.css';

/** The 216-colour web-safe cube, then a 16-step grey ramp. 232 inks total. */
export function webSafePalette(): string[] {
  const STEPS = ['00', '33', '66', '99', 'CC', 'FF'];
  const out: string[] = [];
  for (const r of STEPS) for (const g of STEPS) for (const b of STEPS) out.push(`#${r}${g}${b}`);
  for (let i = 0; i < 16; i++) {
    const v = (i * 17).toString(16).padStart(2, '0').toUpperCase();
    out.push(`#${v}${v}${v}`);
  }
  return out;
}

export interface PalettePickerProps {
  /** Uppercase dim band above the well. */
  label?: ReactNode;
  /** Payload inks. Defaults to the web-safe cube plus the grey ramp. */
  palette?: string[];
  /** Grid width; 18 puts the 216-cube at exactly 12 rows. */
  columns?: number;
  /** Controlled value; pass null for "no ink selected". */
  value?: string | null;
  defaultValue?: string;
  onValueChange?: (hex: string) => void;
  disabled?: boolean;
  className?: string;
}

export function PalettePicker({
  label,
  palette,
  columns = 18,
  value: valueProp,
  defaultValue,
  onValueChange,
  disabled = false,
  className,
}: PalettePickerProps): JSX.Element {
  const cells = useMemo(
    () => (palette ?? webSafePalette()).map((c) => normalizeHex(c) ?? c.toUpperCase()),
    [palette],
  );
  const cols = Math.max(1, Math.round(columns));

  const [value, setValue] = useControllableState<string | null>(
    valueProp,
    defaultValue ?? null,
    (next) => {
      if (next !== null) onValueChange?.(next);
    },
  );

  const selectedIndex = value === null ? -1 : cells.indexOf(normalizeHex(value) ?? value.toUpperCase());
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const labelId = useId();

  const stopIndex = disabled ? -1 : (focusIndex ?? (selectedIndex >= 0 ? selectedIndex : 0));
  const readIndex = hoverIndex ?? focusIndex ?? (selectedIndex >= 0 ? selectedIndex : null);

  function focusCell(index: number): void {
    setFocusIndex(index);
    gridRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const count = cells.length;
    if (count === 0) return;
    const origin = focusIndex ?? (selectedIndex >= 0 ? selectedIndex : 0);
    let next: number | null = null;
    switch (event.key) {
      case 'ArrowRight':
        next = Math.min(count - 1, origin + 1);
        break;
      case 'ArrowLeft':
        next = Math.max(0, origin - 1);
        break;
      case 'ArrowDown':
        next = origin + cols < count ? origin + cols : null;
        break;
      case 'ArrowUp':
        next = origin - cols >= 0 ? origin - cols : null;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = count - 1;
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        setValue(cells[origin]);
        return;
      default:
        return;
    }
    event.preventDefault();
    if (next !== null) focusCell(next);
  }

  /* When focus leaves the grid, the tab stop returns to the selected ink. */
  function handleBlur(event: FocusEvent<HTMLDivElement>): void {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setFocusIndex(null);
    }
  }

  return (
    <div className={cx('sc-palette', disabled && 'sc-palette--disabled', className)}>
      {label !== undefined && (
        <div className="sc-palette__label" id={labelId}>
          {label}
        </div>
      )}
      <div className="sc-palette__well">
        <div
          ref={gridRef}
          role="radiogroup"
          aria-labelledby={label !== undefined ? labelId : undefined}
          aria-label={label === undefined ? 'System palette' : undefined}
          aria-disabled={disabled || undefined}
          className="sc-palette__grid"
          style={{ gridTemplateColumns: `repeat(${cols}, 12px)` }}
          onKeyDown={disabled ? undefined : handleKeyDown}
          onBlur={handleBlur}
          onPointerLeave={() => setHoverIndex(null)}
        >
          {cells.map((hex, i) => (
            <span
              key={`${hex}-${i}`}
              role="radio"
              aria-checked={i === selectedIndex}
              aria-label={hex}
              data-index={i}
              tabIndex={i === stopIndex ? 0 : -1}
              className={cx('sc-palette__cell', i === selectedIndex && 'sc-palette__cell--selected')}
              style={{ background: hex }}
              onClick={
                disabled
                  ? undefined
                  : () => {
                      focusCell(i);
                      setValue(hex);
                    }
              }
              onPointerEnter={disabled ? undefined : () => setHoverIndex(i)}
              onFocus={() => setFocusIndex(i)}
            />
          ))}
        </div>
      </div>
      {/* Visual echo of the cell under the pointer or cursor; the cells
          themselves carry the accessible names. */}
      <div className="sc-palette__readout" aria-hidden="true">
        <span
          className="sc-palette__chip"
          style={readIndex !== null ? { background: cells[readIndex] } : undefined}
        />
        <span className="sc-palette__hex">{readIndex !== null ? cells[readIndex] : 'NO INK'}</span>
        <span className="sc-palette__ordinal">
          {readIndex !== null ? `${readIndex + 1} OF ${cells.length}` : `— OF ${cells.length}`}
        </span>
      </div>
    </div>
  );
}
