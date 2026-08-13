/*
 * ColorArea: the saturation/lightness plane of one hue, quantized into a
 * resolution x resolution grid of hard payload cells inside a sunken well.
 * Saturation runs left to right, lightness bottom to top; each cell is the
 * exact hsl at its own centre — no cell blends into its neighbour, per the
 * quantization law. Rows are drawn as hard-stop gradient strips, one per
 * lightness band.
 *
 * The thumb is an 8px hollow square wearing a 1px ink + 1px ink-invert
 * double keyline, so it survives any paint underneath. It owns role="slider"
 * (there is no APG 2D slider; valuetext carries both axes): arrows step S/L
 * by 1, PageUp/PageDown step lightness by 10, Home/End rail saturation.
 */

import {
  useId,
  useMemo,
  useRef,
  type JSX,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { cx } from '../../lib/cx';
import { useControllableState } from '../../lib/useControllableState';
import { clamp } from '../Swatch/colorMath';
import './ColorArea.css';

export interface ColorAreaValue {
  /** Saturation, 0–100. */
  s: number;
  /** Lightness, 0–100. */
  l: number;
}

export interface ColorAreaProps {
  /** The hue whose plane this is, degrees 0–360. */
  hue: number;
  /** Sits above the well; clicking it focuses the thumb. */
  label?: ReactNode;
  value?: ColorAreaValue;
  defaultValue?: ColorAreaValue;
  onValueChange?: (value: ColorAreaValue) => void;
  /** Cells per side. The grid is the law made visible; default 16x16. */
  resolution?: number;
  disabled?: boolean;
  className?: string;
}

export function ColorArea({
  hue,
  label,
  value: valueProp,
  defaultValue,
  onValueChange,
  resolution = 16,
  disabled = false,
  className,
}: ColorAreaProps): JSX.Element {
  const res = Math.max(2, Math.round(resolution));
  /* Whole-pixel cells: the stage grows to fit rather than splitting pixels. */
  const cell = Math.max(4, Math.round(192 / res));
  const size = cell * res;

  const [value, setValue] = useControllableState(
    valueProp,
    defaultValue ?? { s: 100, l: 50 },
    onValueChange,
  );
  const s = clamp(Math.round(value.s), 0, 100);
  const l = clamp(Math.round(value.l), 0, 100);
  const valueText = `S ${s}% L ${l}%`;

  const stageRef = useRef<HTMLSpanElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const labelId = useId();

  const rows = useMemo(() => {
    const out: JSX.Element[] = [];
    for (let j = 0; j < res; j++) {
      const rowL = Math.round((100 - ((j + 0.5) / res) * 100) * 10) / 10;
      const stops: string[] = [];
      for (let i = 0; i < res; i++) {
        const cellS = Math.round(((i + 0.5) / res) * 100 * 10) / 10;
        const from = ((i / res) * 100).toFixed(3);
        const to = (((i + 1) / res) * 100).toFixed(3);
        stops.push(`hsl(${hue} ${cellS}% ${rowL}%) ${from}% ${to}%`);
      }
      out.push(
        <span
          key={j}
          className="sc-colorarea__row"
          style={{ height: cell, backgroundImage: `linear-gradient(90deg, ${stops.join(', ')})` }}
        />,
      );
    }
    return out;
  }, [hue, res, cell]);

  function setFromPointer(clientX: number, clientY: number): void {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    setValue({
      s: clamp(Math.round(((clientX - rect.left) / rect.width) * 100), 0, 100),
      l: clamp(Math.round((1 - (clientY - rect.top) / rect.height) * 100), 0, 100),
    });
  }

  function handlePointerDown(event: PointerEvent<HTMLSpanElement>): void {
    if (disabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    thumbRef.current?.focus();
    setFromPointer(event.clientX, event.clientY);
  }

  function handlePointerMove(event: PointerEvent<HTMLSpanElement>): void {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    setFromPointer(event.clientX, event.clientY);
  }

  function endDrag(event: PointerEvent<HTMLSpanElement>): void {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLSpanElement>): void {
    if (disabled) return;
    let nextS = s;
    let nextL = l;
    switch (event.key) {
      case 'ArrowRight':
        nextS = s + 1;
        break;
      case 'ArrowLeft':
        nextS = s - 1;
        break;
      case 'ArrowUp':
        nextL = l + 1;
        break;
      case 'ArrowDown':
        nextL = l - 1;
        break;
      case 'PageUp':
        nextL = l + 10;
        break;
      case 'PageDown':
        nextL = l - 10;
        break;
      case 'Home':
        nextS = 0;
        break;
      case 'End':
        nextS = 100;
        break;
      default:
        return;
    }
    event.preventDefault();
    setValue({ s: clamp(nextS, 0, 100), l: clamp(nextL, 0, 100) });
  }

  return (
    <div className={cx('sc-colorarea', disabled && 'sc-colorarea--disabled', className)}>
      <div className="sc-colorarea__head">
        <span
          className="sc-colorarea__label"
          id={labelId}
          onClick={disabled ? undefined : () => thumbRef.current?.focus()}
        >
          {label ?? 'SHADE'}
        </span>
        <span className="sc-colorarea__value">{valueText}</span>
      </div>
      <span className="sc-colorarea__well">
        <span
          ref={stageRef}
          className="sc-colorarea__stage"
          style={{ width: size, height: size }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <span className="sc-colorarea__rows" aria-hidden="true">
            {rows}
          </span>
          <span
            ref={thumbRef}
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={s}
            aria-valuetext={valueText}
            aria-labelledby={labelId}
            aria-disabled={disabled || undefined}
            onKeyDown={handleKeyDown}
            className="sc-colorarea__thumb"
            style={{ left: `calc(${s}% - 4px)`, top: `calc(${100 - l}% - 4px)` }}
          />
        </span>
      </span>
    </div>
  );
}
