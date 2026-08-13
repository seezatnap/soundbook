import { useLayoutEffect, useState } from 'react';
import type { RefObject } from 'react';

export type Placement =
  | 'bottom-start'
  | 'bottom-end'
  | 'top-start'
  | 'top-end'
  | 'right-start'
  | 'left-start';

export interface AnchorPosition {
  top: number;
  left: number;
  /** The placement actually used after flipping to stay on screen. */
  placement: Placement;
}

const MARGIN = 4;

function compute(
  anchor: DOMRect,
  overlay: { width: number; height: number },
  placement: Placement,
  gap: number,
): { top: number; left: number } {
  switch (placement) {
    case 'bottom-start':
      return { top: anchor.bottom + gap, left: anchor.left };
    case 'bottom-end':
      return { top: anchor.bottom + gap, left: anchor.right - overlay.width };
    case 'top-start':
      return { top: anchor.top - overlay.height - gap, left: anchor.left };
    case 'top-end':
      return { top: anchor.top - overlay.height - gap, left: anchor.right - overlay.width };
    case 'right-start':
      return { top: anchor.top, left: anchor.right + gap };
    case 'left-start':
      return { top: anchor.top, left: anchor.left - overlay.width - gap };
  }
}

function flip(placement: Placement): Placement {
  switch (placement) {
    case 'bottom-start':
      return 'top-start';
    case 'bottom-end':
      return 'top-end';
    case 'top-start':
      return 'bottom-start';
    case 'top-end':
      return 'bottom-end';
    case 'right-start':
      return 'left-start';
    case 'left-start':
      return 'right-start';
  }
}

/**
 * Fixed-position coordinates for an overlay pinned to an anchor. Whole pixels,
 * flips to the opposite side when the preferred side would leave the viewport,
 * then clamps. Recomputes on open, scroll and resize — nothing animates, so a
 * hard jump to the new spot is the correct behaviour.
 */
export function useAnchorPosition(
  anchorRef: RefObject<HTMLElement | null>,
  overlayRef: RefObject<HTMLElement | null>,
  open: boolean,
  placement: Placement = 'bottom-start',
  gap = 2,
): AnchorPosition | null {
  const [position, setPosition] = useState<AnchorPosition | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const update = (): void => {
      const anchor = anchorRef.current;
      const overlay = overlayRef.current;
      if (!anchor || !overlay) return;
      const a = anchor.getBoundingClientRect();
      const size = { width: overlay.offsetWidth, height: overlay.offsetHeight };
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let used = placement;
      let pos = compute(a, size, used, gap);
      const overflows =
        pos.top < MARGIN ||
        pos.left < MARGIN ||
        pos.top + size.height > vh - MARGIN ||
        pos.left + size.width > vw - MARGIN;
      if (overflows) {
        const flipped = flip(placement);
        const alt = compute(a, size, flipped, gap);
        const altOverflows =
          alt.top < MARGIN ||
          alt.left < MARGIN ||
          alt.top + size.height > vh - MARGIN ||
          alt.left + size.width > vw - MARGIN;
        if (!altOverflows) {
          used = flipped;
          pos = alt;
        }
      }

      setPosition({
        top: Math.round(Math.min(Math.max(pos.top, MARGIN), vh - size.height - MARGIN)),
        left: Math.round(Math.min(Math.max(pos.left, MARGIN), vw - size.width - MARGIN)),
        placement: used,
      });
    };

    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, placement, gap, anchorRef, overlayRef]);

  return position;
}
