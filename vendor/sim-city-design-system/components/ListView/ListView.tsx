/*
 * Interactive list rows: glyph or checkbox leading, primary over dim
 * secondary text, meta and actions trailing. The actions only surface on
 * hover or focus-within — visibility toggles in one step, nothing fades.
 * Keyboard model per the APG listbox pattern with row actions: DOM focus
 * roves across the rows themselves, Enter fires the row action, Space works
 * the selection.
 */

import { useMemo, useState, type JSX, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { Checkbox } from '../Checkbox';
import { ScrollArea } from '../ScrollArea';
import { PixelIcon, type PixelIconName } from '../../icons/PixelIcon';
import { cx } from '../../lib/cx';
import { useControllableState } from '../../lib/useControllableState';
import './ListView.css';

export interface ListViewItem {
  id: string;
  /** Leading 16px glyph; ignored in multiple-selection mode (the box leads). */
  icon?: PixelIconName;
  label: ReactNode;
  /** Dim second line. */
  description?: ReactNode;
  /** Trailing read-only figure or badge. */
  meta?: ReactNode;
  /** Trailing controls, shown on hover/focus-within. IconButtons belong here. */
  actions?: ReactNode;
}

export type ListViewSelectionMode = 'none' | 'single' | 'multiple';
export type ListViewDensity = 'normal' | 'compact';

export interface ListViewProps {
  /** Required: names the list for screen readers. */
  'aria-label': string;
  items: ListViewItem[];
  selectionMode?: ListViewSelectionMode;
  selectedIds?: string[];
  defaultSelectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  /** Double-click or Enter on a row. */
  onRowAction?: (id: string, item: ListViewItem) => void;
  /** 28px rows, or 22px compact. */
  density?: ListViewDensity;
  /** Scroll region height; the frame moves to the ScrollArea. */
  maxHeight?: number;
  emptyState?: ReactNode;
  className?: string;
}

/* Row-level handlers must not swallow clicks meant for embedded controls. */
function hitsControl(event: MouseEvent<HTMLElement>): boolean {
  return (
    event.target instanceof Element &&
    event.target.closest('button, a, input, label, select, textarea') !== null
  );
}

export function ListView({
  'aria-label': ariaLabel,
  items,
  selectionMode = 'none',
  selectedIds,
  defaultSelectedIds,
  onSelectionChange,
  onRowAction,
  density = 'normal',
  maxHeight,
  emptyState,
  className,
}: ListViewProps): JSX.Element {
  const [selected, setSelected] = useControllableState<string[]>(
    selectedIds,
    defaultSelectedIds ?? [],
    onSelectionChange,
  );
  const [focusId, setFocusId] = useState<string | null>(null);

  const selectable = selectionMode !== 'none';
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const effectiveFocusId =
    focusId !== null && items.some((item) => item.id === focusId) ? focusId : items[0]?.id;

  function toggleId(id: string): void {
    setSelected(selectedSet.has(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  function selectFromRow(id: string): void {
    if (selectionMode === 'single') setSelected([id]);
    else if (selectionMode === 'multiple') toggleId(id);
  }

  function focusSibling(rowEl: HTMLDivElement, to: number | 'first' | 'last'): void {
    const list = rowEl.parentElement;
    if (!list) return;
    const rowEls = Array.from(
      list.querySelectorAll<HTMLDivElement>(':scope > [role="option"]'),
    );
    const from = rowEls.indexOf(rowEl);
    const index =
      to === 'first' ? 0 : to === 'last' ? rowEls.length - 1 : Math.min(Math.max(from + to, 0), rowEls.length - 1);
    const target = rowEls[index];
    if (!target || target === rowEl) return;
    const id = target.dataset.id;
    if (id !== undefined) setFocusId(id);
    target.focus();
  }

  function handleRowKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    item: ListViewItem,
  ): void {
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
          onRowAction(item.id, item);
        }
        break;
      case ' ':
        if (event.target === event.currentTarget && selectable) {
          event.preventDefault();
          if (selectionMode === 'single') setSelected([item.id]);
          else toggleId(item.id);
        }
        break;
    }
  }

  const list = (
    <div
      role="listbox"
      aria-label={ariaLabel}
      aria-multiselectable={selectionMode === 'multiple' ? true : undefined}
      className={cx(
        'sc-listview',
        density === 'compact' && 'sc-listview--compact',
        maxHeight !== undefined && 'sc-listview--bare',
        maxHeight === undefined && className,
      )}
    >
      {items.length === 0 && <div className="sc-listview__empty">{emptyState ?? 'QUEUE IS EMPTY'}</div>}
      {items.map((item) => {
        const isSelected = selectedSet.has(item.id);
        return (
          <div
            key={item.id}
            role="option"
            data-id={item.id}
            aria-selected={selectable ? isSelected : undefined}
            tabIndex={item.id === effectiveFocusId ? 0 : -1}
            className={cx('sc-listview__row', isSelected && 'sc-listview__row--selected')}
            onFocus={(event) => {
              if (event.target === event.currentTarget) setFocusId(item.id);
            }}
            onClick={(event) => {
              if (hitsControl(event)) return;
              setFocusId(item.id);
              event.currentTarget.focus();
              selectFromRow(item.id);
            }}
            onDoubleClick={
              onRowAction
                ? (event) => {
                    if (!hitsControl(event)) onRowAction(item.id, item);
                  }
                : undefined
            }
            onKeyDown={(event) => handleRowKeyDown(event, item)}
          >
            {selectionMode === 'multiple' ? (
              <span className="sc-listview__check">
                <Checkbox
                  label={<span className="sr-only">Select row</span>}
                  checked={isSelected}
                  onCheckedChange={() => toggleId(item.id)}
                />
              </span>
            ) : item.icon !== undefined ? (
              <PixelIcon name={item.icon} size={16} className="sc-listview__glyph" />
            ) : null}
            <span className="sc-listview__text">
              <span className="sc-listview__label">{item.label}</span>
              {item.description !== undefined && (
                <span className="sc-listview__description">{item.description}</span>
              )}
            </span>
            {item.meta !== undefined && <span className="sc-listview__meta">{item.meta}</span>}
            {item.actions !== undefined && (
              <span className="sc-listview__actions">{item.actions}</span>
            )}
          </div>
        );
      })}
    </div>
  );

  if (maxHeight !== undefined) {
    return (
      <div className={cx('sc-listview__frame', className)}>
        <ScrollArea aria-label={ariaLabel} maxHeight={maxHeight}>
          {list}
        </ScrollArea>
      </div>
    );
  }
  return list;
}
