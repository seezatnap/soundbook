/*
 * The record card read-out: a description list of dim uppercase terms against
 * tabular values, each pair ruled off from the next with a hard 1px line.
 * Horizontal keeps a fixed label column like a printed form; vertical stacks
 * the term over its value for narrow inspectors. LabeledValue is the same
 * pair sold individually.
 */

import type { CSSProperties, HTMLAttributes, JSX, ReactNode } from 'react';
import { cx } from '../../lib/cx';
import './DataList.css';

export type DataListOrientation = 'horizontal' | 'vertical';

export interface DataListProps extends HTMLAttributes<HTMLDListElement> {
  /** "horizontal" holds a fixed label column; "vertical" stacks each pair. */
  orientation?: DataListOrientation;
  /** Width of the label column in horizontal orientation. */
  labelWidth?: number | string;
}

export function DataList({
  orientation = 'horizontal',
  labelWidth,
  className,
  style,
  children,
  ...rest
}: DataListProps): JSX.Element {
  const vars =
    labelWidth !== undefined
      ? ({
          '--sc-datalist-label-width':
            typeof labelWidth === 'number' ? `${labelWidth}px` : labelWidth,
        } as CSSProperties)
      : undefined;
  return (
    <dl
      className={cx('sc-datalist', `sc-datalist--${orientation}`, className)}
      style={vars !== undefined || style !== undefined ? { ...vars, ...style } : undefined}
      {...rest}
    >
      {children}
    </dl>
  );
}

export interface DataListRowProps extends HTMLAttributes<HTMLDivElement> {
  /** The term; rendered as the `<dt>`. */
  label: ReactNode;
}

export function DataListRow({ label, className, children, ...rest }: DataListRowProps): JSX.Element {
  return (
    <div className={cx('sc-datalist__row', className)} {...rest}>
      <dt className="sc-datalist__label">{label}</dt>
      <dd className="sc-datalist__value">{children}</dd>
    </div>
  );
}

export interface LabeledValueProps extends HTMLAttributes<HTMLDivElement> {
  label: ReactNode;
  /** "vertical" stacks the label over the value; "horizontal" runs inline. */
  orientation?: DataListOrientation;
}

/** A single term/value pair for dashboards and card bodies — no list, no rules. */
export function LabeledValue({
  label,
  orientation = 'vertical',
  className,
  children,
  ...rest
}: LabeledValueProps): JSX.Element {
  return (
    <div
      className={cx('sc-labeled-value', `sc-labeled-value--${orientation}`, className)}
      {...rest}
    >
      <span className="sc-labeled-value__label">{label}</span>
      <span className="sc-labeled-value__value">{children}</span>
    </div>
  );
}
