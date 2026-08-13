/*
 * The styled-elements layer of every register in the building: a sunken frame,
 * a dim uppercase header band over a hard 2px rule, 1px separators between
 * rows. It owns no state and makes no decisions — DataTable is the layer that
 * thinks. Zebra striping alternates --face with the half-step --face-raised so
 * ink keeps its contrast on both stripes.
 */

import type {
  HTMLAttributes,
  JSX,
  TableHTMLAttributes,
  TdHTMLAttributes,
  ThHTMLAttributes,
} from 'react';
import { cx } from '../../lib/cx';
import './Table.css';

export type TableDensity = 'normal' | 'compact';

export interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  /** Alternate row faces. The even stripe is --face-raised, never a tint. */
  striped?: boolean;
  density?: TableDensity;
  /** The sunken 2px frame. Turn off when a ScrollArea already frames the table. */
  frame?: boolean;
  /** Header cells hold to the top of the nearest scroll region. */
  stickyHeader?: boolean;
}

export function Table({
  striped = false,
  density = 'normal',
  frame = true,
  stickyHeader = false,
  className,
  children,
  ...rest
}: TableProps): JSX.Element {
  return (
    <table
      className={cx(
        'sc-table',
        striped && 'sc-table--striped',
        density === 'compact' && 'sc-table--compact',
        frame && 'sc-table--frame',
        stickyHeader && 'sc-table--sticky-head',
        className,
      )}
      {...rest}
    >
      {children}
    </table>
  );
}

export type TableSectionProps = HTMLAttributes<HTMLTableSectionElement>;

export function TableHeader({ className, children, ...rest }: TableSectionProps): JSX.Element {
  return (
    <thead className={cx('sc-table__head', className)} {...rest}>
      {children}
    </thead>
  );
}

export function TableBody({ className, children, ...rest }: TableSectionProps): JSX.Element {
  return (
    <tbody className={cx('sc-table__body', className)} {...rest}>
      {children}
    </tbody>
  );
}

/** The summary band: sunken face, hard rule above, for totals and tallies. */
export function TableFooter({ className, children, ...rest }: TableSectionProps): JSX.Element {
  return (
    <tfoot className={cx('sc-table__foot', className)} {...rest}>
      {children}
    </tfoot>
  );
}

export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  /** Full-strength accent row, the system's one selection treatment. */
  selected?: boolean;
  /** Pointer cursor and a one-step face shift on hover. */
  interactive?: boolean;
}

export function TableRow({
  selected = false,
  interactive = false,
  className,
  children,
  ...rest
}: TableRowProps): JSX.Element {
  return (
    <tr
      className={cx(
        'sc-table__row',
        selected && 'sc-table__row--selected',
        interactive && 'sc-table__row--interactive',
        className,
      )}
      {...rest}
    >
      {children}
    </tr>
  );
}

export interface TableHeadProps extends ThHTMLAttributes<HTMLTableCellElement> {
  /** Right-aligned tabular figures; pair with `numeric` on the column's cells. */
  numeric?: boolean;
}

export function TableHead({
  numeric = false,
  className,
  children,
  ...rest
}: TableHeadProps): JSX.Element {
  return (
    <th
      className={cx('sc-table__head-cell', numeric && 'sc-table__head-cell--numeric', className)}
      {...rest}
    >
      {children}
    </th>
  );
}

export interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  /** Right-aligned tabular figures so columns of money line up. */
  numeric?: boolean;
}

export function TableCell({
  numeric = false,
  className,
  children,
  ...rest
}: TableCellProps): JSX.Element {
  return (
    <td className={cx('sc-table__cell', numeric && 'sc-table__cell--numeric', className)} {...rest}>
      {children}
    </td>
  );
}

export type TableCaptionProps = HTMLAttributes<HTMLTableCaptionElement>;

export function TableCaption({ className, children, ...rest }: TableCaptionProps): JSX.Element {
  return (
    <caption className={cx('sc-table__caption', className)} {...rest}>
      {children}
    </caption>
  );
}
