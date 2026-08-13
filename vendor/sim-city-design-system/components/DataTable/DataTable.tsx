/*
 * The smart layer over Table: column definitions in, a register out. Sorting
 * cycles asc → desc → filing order; selection is the accent row; Enter or a
 * double-click fires the row action. When any of that is on, the table takes
 * `role="grid"` and rows carry a roving tabindex, per the APG data-grid
 * pattern's row-focus variant.
 */

import { useMemo, useState, type JSX, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { Checkbox } from '../Checkbox';
import { ScrollArea } from '../ScrollArea';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  type TableDensity,
} from '../Table';
import { PixelIcon } from '../../icons/PixelIcon';
import { cx } from '../../lib/cx';
import { useControllableState } from '../../lib/useControllableState';
import './DataTable.css';

export type SortDirection = 'asc' | 'desc';

export interface SortDescriptor {
  column: string;
  direction: SortDirection;
}

export interface DataTableColumn<T> {
  /** Field key into the row object; also the sort key. */
  key: string;
  header: ReactNode;
  /** Right-aligned tabular figures. */
  numeric?: boolean;
  sortable?: boolean;
  width?: number | string;
  /** Custom cell content; sorting still reads the raw field under `key`. */
  render?: (row: T) => ReactNode;
}

export type DataTableSelectionMode = 'none' | 'single' | 'multiple';

export interface DataTableProps<T> {
  /** Required: a register with no visible caption has to be named some way. */
  'aria-label': string;
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  /** Stable identity per row; selection and focus survive re-sorting on it. */
  rowKey: (row: T) => string;
  striped?: boolean;
  density?: TableDensity;
  /** Scroll region height. The header band stays put; the rows go under it. */
  maxHeight?: number;
  sortDescriptor?: SortDescriptor | null;
  defaultSortDescriptor?: SortDescriptor | null;
  onSortChange?: (descriptor: SortDescriptor | null) => void;
  selectionMode?: DataTableSelectionMode;
  selectedKeys?: string[];
  defaultSelectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
  /** Double-click or Enter on a row. */
  onRowAction?: (key: string, row: T) => void;
  /** Shown in place of rows when `rows` is empty. */
  emptyState?: ReactNode;
  /** Footer summary row: column key → cell content. Missing keys stay blank. */
  summary?: Partial<Record<string, ReactNode>>;
  className?: string;
}

/* Filing-order tiebreak is the caller's row order; this only compares fields. */
function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a ?? '').localeCompare(String(b ?? ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

/* Row-level handlers must not swallow clicks meant for embedded controls. */
function hitsControl(event: MouseEvent<HTMLElement>): boolean {
  return (
    event.target instanceof Element &&
    event.target.closest('button, a, input, label, select, textarea') !== null
  );
}

export function DataTable<T>({
  'aria-label': ariaLabel,
  columns,
  rows,
  rowKey,
  striped = false,
  density = 'normal',
  maxHeight,
  sortDescriptor,
  defaultSortDescriptor,
  onSortChange,
  selectionMode = 'none',
  selectedKeys,
  defaultSelectedKeys,
  onSelectionChange,
  onRowAction,
  emptyState,
  summary,
  className,
}: DataTableProps<T>): JSX.Element {
  const [sort, setSort] = useControllableState<SortDescriptor | null>(
    sortDescriptor,
    defaultSortDescriptor ?? null,
    onSortChange,
  );
  const [selected, setSelected] = useControllableState<string[]>(
    selectedKeys,
    defaultSelectedKeys ?? [],
    onSelectionChange,
  );
  const [focusKey, setFocusKey] = useState<string | null>(null);

  const selectable = selectionMode !== 'none';
  const interactive = selectable || onRowAction !== undefined;

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const result = compareValues(
        (a as Record<string, unknown>)[sort.column],
        (b as Record<string, unknown>)[sort.column],
      );
      return sort.direction === 'asc' ? result : -result;
    });
    return copy;
  }, [rows, sort]);

  const allKeys = useMemo(() => rows.map(rowKey), [rows, rowKey]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const allSelected = allKeys.length > 0 && allKeys.every((key) => selectedSet.has(key));
  const someSelected = allKeys.some((key) => selectedSet.has(key));

  const sortedKeys = useMemo(() => sortedRows.map(rowKey), [sortedRows, rowKey]);
  const effectiveFocusKey =
    focusKey !== null && sortedKeys.includes(focusKey) ? focusKey : sortedKeys[0];

  function cycleSort(column: string): void {
    if (!sort || sort.column !== column) setSort({ column, direction: 'asc' });
    else if (sort.direction === 'asc') setSort({ column, direction: 'desc' });
    else setSort(null);
  }

  function toggleKey(key: string): void {
    setSelected(
      selectedSet.has(key) ? selected.filter((k) => k !== key) : [...selected, key],
    );
  }

  function selectFromRow(key: string): void {
    if (selectionMode === 'single') setSelected([key]);
    else if (selectionMode === 'multiple') toggleKey(key);
  }

  function focusSibling(
    rowEl: HTMLTableRowElement,
    to: number | 'first' | 'last',
  ): void {
    const body = rowEl.parentElement;
    if (!body) return;
    const rowEls = Array.from(body.querySelectorAll<HTMLTableRowElement>(':scope > tr'));
    const from = rowEls.indexOf(rowEl);
    const index =
      to === 'first' ? 0 : to === 'last' ? rowEls.length - 1 : Math.min(Math.max(from + to, 0), rowEls.length - 1);
    const target = rowEls[index];
    if (!target || target === rowEl) return;
    const key = target.dataset.key;
    if (key !== undefined) setFocusKey(key);
    target.focus();
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, key: string, row: T): void {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusSibling(event.currentTarget, 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusSibling(event.currentTarget, -1);
        break;
      case 'Home':
        event.preventDefault();
        focusSibling(event.currentTarget, 'first');
        break;
      case 'End':
        event.preventDefault();
        focusSibling(event.currentTarget, 'last');
        break;
      case 'Enter':
        if (event.target === event.currentTarget && onRowAction) {
          event.preventDefault();
          onRowAction(key, row);
        }
        break;
      case ' ':
        if (event.target === event.currentTarget && selectable) {
          event.preventDefault();
          selectFromRow(key);
        }
        break;
    }
  }

  const columnCount = columns.length + (selectionMode === 'multiple' ? 1 : 0);

  const table = (
    <Table
      aria-label={ariaLabel}
      role={interactive ? 'grid' : undefined}
      aria-multiselectable={selectionMode === 'multiple' ? true : undefined}
      striped={striped}
      density={density}
      frame={maxHeight === undefined}
      stickyHeader={maxHeight !== undefined}
    >
      <TableHeader>
        <TableRow>
          {selectionMode === 'multiple' && (
            <TableHead className="sc-datatable__select-cell">
              <span className="sc-datatable__select">
                <Checkbox
                  label={<span className="sr-only">Select all rows</span>}
                  checked={allSelected}
                  indeterminate={someSelected && !allSelected}
                  onCheckedChange={(next) => setSelected(next ? allKeys : [])}
                />
              </span>
            </TableHead>
          )}
          {columns.map((column) => {
            const isSorted = sort !== null && sort.column === column.key;
            return (
              <TableHead
                key={column.key}
                numeric={column.numeric}
                style={column.width !== undefined ? { width: column.width } : undefined}
                aria-sort={
                  column.sortable
                    ? isSorted
                      ? sort.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                    : undefined
                }
              >
                {column.sortable ? (
                  <button
                    type="button"
                    className={cx(
                      'sc-datatable__sort',
                      column.numeric && 'sc-datatable__sort--numeric',
                    )}
                    onClick={() => cycleSort(column.key)}
                  >
                    <span className="sc-datatable__sort-label">{column.header}</span>
                    {isSorted && (
                      <PixelIcon
                        name={sort.direction === 'asc' ? 'sort-asc' : 'sort-desc'}
                        size={16}
                      />
                    )}
                  </button>
                ) : (
                  column.header
                )}
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sortedRows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columnCount} className="sc-datatable__empty">
              {emptyState ?? 'NO RECORDS ON FILE'}
            </TableCell>
          </TableRow>
        ) : (
          sortedRows.map((row) => {
            const key = rowKey(row);
            const isSelected = selectedSet.has(key);
            return (
              <TableRow
                key={key}
                data-key={key}
                interactive={interactive}
                selected={selectable && isSelected}
                aria-selected={selectable ? isSelected : undefined}
                tabIndex={interactive ? (key === effectiveFocusKey ? 0 : -1) : undefined}
                onFocus={
                  interactive
                    ? (event) => {
                        if (event.target === event.currentTarget) setFocusKey(key);
                      }
                    : undefined
                }
                onClick={
                  interactive
                    ? (event) => {
                        if (hitsControl(event)) return;
                        setFocusKey(key);
                        event.currentTarget.focus();
                        selectFromRow(key);
                      }
                    : undefined
                }
                onDoubleClick={
                  onRowAction
                    ? (event) => {
                        if (!hitsControl(event)) onRowAction(key, row);
                      }
                    : undefined
                }
                onKeyDown={interactive ? (event) => handleRowKeyDown(event, key, row) : undefined}
              >
                {selectionMode === 'multiple' && (
                  <TableCell className="sc-datatable__select-cell">
                    <span className="sc-datatable__select">
                      <Checkbox
                        label={<span className="sr-only">Select row</span>}
                        checked={isSelected}
                        onCheckedChange={() => toggleKey(key)}
                      />
                    </span>
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell key={column.key} numeric={column.numeric}>
                    {column.render
                      ? column.render(row)
                      : ((row as Record<string, unknown>)[column.key] as ReactNode)}
                  </TableCell>
                ))}
              </TableRow>
            );
          })
        )}
      </TableBody>
      {summary !== undefined && (
        <TableFooter>
          <TableRow>
            {selectionMode === 'multiple' && <TableCell className="sc-datatable__select-cell" />}
            {columns.map((column) => (
              <TableCell key={column.key} numeric={column.numeric}>
                {summary[column.key]}
              </TableCell>
            ))}
          </TableRow>
        </TableFooter>
      )}
    </Table>
  );

  if (maxHeight !== undefined) {
    return (
      <div className={cx('sc-datatable', className)}>
        <ScrollArea aria-label={ariaLabel} maxHeight={maxHeight}>
          {table}
        </ScrollArea>
      </div>
    );
  }
  return <div className={cx('sc-datatable', className)}>{table}</div>;
}
