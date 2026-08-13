/*
 * A trail of jurisdiction: CITY / DISTRICT / PARCEL. Links except the last,
 * which is where you are and is set in full ink. Long trails fold their middle
 * into a "…" plate that unfolds on request — the hidden levels are omitted
 * from the DOM entirely, not visually truncated.
 */

import {
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type JSX,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { cx } from '../../lib/cx';
import { PixelIcon } from '../../icons/PixelIcon';
import './Breadcrumbs.css';

export interface BreadcrumbItem {
  label: ReactNode;
  href?: string;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
}

export interface BreadcrumbsProps extends HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
  /**
   * When the trail exceeds this many crumbs, everything between the first
   * crumb and the last (maxItems - 2) crumbs folds into a "…" plate.
   */
  maxItems?: number;
}

export function Breadcrumbs({
  items,
  maxItems,
  className,
  'aria-label': ariaLabel = 'Breadcrumb',
  ...rest
}: BreadcrumbsProps): JSX.Element {
  const [expanded, setExpanded] = useState(false);
  const listRef = useRef<HTMLOListElement>(null);
  const restoreFocusRef = useRef(false);

  const foldTo =
    maxItems !== undefined && maxItems >= 2 && !expanded && items.length > maxItems
      ? maxItems
      : null;

  /* The "…" button unmounts when pressed; hand focus to the first crumb it
     was standing in for so keyboard users are not dropped on the floor. */
  useEffect(() => {
    if (!expanded || !restoreFocusRef.current || !listRef.current) return;
    restoreFocusRef.current = false;
    const links = listRef.current.querySelectorAll<HTMLAnchorElement>('.sc-breadcrumbs__link');
    links[1]?.focus();
  }, [expanded]);

  const crumbs: Array<{ item: BreadcrumbItem; index: number } | 'fold'> = [];
  if (foldTo !== null) {
    /* First crumb + fold plate + the last (maxItems - 2) crumbs. */
    const tailStart = items.length - Math.max(1, foldTo - 2);
    crumbs.push({ item: items[0], index: 0 });
    crumbs.push('fold');
    for (let i = tailStart; i < items.length; i++) crumbs.push({ item: items[i], index: i });
  } else {
    items.forEach((item, index) => crumbs.push({ item, index }));
  }

  return (
    <nav aria-label={ariaLabel} className={cx('sc-breadcrumbs', className)} {...rest}>
      <ol ref={listRef} className="sc-breadcrumbs__list">
        {crumbs.map((crumb, position) => {
          if (crumb === 'fold') {
            return (
              <li key="fold" className="sc-breadcrumbs__item">
                <button
                  type="button"
                  className="sc-breadcrumbs__fold"
                  aria-label="Show hidden levels"
                  onClick={() => {
                    restoreFocusRef.current = true;
                    setExpanded(true);
                  }}
                >
                  …
                </button>
                <PixelIcon className="sc-breadcrumbs__sep" name="chevron-right" size={16} />
              </li>
            );
          }
          const { item, index } = crumb;
          const last = index === items.length - 1;
          return (
            <li key={index} className="sc-breadcrumbs__item">
              {last ? (
                <span className="sc-breadcrumbs__current" aria-current="page">
                  {item.label}
                </span>
              ) : (
                <a
                  className="sc-breadcrumbs__link"
                  href={item.href ?? '#'}
                  onClick={item.onClick}
                >
                  {item.label}
                </a>
              )}
              {position < crumbs.length - 1 && (
                <PixelIcon className="sc-breadcrumbs__sep" name="chevron-right" size={16} />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
