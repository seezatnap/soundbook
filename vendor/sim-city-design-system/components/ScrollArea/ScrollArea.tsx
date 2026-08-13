/*
 * A framed scroll region. The frame is a sunken bevel; when rows are hidden
 * above or below the fold, a hard 1px --edge-dark line appears at that edge —
 * a drawn affordance, not a gradient fade. The viewport itself is focusable
 * and labelled so keyboard users can scroll it.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type JSX,
} from 'react';
import { cx } from '../../lib/cx';
import './ScrollArea.css';

export interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
  /** Required: names the region for screen readers. */
  'aria-label': string;
  maxHeight?: number | string;
  maxWidth?: number | string;
}

export function ScrollArea({
  'aria-label': ariaLabel,
  maxHeight,
  maxWidth,
  className,
  style,
  children,
  onScroll,
  ...rest
}: ScrollAreaProps): JSX.Element {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [clipped, setClipped] = useState({ top: false, bottom: false });

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const top = viewport.scrollTop > 0;
    const bottom = viewport.scrollTop + viewport.clientHeight < viewport.scrollHeight - 1;
    setClipped((prev) => (prev.top === top && prev.bottom === bottom ? prev : { top, bottom }));
  }, []);

  /* Content grows and shrinks without scrolling; watch sizes, not just scroll. */
  useEffect(() => {
    measure();
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    for (const child of viewport.children) observer.observe(child);
    return () => observer.disconnect();
  }, [measure]);

  const sizing: CSSProperties = {};
  if (maxWidth !== undefined) sizing.maxWidth = maxWidth;

  return (
    <div
      className={cx(
        'sc-scrollarea',
        clipped.top && 'sc-scrollarea--clipped-top',
        clipped.bottom && 'sc-scrollarea--clipped-bottom',
        className,
      )}
      style={{ ...sizing, ...style }}
    >
      <div
        ref={viewportRef}
        role="region"
        aria-label={ariaLabel}
        tabIndex={0}
        className="sc-scrollarea__viewport"
        style={maxHeight !== undefined ? { maxHeight } : undefined}
        onScroll={(event) => {
          onScroll?.(event);
          measure();
        }}
        {...rest}
      >
        {children}
      </div>
    </div>
  );
}
