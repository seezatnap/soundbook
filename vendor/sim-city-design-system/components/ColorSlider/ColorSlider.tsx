/*
 * ColorSlider: one channel of a colour, on the Slider chassis. The track is
 * not a gradient in the smooth sense — it is exactly `steps` hard payload
 * cells computed from the base colour, built as a hard-stop linear-gradient
 * string, because a 256-colour machine ramps in quanta or not at all. The
 * alpha channel lays its cells over a 4px hard checker.
 *
 * The thumb owns role="slider" and the keyboard, exactly as in Slider;
 * PageUp/PageDown jump by one track cell, so coarse movement walks the same
 * lattice the eye sees.
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
import { hexToRgb, hslToRgb, rgbToHsl, type Hsl, type Rgb } from '../Swatch/colorMath';
import './ColorSlider.css';

export type ColorChannel =
  | 'hue'
  | 'saturation'
  | 'lightness'
  | 'red'
  | 'green'
  | 'blue'
  | 'alpha';

interface ChannelSpec {
  min: number;
  max: number;
  abbr: string;
  unit: string;
}

const CHANNELS: Record<ColorChannel, ChannelSpec> = {
  hue: { min: 0, max: 360, abbr: 'HUE', unit: '°' },
  saturation: { min: 0, max: 100, abbr: 'SAT', unit: '%' },
  lightness: { min: 0, max: 100, abbr: 'LGT', unit: '%' },
  red: { min: 0, max: 255, abbr: 'RED', unit: '' },
  green: { min: 0, max: 255, abbr: 'GRN', unit: '' },
  blue: { min: 0, max: 255, abbr: 'BLU', unit: '' },
  alpha: { min: 0, max: 100, abbr: 'ALPHA', unit: '%' },
};

interface BaseColor {
  hsl: Hsl;
  rgb: Rgb;
}

function parseBase(color: string | Hsl): BaseColor {
  if (typeof color === 'string') {
    const rgb = hexToRgb(color) ?? { r: 0, g: 0, b: 0 };
    return { rgb, hsl: rgbToHsl(rgb) };
  }
  return { hsl: color, rgb: hslToRgb(color) };
}

function channelOf(base: BaseColor, channel: ColorChannel): number {
  switch (channel) {
    case 'hue':
      return base.hsl.h;
    case 'saturation':
      return base.hsl.s;
    case 'lightness':
      return base.hsl.l;
    case 'red':
      return base.rgb.r;
    case 'green':
      return base.rgb.g;
    case 'blue':
      return base.rgb.b;
    case 'alpha':
      return 100;
  }
}

/** The paint a track cell holds when the channel is set to `v`. Payload. */
function cellColor(base: BaseColor, channel: ColorChannel, v: number): string {
  const { hsl, rgb } = base;
  switch (channel) {
    case 'hue':
      return `hsl(${v} ${hsl.s}% ${hsl.l}%)`;
    case 'saturation':
      return `hsl(${hsl.h} ${v}% ${hsl.l}%)`;
    case 'lightness':
      return `hsl(${hsl.h} ${hsl.s}% ${v}%)`;
    case 'red':
      return `rgb(${v} ${rgb.g} ${rgb.b})`;
    case 'green':
      return `rgb(${rgb.r} ${v} ${rgb.b})`;
    case 'blue':
      return `rgb(${rgb.r} ${rgb.g} ${v})`;
    case 'alpha':
      return `rgb(${rgb.r} ${rgb.g} ${rgb.b} / ${v / 100})`;
  }
}

/* The transparency checker is payload furniture: it must stay true white and
   neutral grey under any chrome, or the tint it shows through would lie. */
const CHECKER =
  'conic-gradient(#FFFFFF 0 25%, #B8B8B8 0 50%, #FFFFFF 0 75%, #B8B8B8 0 100%)';

export interface ColorSliderProps {
  channel: ColorChannel;
  /** The base colour the ramp is computed from. Hex string or hsl object. */
  color: string | Hsl;
  /** Sits above the track; defaults to the channel abbreviation. */
  label?: ReactNode;
  /** Count of hard cells in the track. The quantization law, made visible. */
  steps?: number;
  /** Keyboard/pointer granularity in channel units. */
  step?: number;
  value?: number;
  /** Defaults to the base colour's own reading of this channel. */
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  /** Right-aligned tabular readout, e.g. "HUE 120°". */
  showValue?: boolean;
  disabled?: boolean;
  className?: string;
}

export function ColorSlider({
  channel,
  color,
  label,
  steps = 16,
  step = 1,
  value: valueProp,
  defaultValue,
  onValueChange,
  showValue = true,
  disabled = false,
  className,
}: ColorSliderProps): JSX.Element {
  const spec = CHANNELS[channel];
  const base = parseBase(color);
  const [value, setValue] = useControllableState(
    valueProp,
    defaultValue ?? channelOf(base, channel),
    onValueChange,
  );
  const [dragging, setDragging] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const labelId = useId();

  const span = spec.max - spec.min;
  const pct = ((clampValue(value, spec.min, spec.max) - spec.min) / span) * 100;
  const valueText = `${spec.abbr} ${value}${spec.unit}`;

  const cellCount = Math.max(2, Math.round(steps));
  const stops: string[] = [];
  for (let i = 0; i < cellCount; i++) {
    const from = ((i / cellCount) * 100).toFixed(3);
    const to = (((i + 1) / cellCount) * 100).toFixed(3);
    const center = Math.round(spec.min + ((i + 0.5) / cellCount) * span);
    stops.push(`${cellColor(base, channel, center)} ${from}% ${to}%`);
  }
  const ramp = `linear-gradient(90deg, ${stops.join(', ')})`;
  const rampStyle =
    channel === 'alpha'
      ? { backgroundImage: `${ramp}, ${CHECKER}`, backgroundSize: '100% 100%, 8px 8px' }
      : { backgroundImage: ramp };

  function setFromClientX(clientX: number): void {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const rail = rect.width - THUMB;
    const ratio = rail > 0 ? clampValue((clientX - rect.left - THUMB / 2) / rail, 0, 1) : 0;
    setValue(snapToStep(spec.min + ratio * span, spec.min, spec.max, step));
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
    const cell = span / cellCount;
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
        next = value + cell;
        break;
      case 'PageDown':
        next = value - cell;
        break;
      case 'Home':
        next = spec.min;
        break;
      case 'End':
        next = spec.max;
        break;
      default:
        return;
    }
    event.preventDefault();
    setValue(snapToStep(next, spec.min, spec.max, step));
  }

  return (
    <div className={cx('sc-colorslider', disabled && 'sc-colorslider--disabled', className)}>
      <div className="sc-colorslider__head">
        <span
          className="sc-colorslider__label"
          id={labelId}
          onClick={disabled ? undefined : () => thumbRef.current?.focus()}
        >
          {label ?? spec.abbr}
        </span>
        {showValue && <span className="sc-colorslider__value">{valueText}</span>}
      </div>
      <div
        ref={stageRef}
        className="sc-colorslider__stage"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <span className="sc-colorslider__well" aria-hidden="true">
          <span className="sc-colorslider__ramp" style={rampStyle} />
        </span>
        <span
          ref={thumbRef}
          role="slider"
          tabIndex={disabled ? -1 : 0}
          aria-valuemin={spec.min}
          aria-valuemax={spec.max}
          aria-valuenow={value}
          aria-valuetext={valueText}
          aria-labelledby={labelId}
          aria-orientation="horizontal"
          aria-disabled={disabled || undefined}
          onKeyDown={handleKeyDown}
          className={cx('sc-colorslider__thumb', dragging && 'sc-colorslider__thumb--dragging')}
          style={{ left: railLeft(pct, false) }}
        />
      </div>
    </div>
  );
}
