/*
 * Slider: APG slider pattern on a 1993 chassis. The track is a 6px sunken
 * channel; the filled span is not a smooth bar but marching accent-2 blocks
 * (4px on, 2px off) — quantity rendered as quanta. The thumb is a 12x20
 * raised plate that flips to sunken while held, the same press language as
 * every button in the system.
 *
 * The thumb owns role="slider" and the keyboard; the whole stage accepts
 * pointerdown for click-to-jump and captured dragging.
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
import { THUMB, clampValue, railLeft, snapToStep } from './sliderMath';
import './Slider.css';

export interface SliderProps {
  /** Sits above the channel; clicking it focuses the thumb. */
  label: ReactNode;
  min?: number;
  max?: number;
  step?: number;
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  /** Right-aligned tabular readout beside the label. */
  showValue?: boolean;
  /** Count of hard 1px marks under the channel (endpoints included). */
  ticks?: number;
  /** Human reading of the value, e.g. 7 -> "7% tax". Feeds aria-valuetext. */
  getValueText?: (value: number) => string;
  disabled?: boolean;
  className?: string;
}

export function Slider({
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
  disabled = false,
  className,
}: SliderProps): JSX.Element {
  const [value, setValue] = useControllableState(valueProp, defaultValue ?? min, onValueChange);
  const [dragging, setDragging] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const labelId = useId();

  const span = max - min;
  const pct = span > 0 ? ((clampValue(value, min, max) - min) / span) * 100 : 0;
  const valueText = getValueText ? getValueText(value) : undefined;

  function setFromClientX(clientX: number): void {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const rail = rect.width - THUMB;
    const ratio = rail > 0 ? clampValue((clientX - rect.left - THUMB / 2) / rail, 0, 1) : 0;
    setValue(snapToStep(min + ratio * span, min, max, step));
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
    if (disabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    thumbRef.current?.focus();
    setFromClientX(event.clientX);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>): void {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    setFromClientX(event.clientX);
  }

  function endDrag(event: PointerEvent<HTMLDivElement>): void {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDragging(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLSpanElement>): void {
    if (disabled) return;
    let next: number;
    switch (event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = value + step;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = value - step;
        break;
      case 'PageUp':
        next = value + step * 10;
        break;
      case 'PageDown':
        next = value - step * 10;
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
    setValue(snapToStep(next, min, max, step));
  }

  const tickCount = ticks !== undefined && ticks >= 2 ? ticks : 0;

  return (
    <div className={cx('sc-slider', disabled && 'sc-slider--disabled', className)}>
      <div className="sc-slider__head">
        <span
          className="sc-slider__label"
          id={labelId}
          onClick={disabled ? undefined : () => thumbRef.current?.focus()}
        >
          {label}
        </span>
        {showValue && <span className="sc-slider__value">{valueText ?? value}</span>}
      </div>
      <div
        ref={stageRef}
        className="sc-slider__stage"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="sc-slider__channel" aria-hidden="true">
          <span className="sc-slider__fill" style={{ width: railLeft(pct, true) }} />
        </span>
        <span
          ref={thumbRef}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={valueText}
          aria-labelledby={labelId}
          aria-orientation="horizontal"
          aria-disabled={disabled || undefined}
          onKeyDown={handleKeyDown}
          className={cx('sc-slider__thumb', dragging && 'sc-slider__thumb--dragging')}
          style={{ left: railLeft(pct, false) }}
        />
      </div>
      {tickCount > 0 && (
        <div className="sc-slider__ticks" aria-hidden="true">
          {Array.from({ length: tickCount }, (_, i) => (
            <span
              key={i}
              className="sc-slider__tick"
              style={{ left: railLeft((i / (tickCount - 1)) * 100, true) }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
