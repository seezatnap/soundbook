/*
 * A site navigation bar in the APG disclosure-navigation idiom: plain links
 * navigate, and some entries are buttons (aria-expanded/aria-controls) that
 * drop a rich Panel — a two-column grid of link cards, uppercase title over a
 * dim description. This is navigation, not a menu: no menu roles, every
 * top-level item keeps its place in the tab order, and the panels hang
 * in-flow beneath their buttons so Tab walks straight down into the cards.
 *
 * Keyboard: ArrowLeft/Right walk the top level (wrapping), ArrowDown on an
 * expanded button — or opening with it — drops into the first card,
 * ArrowUp/Down walk the cards, Escape closes and restores the button, and an
 * outside click or focus leaving the nav dismisses.
 */

import { useEffect, useId, useRef, useState } from 'react';
import type { FocusEvent as ReactFocusEvent, JSX, KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Panel } from '../Panel';
import { PixelIcon } from '../../icons/PixelIcon';
import { useDismissable } from '../../lib/overlays';
import './NavigationMenu.css';

export interface NavigationCard {
  id: string;
  label: string;
  description: string;
  href: string;
}

export interface NavigationLinkEntry {
  id: string;
  label: string;
  href: string;
  /** Marks the page currently being served: aria-current="page". */
  current?: boolean;
}

export interface NavigationPanelEntry {
  id: string;
  label: string;
  cards: NavigationCard[];
}

export type NavigationEntry = NavigationLinkEntry | NavigationPanelEntry;

function isPanelEntry(entry: NavigationEntry): entry is NavigationPanelEntry {
  return 'cards' in entry;
}

export interface NavigationMenuProps {
  entries: NavigationEntry[];
  'aria-label'?: string;
}

const TOP_SELECTOR = '.sc-navmenu__link, .sc-navmenu__trigger';
const CARD_SELECTOR = '.sc-navmenu__card';

export function NavigationMenu({
  entries,
  'aria-label': ariaLabel = 'Site',
}: NavigationMenuProps): JSX.Element {
  const [openId, setOpenId] = useState<string | null>(null);
  const rootRef = useRef<HTMLElement | null>(null);
  const pendingCardFocus = useRef(false);
  const baseId = useId();

  useDismissable({
    onDismiss: () => setOpenId(null),
    inside: [rootRef],
    enabled: openId !== null,
  });

  // Opening via the keyboard asks for the first card; the panel must render
  // before it can take focus.
  useEffect(() => {
    if (!pendingCardFocus.current || openId === null) return;
    pendingCardFocus.current = false;
    rootRef.current?.querySelector<HTMLElement>(CARD_SELECTOR)?.focus();
  }, [openId]);

  const closeAndRestore = (): void => {
    if (openId === null) return;
    const trigger = rootRef.current?.querySelector<HTMLElement>(`[data-nav-id="${openId}"]`);
    setOpenId(null);
    trigger?.focus();
  };

  const moveTop = (from: HTMLElement, delta: number): void => {
    const root = rootRef.current;
    if (!root) return;
    const tops = Array.from(root.querySelectorAll<HTMLElement>(TOP_SELECTOR));
    const index = tops.indexOf(from);
    if (index < 0) return;
    tops[(index + delta + tops.length) % tops.length]?.focus();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>): void => {
    const target = event.target as HTMLElement;
    if (event.key === 'Escape') {
      if (openId !== null) {
        event.preventDefault();
        event.stopPropagation();
        closeAndRestore();
      }
      return;
    }
    if (target.matches(TOP_SELECTOR)) {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveTop(target, 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveTop(target, -1);
      } else if (event.key === 'ArrowDown' && target.matches('.sc-navmenu__trigger')) {
        event.preventDefault();
        const id = target.dataset.navId ?? null;
        if (openId === id) {
          rootRef.current?.querySelector<HTMLElement>(CARD_SELECTOR)?.focus();
        } else if (id !== null) {
          pendingCardFocus.current = true;
          setOpenId(id);
        }
      }
      return;
    }
    if (target.matches(CARD_SELECTOR)) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        const root = rootRef.current;
        if (!root) return;
        const cards = Array.from(root.querySelectorAll<HTMLElement>(CARD_SELECTOR));
        const index = cards.indexOf(target);
        const next = cards[index + (event.key === 'ArrowDown' ? 1 : -1)];
        if (next) {
          event.preventDefault();
          next.focus();
        }
      }
    }
  };

  const handleBlur = (event: ReactFocusEvent<HTMLElement>): void => {
    // Focus walking out of the nav takes the open panel with it.
    if (openId !== null && !rootRef.current?.contains(event.relatedTarget as Node)) {
      setOpenId(null);
    }
  };

  return (
    <nav
      className="sc-navmenu"
      aria-label={ariaLabel}
      ref={rootRef}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    >
      {entries.map((entry) => {
        if (!isPanelEntry(entry)) {
          return (
            <a
              key={entry.id}
              className="sc-navmenu__link"
              href={entry.href}
              data-nav-id={entry.id}
              aria-current={entry.current ? 'page' : undefined}
            >
              {entry.label}
            </a>
          );
        }
        const expanded = openId === entry.id;
        const panelId = `${baseId}-${entry.id}`;
        return (
          <div className="sc-navmenu__item" key={entry.id}>
            <button
              type="button"
              className="sc-navmenu__trigger"
              data-nav-id={entry.id}
              aria-expanded={expanded}
              aria-controls={expanded ? panelId : undefined}
              onClick={() => setOpenId(expanded ? null : entry.id)}
            >
              {entry.label}
              <PixelIcon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} />
            </button>
            {expanded ? (
              <Panel className="sc-navmenu__panel" id={panelId} aria-label={entry.label}>
                <div className="sc-navmenu__grid">
                  {entry.cards.map((card) => (
                    <a key={card.id} className="sc-navmenu__card" href={card.href}>
                      <span className="sc-navmenu__card-title">{card.label}</span>
                      <span className="sc-navmenu__card-desc">{card.description}</span>
                    </a>
                  ))}
                </div>
              </Panel>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
