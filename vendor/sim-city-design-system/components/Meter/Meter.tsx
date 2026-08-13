import { useId, type HTMLAttributes, type JSX, type ReactNode } from 'react';
import { cx } from '../../lib/cx';
import './Meter.css';

export interface MeterProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  value: number;
  min?: number;
  max?: number;
  /** Caption above the channel. Also names the meter for assistive tech. */
  label?: ReactNode;
  /** Right-aligned readout on the caption row. */
  showValue?: boolean;
  /** Readout and `aria-valuetext` override, for units the number alone loses. */
  valueText?: string;
  /** Print min and max under the ends of the channel. */
  showRange?: boolean;
  /** Fraction of the range (0–1) at which the reading turns amber. */
  warnAt?: number;
  /** Fraction of the range (0–1) at which the reading turns red. */
  dangerAt?: number;
}

/**
 * A reading, not an activity. The fill is solid because it is a quantity that
 * exists right now — blocks would imply something is being done to it — and
 * the colour is a function of the number, so the operator can read the state
 * of the city off the shape of the bar without reading the label.
 */
export function Meter({
  value,
  min = 0,
  max = 100,
  label,
  showValue = false,
  valueText,
  showRange = false,
  warnAt,
  dangerAt,
  className,
  ...rest
}: MeterProps): JSX.Element {
  const labelId = useId();
  const clamped = Math.min(Math.max(value, min), max);
  const fraction = max > min ? (clamped - min) / (max - min) : 0;
  const level =
    dangerAt !== undefined && fraction >= dangerAt
      ? 'danger'
      : warnAt !== undefined && fraction >= warnAt
        ? 'warn'
        : 'ok';
  const readout = valueText ?? `${clamped} / ${max}`;

  return (
    <div
      className={cx('sc-meter', className)}
      role="meter"
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={clamped}
      aria-valuetext={valueText}
      aria-labelledby={label !== undefined ? labelId : undefined}
      {...rest}
    >
      {(label !== undefined || showValue) && (
        <div className="sc-meter__head">
          <span className="sc-meter__label" id={labelId}>
            {label}
          </span>
          {showValue && (
            <span className={cx('sc-meter__value', `sc-meter__value--${level}`)}>{readout}</span>
          )}
        </div>
      )}
      <div className="sc-meter__channel">
        <div
          className={cx('sc-meter__fill', `sc-meter__fill--${level}`)}
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
      {showRange && (
        <div className="sc-meter__range">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      )}
    </div>
  );
}
