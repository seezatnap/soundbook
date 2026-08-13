/*
 * The register is 236 pages long and the clerk will show you one at a time.
 * Square bevel buttons for first/prev/next/last, numbered plates for pages;
 * the current page is pressed in and inked in accent. Gaps are inert "…"
 * plates — always page 1, always the last page, a window around the current.
 */

import { type HTMLAttributes, type JSX } from 'react';
import { cx } from '../../lib/cx';
import { PixelIcon, type PixelIconName } from '../../icons/PixelIcon';
import { useControllableState } from '../../lib/useControllableState';
import { PaginationGlyph, type PaginationGlyphName } from './glyphs';
import './Pagination.css';

const numberFormat = new Intl.NumberFormat('en-US');

/* Gap sentinels: distinct negative values keep React keys stable. */
const LEAD_GAP = -1;
const TAIL_GAP = -2;

function pageItems(page: number, count: number, siblingCount: number): number[] {
  const start = Math.max(2, page - siblingCount);
  const end = Math.min(count - 1, page + siblingCount);
  const items: number[] = [1];
  if (start > 2) items.push(LEAD_GAP);
  for (let p = start; p <= end; p++) items.push(p);
  if (end < count - 1) items.push(TAIL_GAP);
  if (count > 1) items.push(count);
  return items;
}

export interface PaginationProps
  extends Omit<HTMLAttributes<HTMLElement>, 'onChange' | 'defaultValue'> {
  /** Total number of pages. */
  count: number;
  /** 1-based current page. */
  page?: number;
  defaultPage?: number;
  onPageChange?: (page: number) => void;
  /** Pages shown on each side of the current page. */
  siblingCount?: number;
  disabled?: boolean;
}

export function Pagination({
  count,
  page,
  defaultPage = 1,
  onPageChange,
  siblingCount = 1,
  disabled = false,
  className,
  'aria-label': ariaLabel = 'Pagination',
  ...rest
}: PaginationProps): JSX.Element {
  const [current, setCurrent] = useControllableState(page, defaultPage, onPageChange);

  const goTo = (next: number) => {
    setCurrent(Math.min(Math.max(next, 1), Math.max(count, 1)));
  };

  const navButton = (
    label: string,
    target: number,
    navDisabled: boolean,
    glyph: PixelIconName | null,
    privateGlyph: PaginationGlyphName | null,
  ) => (
    <li className="sc-pagination__item">
      <button
        type="button"
        className="sc-pagination__nav"
        aria-label={label}
        disabled={disabled || navDisabled}
        onClick={() => goTo(target)}
      >
        {glyph ? <PixelIcon name={glyph} size={16} /> : null}
        {privateGlyph ? <PaginationGlyph name={privateGlyph} /> : null}
      </button>
    </li>
  );

  return (
    <nav aria-label={ariaLabel} className={cx('sc-pagination', className)} {...rest}>
      <ol className="sc-pagination__list">
        {navButton('First page', 1, current <= 1, null, 'chevrons-left')}
        {navButton('Previous page', current - 1, current <= 1, 'chevron-left', null)}
        {pageItems(current, count, siblingCount).map((item) =>
          item < 0 ? (
            <li key={item === LEAD_GAP ? 'lead-gap' : 'tail-gap'} className="sc-pagination__item">
              <span className="sc-pagination__gap" aria-hidden="true">
                …
              </span>
            </li>
          ) : (
            <li key={item} className="sc-pagination__item">
              <button
                type="button"
                className="sc-pagination__page"
                aria-label={`Page ${numberFormat.format(item)}`}
                aria-current={item === current ? 'page' : undefined}
                disabled={disabled}
                onClick={() => goTo(item)}
              >
                {numberFormat.format(item)}
              </button>
            </li>
          ),
        )}
        {navButton('Next page', current + 1, current >= count, 'chevron-right', null)}
        {navButton('Last page', count, current >= count, null, 'chevrons-right')}
      </ol>
    </nav>
  );
}

export interface PaginationSummaryProps extends HTMLAttributes<HTMLElement> {
  /** 1-based current page. */
  page: number;
  /** Total number of pages. */
  count: number;
  /** Total record count, shown after an em dash when provided. */
  items?: number;
  /** What the records are: "PARCELS", "ORDINANCES". */
  itemsLabel?: string;
}

export function PaginationSummary({
  page,
  count,
  items,
  itemsLabel = 'RECORDS',
  className,
  ...rest
}: PaginationSummaryProps): JSX.Element {
  return (
    <p className={cx('sc-pagination__summary', className)} {...rest}>
      PAGE {numberFormat.format(page)} OF {numberFormat.format(count)}
      {items !== undefined && ` — ${numberFormat.format(items)} ${itemsLabel}`}
    </p>
  );
}
