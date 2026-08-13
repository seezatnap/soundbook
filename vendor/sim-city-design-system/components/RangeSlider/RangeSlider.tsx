/*
 * RangeSlider: the Slider's anatomy with two plates on one channel. The
 * quantized fill runs between the thumbs; the thumbs cannot cross and keep
 * a floor of one step between them, so the window is never empty. Each
 * thumb is its own APG slider ("Minimum" / "Maximum") with the full key set;
 * the pointer grabs whichever plate is nearer to the hit.
 */

import {
  useId,
  useRef,
  useState,
  type JSX,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { cx } from '../../lib/cx';
import { useControllableState } from '../../lib/useControllableState';
import { THUMB, clampValue, railLeft, snapToStep } from '../Slider/sliderMath';
import './RangeSlider.css';

type ThumbKind = 'min' | 'max';

export interface RangeSliderProps {
  /** Sits above the channel; clicking it focuses the minimum thumb. */
  label: ReactNode;
  min?: number;
  max?: number;
  step?: number;
  value?: [number, number];
  defaultValue?: [number, number];
  onValueChange?: (value: [number, number]) => void;
  /** Right-aligned tabular "low–high" readout beside the label. */
  showValue?: boolean;
  /** Count of hard 1px marks under the channel (endpoints included). */
  ticks?: number;
  /** Human reading of one bound, e.g. 12000 -> "$12,000". Feeds aria-valuetext. */
  getValueText?: (value: number) => string;
  /** Accessible names for the two thumbs. */
  thumbLabels?: [string, string];
  disabled?: boolean;
  className?: string;
}

export function RangeSlider({
  label,
  min = 0,
  max = 100,
  step = 1,
  value: valueProp,
  defaultValue,
  onValueChange,
  showValue = false,
  ticks,
  getValueText,
  thumbLabels = ['Minimum', 'Maximum'],
  disabled = false,
  className,
}: RangeSliderProps): JSX.Element {
  const [value, setValue] = useControllableState<[number, number]>(
    valueProp,
    defaultValue ?? [min, max],
    onValueChange,
  );
  const [dragging, setDragging] = useState<ThumbKind | null>(null);
  const activeRef = useRef<ThumbKind>('min');
  const stageRef = useRef<HTMLDivElement>(null);
  const minThumbRef = useRef<HTMLSpanElement>(null);
  const maxThumbRef = useRef<HTMLSpanElement>(null);
  const labelId = useId();

  const [lo, hi] = value;
  const span = max - min;
  const loPct = span > 0 ? ((clampValue(lo, min, max) - min) / span) * 100 : 0;
  const hiPct = span > 0 ? ((clampValue(hi, min, max) - min) / span) * 100 : 0;

  /* The other thumb, minus the mandatory one-step gap, is the hard wall. */
  const loCeiling = snapToStep(hi - step, min, max, step);
  const hiFloor = snapToStep(lo + step, min, max, step);

  function setBound(which: ThumbKind, raw: number): void {
    const snapped = snapToStep(raw, min, max, step);
    if (which === 'min') {
      setValue([clampValue(snapped, min, loCeiling), hi]);
    } else {
      setValue([lo, clampValue(snapped, hiFloor, max)]);
    }
  }

  function ratioFromClientX(clientX: number): number {
    const stage = stageRef.current;
    if (!stage) return 0;
    const rect = stage.getBoundingClientRect();
    const rail = rect.width - THUMB;
    return rail > 0 ? clampValue((clientX - rect.left - THUMB / 2) / rail, 0, 1) : 0;
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    if (disabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const raw = min + ratioFromClientX(event.clientX) * span;
    const which: ThumbKind = Math.abs(raw - lo) <= Math.abs(raw - hi) ? 'min' : 'max';
    activeRef.current = which;
    setDragging(which);
    (which === 'min' ? minThumbRef : maxThumbRef).current?.focus();
    setBound(which, raw);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    setBound(activeRef.current, min + ratioFromClientX(event.clientX) * span);
  }

  function endDrag(event: PointerEvent<HTMLDivElement>): void {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(null);
  }

  function handleThumbKeyDown(which: ThumbKind, event: KeyboardEvent<HTMLSpanElement>): void {
    if (disabled) return;
    const current = which === 'min' ? lo : hi;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = current + step;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = current - step;
        break;
      case 'PageUp':
        next = current + step * 10;
        break;
      case 'PageDown':
        next = current - step * 10;
        break;
      case 'Home':
        next = min;
        break;
      case 'End':
        next = max;
        break;
      default:
        return;
    }
    event.preventDefault();
    setBound(which, next);
  }

  const fmt = (v: number): string => (getValueText ? getValueText(v) : String(v));
  const tickCount = ticks !== undefined && ticks >= 2 ? ticks : 0;

  const thumbShared = {
    role: 'slider' as const,
    tabIndex: disabled ? -1 : 0,
    'aria-orientation': 'horizontal' as const,
    'aria-disabled': disabled || undefined,
  };

  return (
    <div className={cx('sc-range-slider', disabled && 'sc-range-slider--disabled', className)}>
      <div className="sc-range-slider__head">
        <span
          className="sc-range-slider__label"
          id={labelId}
          onClick={disabled ? undefined : () => minThumbRef.current?.focus()}
        >
          {label}
        </span>
        {showValue && (
          <span className="sc-range-slider__value">
            {fmt(lo)}–{fmt(hi)}
          </span>
        )}
      </div>
      <div
        role="group"
        aria-labelledby={labelId}
        ref={stageRef}
        className="sc-range-slider__stage"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="sc-range-slider__channel" aria-hidden="true">
          <span
            className="sc-range-slider__fill"
            style={{ left: railLeft(loPct, true), width: railLeft(hiPct - loPct, false) }}
          />
        </span>
        <span
          {...thumbShared}
          ref={minThumbRef}
          aria-label={thumbLabels[0]}
          aria-valuemin={min}
          aria-valuemax={loCeiling}
          aria-valuenow={lo}
          aria-valuetext={getValueText ? getValueText(lo) : undefined}
          onKeyDown={(event) => handleThumbKeyDown('min', event)}
          className={cx(
            'sc-range-slider__thumb',
            dragging === 'min' && 'sc-range-slider__thumb--dragging',
          )}
          style={{ left: railLeft(loPct, false) }}
        />
        <span
          {...thumbShared}
          ref={maxThumbRef}
          aria-label={thumbLabels[1]}
          aria-valuemin={hiFloor}
          aria-valuemax={max}
          aria-valuenow={hi}
          aria-valuetext={getValueText ? getValueText(hi) : undefined}
          onKeyDown={(event) => handleThumbKeyDown('max', event)}
          className={cx(
            'sc-range-slider__thumb',
            dragging === 'max' && 'sc-range-slider__thumb--dragging',
          )}
          style={{ left: railLeft(hiPct, false) }}
        />
      </div>
      {tickCount > 0 && (
        <div className="sc-range-slider__ticks" aria-hidden="true">
          {Array.from({ length: tickCount }, (_, i) => (
            <span
              key={i}
              className="sc-range-slider__tick"
              style={{ left: railLeft((i / (tickCount - 1)) * 100, true) }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
